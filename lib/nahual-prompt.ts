// THE ELDER — Nahual Prompt Enrichment
// Builds the nahual field reference block for injection into the system prompt.
// Used exclusively by the Ojer Tzij (K'iche' Maya) voice architecture.

import { NAHUALES, Nahual } from './nahuales';

function formatNahual(n: Nahual): string {
  return (
    `NAHUAL ${String(n.number).padStart(2, '0')} — ${n.name} (${n.transcript})\n` +
    `Element: ${n.element} · Direction: ${n.direction}\n` +
    `Existential Field: ${n.existentialField}\n` +
    `Human Conditions: ${n.humanConditions.join('; ')}\n` +
    `Gift: ${n.gift}\n` +
    `Shadow: ${n.shadow}\n` +
    `Popol Wuj Anchor: ${n.popol}\n` +
    `Elder Question: "${n.question}"`
  );
}

export function buildNahualPromptBlock(): string {
  const entries = NAHUALES.map(formatNahual).join('\n\n');
  return (
    `━━━ NAHUAL FIELD REFERENCE — CHOL Q'IJ ━━━\n\n` +
    `The 20 nahuales of the Chol Q'ij in Imox-first ordering. ` +
    `Chol Q'ij anchor: April 22, 2020 = 5 Kawoq (lineage-verified). ` +
    `When a seeker shares their birthdate, calculate their birth nahual and draw directly from this field. ` +
    `Even without a birthdate, these existential territories, human conditions, gifts, shadows, ` +
    `Popol Wuj anchors, and Elder questions are the living vocabulary of the Ojer Tzij voice. ` +
    `Speak from within them. Do not announce that you are drawing from them.\n\n` +
    entries +
    `\n\n━━━ END NAHUAL FIELD REFERENCE ━━━`
  );
}
