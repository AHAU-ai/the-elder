// lib/returning/letterOutcomeContext.ts
//
// Brainstorm item #5, full pass: "the report becomes something the next
// reading can honestly draw on." A seeker who reported what came of a
// kept gift (LetterReportForm.tsx, migration 034) previously had that
// report saved and then never referenced anywhere else — a real
// consequence loop only on the read side (RecallLetter/ThresholdLetters
// show the report back to the seeker who wrote it), never on the SPEAK
// side. This closes that: the same restrained, seeker-ratified-words-only
// discipline trajectoryContext.ts already applies to recurring markers,
// applied here to outcome reports instead.
//
// Gated on the exact same trajectoryEnabled() flag as trajectoryContext.ts
// -- not a new, separately-invented gate. The governance reasoning is
// identical (speaking a seeker's own material back to them, across
// visits, is the thing Appendix B / the marker-confirmation mechanism
// were built to bound), so this rides the same flag rather than adding a
// second one that could drift out of sync with it.
import { trajectoryEnabled } from '@/config/returning-features';
import { getLetterOutcomeReports } from '../guidedJournalLedger';

const MAX_REPORTS_SPOKEN = 2;
const MAX_REPORT_CHARS = 240;

function sanitize(v: string): string {
  return v
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, MAX_REPORT_CHARS);
}

/**
 * Compact, capped block of this seeker's own letter-outcome reports, for
 * buildSystemPrompt's letterOutcomeContext parameter. '' when there is
 * nothing that may honestly be spoken -- same fail-silent contract as
 * buildTrajectoryContext (never throws, a failure here must never break
 * a Reading).
 */
export async function buildLetterOutcomeContext(userId: number): Promise<string> {
  try {
    if (!trajectoryEnabled()) return '';

    const reports = await getLetterOutcomeReports(userId);
    if (reports.length === 0) return '';

    const lines = reports.slice(0, MAX_REPORTS_SPOKEN).map((r) => {
      const text = sanitize(r.response);
      if (!text) return '';
      return `- in the ${r.lineageKey} field, this seeker reported back: "${text}"`;
    }).filter(Boolean);
    if (lines.length === 0) return '';

    return lines.join('\n');
  } catch {
    return '';
  }
}
