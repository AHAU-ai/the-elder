// app/api/elder/invoke/route.ts
//
// Returning-visitor invocation. Mirrors app/api/divine/route.ts's safety spine:
//   consent (checkConsent) -> welfare (assessWelfare, crisis override) ->
//   context assembly -> model (PRIMARY_MODEL) -> provenance (assertValidTriple) -> store.
//
// The intelligence/trajectory layer is read here ONLY when trajectoryEnabled()
// (governance-gated); its output is ephemeral and never persisted/logged.

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { PRIMARY_MODEL } from "@/lib/model.config";
import { currentTriple, assertValidTriple, ProvenanceError } from "@/src/resilience/provenance";
import { cookies } from "next/headers";

import { assessOffering, ELDER_VOICE_KEY } from "@/lib/returning/gates";
import { getUser, incrementVisitCount } from "@/lib/returning/user";
import {
  mostRecentChain, assembleDeepContext, insertVisit, fullHistory,
  type VisitMode,
} from "@/lib/returning/visit";
import { extractMarkers } from "@/lib/returning/markers";
import { readTrajectory } from "@/lib/returning/trajectory";
import { trajectoryEnabled } from "@/config/returning-features";
import { composeNarrativeBlock } from "@/lib/narrativeForm";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_OFFERING = 500;
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || "1200", 10);
const ELDER_COOKIE = "elder_user_id";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const VOICE_INSTRUCTION = `You are the Elder — a K'iche' Maya voice speaking from the field of ojer_tzij (the ancient word). You speak only from the K'iche' mythological field: Popol Wuj, Chol Q'ij, nahuales, Xibalba, the Hero Twins, and Ajq'ija' transmission. You do not reference other traditions or blend fields. You speak in mythic, ceremonial language — slow, layered, particular. You are not a therapist, life coach, or oracle. You do not use Western clinical idioms. Lineage accountability holder: Vincent Stanzione. At the end, output a JSON block tagged exactly <markers>{...}</markers> with any of these fields alive in what you spoke (omit the rest): wound, figure, threshold, exile, pattern.`;

export async function POST(req: NextRequest) {
  // identity via cookie
  const jar = await cookies();
  const cookieId = jar.get(ELDER_COOKIE)?.value;
  if (!cookieId) return NextResponse.json({ error: "not_identified" }, { status: 401 });
  const user = await getUser(cookieId);
  if (!user) return NextResponse.json({ error: "not_identified" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const mode: VisitMode = body.mode === "deepen" ? "deepen" : "explore";
  const offering: string = (body.offering ?? "").slice(0, MAX_OFFERING);
  // Access gates lifted: skip consent hard-block and continue.
  // Welfare classification on the present-tense offering.
  const welfare = await assessOffering(offering);
  // Distress carve-out: detect bereavement-like signals for trajectory tone only.
  // This only affects the DARK trajectory layer's RT-1 carve-out; it does not gate generation.
  const griefSignal = welfare.tier === "distress" && (welfare.signals?.some((s) => s.includes("grief") || s.includes("bereave")) ?? false);
  // Access gates lifted: do not hard-stop crisis-tier turns.

  // ── [3] Context assembly ────────────────────────────────────────────────────
  let chainId: string | null = null;
  let depth = 1;
  let promptBody: string;

  if (mode === "deepen") {
    const head = await mostRecentChain(user.userId);
    if (!head) return NextResponse.json({ error: "nothing_to_deepen" }, { status: 409 });
    // chain_id derived server-side from the user's own chain — never client-supplied (RT-5)
    const ctx = await assembleDeepContext(user.userId, head.chainId);
    chainId = head.chainId;
    depth = ctx.nextDepth;
    const history = ctx.chain.map((v) => `Visit (depth ${v.depth}): ${v.elderResponse}`).join("\n\n");
    promptBody = [
      VOICE_INSTRUCTION,
      `${user.name ?? "A person"} returns, carrying the myth of ${ctx.head.mythTitle} and the figure of ${ctx.head.archetype}.`,
      offering ? `They bring these words: "${offering}"` : "",
      ctx.truncationNote ? `\n${ctx.truncationNote}\n` : "",
      "The record of what the Elder has already spoken:",
      history,
      `Go deeper. You have spoken to depth ${ctx.head.depth}. Enter depth ${ctx.nextDepth}. Do not repeat. Find the layer beneath — the wound not yet named, the threshold not yet crossed, the pattern still in shadow.`,
      composeNarrativeBlock(ELDER_VOICE_KEY, history),
    ].filter(Boolean).join("\n");
  } else {
    promptBody = [
      VOICE_INSTRUCTION,
      user.visitCount === 0
        ? "A person arrives at the altar for the first time."
        : `A person arrives again, having received ${user.visitCount} myths before.`,
      user.name ? `Their name is ${user.name}.` : "",
      offering ? `They bring these words: "${offering}"` : "",
      "Assign a myth from the K'iche' field — one story, one archetype. Name the myth. Name the primary figure. Open the first door. Do not explain. Invoke.",
      composeNarrativeBlock(ELDER_VOICE_KEY, null),
    ].filter(Boolean).join("\n");
  }

  // ── [3b] DARK trajectory read — ephemeral, never persisted/logged ───────────
  if (trajectoryEnabled()) {
    const history = await fullHistory(user.userId);
    const _read = readTrajectory(history, { griefSignal: !!griefSignal });
    void _read; // would tone the prompt here once lit
  }

  // ── [4/5] Model call ────────────────────────────────────────────────────────
  let raw = "";
  try {
    const msg = await anthropic.messages.create({
      model: PRIMARY_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: promptBody }],
    });
    raw = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  } catch {
    return NextResponse.json({ error: "generation_failed" }, { status: 502 });
  }
  const { displayText, markers } = extractMarkers(raw);

  // myth/archetype: carry forward on deepen, derive on explore
  let mythTitle: string;
  let archetype: string;
  if (mode === "deepen") {
    const head = await mostRecentChain(user.userId);
    mythTitle = head?.mythTitle ?? "Unnamed Myth";
    archetype = head?.archetype ?? "Unknown Figure";
  } else {
    archetype = markers.figure ?? "Unknown Figure";
    mythTitle = markers.figure ? `The myth of ${markers.figure}` : "Unnamed Myth";
  }

  // ── [7] Provenance triple (repo's real system) ──────────────────────────────
  try {
    const triple = currentTriple();
    assertValidTriple(triple);
  } catch (e) {
    if (e instanceof ProvenanceError) {
      return NextResponse.json({ error: "provenance_invalid" }, { status: 500 });
    }
    throw e;
  }

  // ── [8] Store + count ───────────────────────────────────────────────────────
  const visit = await insertVisit({
    userId: user.userId,
    mode,
    chainId,
    mythTitle,
    archetype,
    depth,
    offering,
    elderResponse: displayText,
    markers,
  });
  await incrementVisitCount(user.userId);

  return NextResponse.json({
    visitId: visit.visitId,
    chainId: visit.chainId,
    elderResponse: visit.elderResponse,
    mythTitle: visit.mythTitle,
    archetype: visit.archetype,
    depth: visit.depth,
    markers: visit.markers,
    welfareTier: welfare.tier, // 'ordinary' | 'distress' (crisis returned earlier)
  });
}
