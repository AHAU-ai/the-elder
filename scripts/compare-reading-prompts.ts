/**
 * compare-reading-prompts.ts — does the production prompt flatten the Reading?
 *
 * Runs ONE real seeker question through (A) the production system prompt for a
 * lineage, assembled by buildSystemPrompt exactly as /api/divine does for a
 * primary reading, and (B) a deliberately bare prompt, N times each, and prints
 * the results side by side as markdown. Read them blind: if B is clearly
 * better, the constraints are flattening the voice; if both are flat, the
 * problem is story material or the question.
 *
 *   npx tsx scripts/compare-reading-prompts.ts --dry
 *   ANTHROPIC_API_KEY=... npx tsx scripts/compare-reading-prompts.ts \
 *     --question "I have lost my way and I don't know what I am for." --n 3 > compare.md
 *   (add --model claude-sonnet-5-5 to try a newer model on the same question)
 *
 * --dry makes no API call: it prints prompt sizes only (safe offline).
 * NOT a governance check. Bare-prompt output is for comparison only and must
 * never be shown to a seeker. Needs a funded ANTHROPIC_API_KEY unless --dry.
 */
import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "../lib/system-prompt-builder";
import { PRIMARY_MODEL } from "../lib/model.config";

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : fallback;
};
const dry = process.argv.includes("--dry");
const question = arg("question", "I have lost my way and I don't know what I am for anymore.");
const lineage = arg("lineage", "maya");
const n = Math.max(1, Math.min(5, Number(arg("n", "3")) || 3));
// Defaults to production's model; pass --model to compare another (e.g. claude-sonnet-5-5).
const model = arg("model", PRIMARY_MODEL);

const production = buildSystemPrompt(lineage as never, false, true, "English");
const BARE =
  "You are an elder who tells the Popol Wuj episode that fits this person. " +
  "Be vivid, specific, and willing to say one surprising thing. " +
  "Speak in prose, 150-220 words, and end with one question.";

async function run(label: string, system: string, client: Anthropic) {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const res = await client.messages.create({
      model,
      max_tokens: 700,
      system,
      messages: [{ role: "user", content: question }],
    });
    const b = res.content.find((x) => x.type === "text");
    out.push(b && "text" in b ? b.text.trim() : "(no text)");
  }
  return `## ${label}\n\n` + out.map((t, i) => `### ${label} #${i + 1}  (${t.split(/\s+/).length} words)\n\n${t}\n`).join("\n");
}

async function main() {
  console.log(`# Prompt comparison\n\n- lineage: ${lineage}\n- question: ${question}\n- production prompt: ${production.length} chars (~${Math.round(production.length / 4)} tokens)\n- bare prompt: ${BARE.length} chars\n- model: ${model}\n`);
  if (dry) {
    console.log("(dry run: no API calls made)");
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set (use --dry for an offline run).");
    process.exit(1);
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  console.log(await run("A. Production prompt", production, client));
  console.log(await run("B. Bare prompt", BARE, client));
}
main().catch((e) => {
  console.error("comparison failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
