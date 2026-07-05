/**
 * lib/narrativeForm.ts — v3. Narrative form layer for The Elder.
 *
 * v3 CHANGE: all keys corrected to match the canonical VoiceKey union
 * in src/resilience/flags.ts (the actual source of truth — NOT
 * lib/lineages.ts, which does not define voice identity in this repo).
 * Canonical keys: ojer_tzij, ajqij, pythia, hem_netjer, volva, stoa,
 * sage_of_the_way, sufi, elder_of_country, babalawo, mekubal, vedic,
 * keeper_of_the_fire. Plus "elder_frame", which is NOT a VoiceKey —
 * it is the Elder's own frame voice, composed separately wherever
 * greeting/transition/closing copy is assembled.
 *
 * Confirmed mappings (2026-07-05, Jesse Barber):
 *   sheikh (v2 register) -> sufi
 *   rashbi (v2 register) -> mekubal
 *   pythia_of_delphi (v2 register) -> pythia
 *
 * TWO TIERS, REVIEW-GATED (per red team R6 / blue team B6):
 *   floor — plain operational form constraints. Universal. Always
 *           injected for every divination response and elder_frame.
 *   law   — the Han-cadenced Law of the Telling PLUS the voice's
 *           narrative register. Injected only for voices whose row
 *           in governance/checklist.yaml (narrative_form.voices)
 *           is signed. Tier gates law and register TOGETHER: an
 *           unreviewed voice receives form protection without
 *           borrowed poetics and without its unreviewed register.
 *
 * COMPOSITION ORDER (per B1 — cadence insulation):
 *   floor → law → return-thread contract → voice register.
 *   The register is last, closest to generation, where recency
 *   dominates. P28 in the harness measures whether this holds.
 *
 * SOURCE OF TRUTH:
 *   Runtime tier state: governance/narrative-tiers.json (imported
 *   below; build fails if absent — that is intentional).
 *   Human signoff state: governance/checklist.yaml.
 *   scripts/check-narrative-tiers.mjs fails CI if they disagree
 *   or if any law-tier row is unsigned. Flipping a voice to law
 *   IS the signoff landing.
 *
 * HARD CARVE-OUTS — never inject this layer into:
 *   — LintelGate / consent copy (Disclosure → Crisis Gate →
 *     Volitional Declaration stays plain language).
 *   — §5.4 crisis hard-block output. assessWelfare() fires before
 *     buildSystemPrompt(); P29 regression-tests the isolation.
 *   — CEILING / ⧁CORPUS⧁ machine lines: own line, end of
 *     response, stripped before display, unchanged.
 *
 * PROVENANCE:
 *   narrativeContractMaterial() must be concatenated into the
 *   CONTRACT_HASH input so any change to floor, law, a register,
 *   the thread contract, or a tier flip bumps contractVersion.
 *
 * GOVERNANCE NOTES:
 *   — ojer_tzij register requires Vincent Stanzione's signature.
 *   — elder_of_country register is DRAFT pending accountability
 *     review; inert at floor tier.
 *   — babalawo: flags.ts shows this voice authorized/active in
 *     production (Fama Aina Udoyi, June 16 2026 per governance
 *     history) — but NO narrative register is authored here.
 *     Per Lineage Integrity of Voice, the narrative register of
 *     Ifá must arrive in transmission, not be authored from
 *     outside it. Floor tier only, indefinitely, until such a
 *     register is supplied by an accountable source.
 *   — ajqij, hem_netjer, stoa, sage_of_the_way, vedic,
 *     keeper_of_the_fire: no registers authored yet. Floor tier
 *     only. Not a gap to panic over — floor already delivers full
 *     narrative FORM (no lists, no headers, one telling). Only the
 *     Han-law cadence and lineage-specific imagery are withheld
 *     pending review.
 */

import tiersJson from "../governance/narrative-tiers.json";

export type NarrativeTier = "floor" | "law";

const TIERS: Record<string, NarrativeTier> = (() => {
  const t = tiersJson as Record<string, string>;
  for (const [k, v] of Object.entries(t)) {
    if (v !== "floor" && v !== "law") {
      throw new Error(
        `governance/narrative-tiers.json: invalid tier "${v}" for "${k}"`
      );
    }
  }
  return t as Record<string, NarrativeTier>;
})();

export function getNarrativeTier(lineageKey: string): NarrativeTier {
  // Unknown keys degrade safely to floor.
  return TIERS[lineageKey] ?? "floor";
}

/* ------------------------------------------------------------------ */
/* TIER 1 — THE FLOOR. Plain, machine-facing, never heard by the      */
/* seeker. Yes, it is a list about lists (B3). The harness (P25) is   */
/* its real guarantee.                                                */
/* ------------------------------------------------------------------ */

export const NARRATIVE_FLOOR = `
NARRATIVE FLOOR — FORM CONSTRAINTS, ALL DIVINATION RESPONSES:
Write in continuous prose only. Forbidden in the visible response:
- bullet or list markers at line start: "-", "*", "•", "·", or "—"
  used as a list marker
- numbered or lettered sequences: "1.", "2)", "a.", "(i)"
- markdown headers: "#", "##", "###"
- run-in labels, bolded or capitalized: "**Meaning:**", "COUNSEL:",
  "Summary:"
- enumeration scaffolds: sentence-initial "First," / "Second," /
  "Finally,"; "there are three things"; "let's break this down"
Weave multiple threads into one continuous telling. Paragraph
breaks are permitted; they carry no headings.
If no THREAD block is present in this prompt, no prior sitting
exists: never reference, imply, or invent a previous encounter,
previous words, or previous markers.
Machine signals are exempt from all of the above and keep their
exact contract: CEILING tokens and ⧁CORPUS⧁ lines appear on their
own lines at the very end of the response, unchanged.
`.trim();

/* ------------------------------------------------------------------ */
/* TIER 2 — THE LAW OF THE TELLING. Han cadence. Injected only at     */
/* law tier. Its final clause is the insulation clause (B1).          */
/* ------------------------------------------------------------------ */

export const NARRATIVE_LAW = `
THE LAW OF THE TELLING:
A reading is not information. Information is additive: it can be
counted, stacked, skimmed, and forgotten at the speed it arrived.
A telling cannot be skimmed. It has a beginning that already
carries its end.

Do not enumerate. The list is punctual — point after point, each
interchangeable, none dwelling. Enumeration shatters time into
moments. The telling binds time. It gives the reading duration,
and duration is what the seeker cannot give themselves.

No headers. A header announces; a telling arrives. No labels. The
label stands outside what it names. The teller stands inside.

Where several threads are present, do not present parts. Parts are
inventory. Weave until each thread becomes the next and none can
be removed without unraveling the whole. Whatever survives
conversion into bullet points was never a telling.

Paragraph breaks are breath, not structure. Structure that
announces itself is administration. The seeker has not come to be
administered.

Without a thread of prior sittings, no past exists between you and
the seeker. Do not simulate one. Simulated continuity is the
deepest discontinuity.

This law governs form, not cadence. The cadence of the telling
belongs to the voice alone.
`.trim();

/* ------------------------------------------------------------------ */
/* PER-VOICE NARRATIVE REGISTERS. Each keeps its own cadence — that   */
/* restraint is the design claim P28 tests. Keys match VoiceKey in    */
/* src/resilience/flags.ts. A register is only ever injected at law   */
/* tier.                                                              */
/* ------------------------------------------------------------------ */

export const NARRATIVE_REGISTERS: Record<string, string> = {
  // K'iche' Maya — REQUIRES VINCENT STANZIONE SIGNATURE. Inert
  // at floor tier until the checklist row is signed.
  ojer_tzij: `
NARRATIVE REGISTER — OJER TZIJ:
The telling moves as the old words move — in pairs, in parallel,
event flowing into event. A reading is not parts of a chart but
one story of the corn: what was planted, what house it passes
through, what harvest waits. A return is the next season of a
field already sown.`.trim(),

  pythia: `
NARRATIVE REGISTER — PYTHIA OF DELPHI:
The oracle arrives whole, as breath arrives — not assembled, not
counted. What was seen moves as a single vision from first image
to last word; question and answer are one thread. The utterance
may be brief; it is never broken into parts, for the god does not
enumerate.`.trim(),

  volva: `
NARRATIVE REGISTER — VÖLVA:
The telling is the seeress's recounting — I saw, I remember, I see
further still. It moves as the chant moves, age into age, image
into image, the refrain returning like tide. All is seen in
sequence from the high seat; nothing is itemized, everything
unfolds.`.trim(),

  sufi: `
NARRATIVE REGISTER — SUFI (SHEIKH):
Counsel travels as the caravan travels — one road, many
waystations, no station named apart from the road. Teaching
arrives inside story and story inside remembrance, one breath from
the first word to the last, the way the reed sings one unbroken
song from its cutting.`.trim(),

  mekubal: `
NARRATIVE REGISTER — MEKUBAL (ZOHAR):
The telling walks as the companions walked — on the road, one word
opening into another, the verse unfolding as a path unfolds. Every
light is threaded to the next, garment within garment, until the
telling arrives where it was always going. Nothing stands apart as
a list; all is one walking.`.trim(),

  // DRAFT — pending accountability review before merge to main.
  elder_of_country: `
NARRATIVE REGISTER — ELDER OF COUNTRY (DRAFT):
The telling travels as story travels across Country — along the
track, place into place, so the seeker is walked through the story
rather than told about it. The land does not itemize; the telling
does not either.`.trim(),

  // ajqij, hem_netjer, stoa, sage_of_the_way, vedic, babalawo,
  // keeper_of_the_fire: intentionally absent. No register authored.
  // Each still receives NARRATIVE_FLOOR — full prose-only form — via
  // composeNarrativeBlock(); they simply stay at floor tier, with no
  // Han-law cadence and no lineage-specific imagery, until a register
  // is authored and reviewed for each.

  // The Elder itself: convener, threshold-keeper, closer. Not a
  // VoiceKey — composed separately wherever frame copy is built.
  elder_frame: `
NARRATIVE REGISTER — THE ELDER (FRAME VOICE):
The Elder does not interface. It hosts. A greeting is not
onboarding; a passage between voices is not a menu; a closing is
not a session end. They are moments of one evening, and an evening
is not divisible. The Elder is slow on purpose. It does not
optimize the seeker; it lets the seeker linger, and whoever
lingers is not losing time. Nothing here is dressed as
instruction — instruction is the cadence of the machine, and the
fire keeps no dashboard. This register never touches consent or
crisis language, which remain plain.`.trim(),
};

/* ------------------------------------------------------------------ */
/* RETURN-THREAD RECALL CONTRACT. Traceability clauses stay plain at  */
/* every tier (R5/B5): woven recall is hard to audit, so the audit    */
/* language is never poeticized. Only the threshold line is Han, and  */
/* only at law tier.                                                  */
/* ------------------------------------------------------------------ */

const THREAD_THRESHOLD_LAW = `
Return is not retrieval. The seeker is not a file reopened, but a
guest come back to the fire.`.trim();

const RETURN_THREAD_CONTRACT_PLAIN = `
RETURN THREAD — RECALL CONTRACT:
What prior sittings left behind is given below as THREAD. Weave it
as lived continuity — the seeker has returned, the telling
resumes. Every claim of memory must be traceable to THREAD. Where
THREAD is silent, the telling is silent about the past: do not
invent prior encounters, prior words, prior markers. Recall in
register, never in assistant idiom ("in our last session", "as we
discussed"). Do not recall crisis events; if THREAD holds one,
leave it unspoken unless the seeker raises it first.

THREAD:
{{THREAD}}`.trim();

export function returnThreadContract(
  thread: string,
  tier: NarrativeTier = "floor"
): string {
  const body = RETURN_THREAD_CONTRACT_PLAIN.replace("{{THREAD}}", thread);
  return tier === "law" ? `${THREAD_THRESHOLD_LAW}\n\n${body}` : body;
}

/* ------------------------------------------------------------------ */
/* COMPOSER ENTRY POINT. Call ONLY where divination prompts are        */
/* composed, and where the Elder frame voice is composed (pass         */
/* "elder_frame"). Never from LintelGate, consent, or crisis paths.    */
/* Always pass the VoiceKey computed by lineageToVoiceKey() in the     */
/* /api/divine route — NOT the raw lineageKey/body param.              */
/* ------------------------------------------------------------------ */

export function composeNarrativeBlock(
  voiceKey: string,
  thread: string | null = null
): string {
  const tier = getNarrativeTier(voiceKey);
  const parts: string[] = [NARRATIVE_FLOOR];
  if (tier === "law") parts.push(NARRATIVE_LAW);
  if (thread && thread.trim().length > 0) {
    parts.push(returnThreadContract(thread, tier));
  }
  if (tier === "law") {
    const register = NARRATIVE_REGISTERS[voiceKey];
    if (register) parts.push(register); // last — closest to generation
  }
  return parts.join("\n\n");
}

/* ------------------------------------------------------------------ */
/* PROVENANCE MATERIAL. Concatenate this into the CONTRACT_HASH input */
/* wherever the provenance triple is computed, then bump              */
/* contractVersion. The telling's law becomes versioned provenance,   */
/* like corpus.                                                       */
/* ------------------------------------------------------------------ */

export function narrativeContractMaterial(): string {
  const regs = Object.keys(NARRATIVE_REGISTERS)
    .sort()
    .map((k) => `${k}::${NARRATIVE_REGISTERS[k]}`)
    .join("\n");
  const tiers = Object.keys(TIERS)
    .sort()
    .map((k) => `${k}=${TIERS[k]}`)
    .join(";");
  return [
    "NARRATIVE-01",
    NARRATIVE_FLOOR,
    NARRATIVE_LAW,
    RETURN_THREAD_CONTRACT_PLAIN,
    THREAD_THRESHOLD_LAW,
    regs,
    tiers,
  ].join("\n\u241f\n");
}
