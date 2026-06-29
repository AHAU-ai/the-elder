// lib/returning/gates.ts
//
// Wires the returning-visitor invoke route into the repo's REAL safety systems:
//   - checkConsent()  from @/lib/consentLedger   (fails closed)
//   - assessWelfare() from @/lib/welfareGate      (model-primary + lexical floor)
// No placeholder logic. The Elder voice key is 'ojer_tzij'.

import Anthropic from "@anthropic-ai/sdk";
import { WELFARE_MODEL } from "@/lib/model.config";
import { assessWelfare } from "@/lib/welfareGate";
import type { ModelJudge, WelfareAssessment } from "@/lib/welfareGate";
import { checkConsent } from "@/lib/consentLedger";

export const ELDER_VOICE_KEY = "ojer_tzij";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * The welfare judge callback, built to match the divine route's pattern:
 * a ModelJudge runs the WELFARE_MODEL on (systemPrompt, userText) and returns
 * raw text; assessWelfare() parses + applies the lexical floor internally.
 *
 * NOTE: confirm this matches app/api/divine/route.ts's welfareJudge construction
 * (lines ~120-185). If divine builds it differently, copy that verbatim.
 */
export const welfareJudge: ModelJudge = async (judgeSystem: string, judgeUser: string) => {
  // Matches app/api/divine/route.ts verbatim.
  const res = await anthropic.messages.create({
    model: WELFARE_MODEL,
    max_tokens: 64,
    system: judgeSystem,
    messages: [{ role: "user", content: judgeUser }],
  });
  const b = res.content.find((x) => x.type === "text");
  return b && "text" in b ? b.text : "";
};

export async function consentAllowed(): Promise<boolean> {
  const r = await checkConsent(ELDER_VOICE_KEY);
  return r.allowed;
}

export async function assessOffering(offering: string): Promise<WelfareAssessment> {
  // Mirrors divine route line 183: fire on raw user input before prompt assembly.
  return assessWelfare(offering ?? "", welfareJudge);
}
