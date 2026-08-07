// lib/returning/trajectoryContext.ts
//
// The SPEAK side of Axis 2 (marker trajectory). Everything below the
// MIN_APPEARANCES_TO_SURFACE floor stays silent; everything returned here
// is the seeker's own confirmed material — no tradition's lore, no model
// inference, no counts. Returns '' (and never throws) unless every
// governance gate in trajectoryEnabled() is met AND this seeker has
// floor-crossed markers. A failure here must never break a Reading —
// same contract as the ledger writes in /api/divine.
//
// Values were confirmed or reshaped by the seeker, then stored — they are
// still treated as untrusted text on the way into a prompt: control
// characters stripped, hard length caps per value and per block.
import { trajectoryEnabled } from '@/config/returning-features';
import {
  getTrajectoryMarkers,
  getMarkerCooccurrences,
} from './markerTrajectory';

const MAX_THREADS_SPOKEN = 5;
const MAX_PAIRS_SPOKEN = 3;
const MAX_VALUE_CHARS = 120;

// Maps the app's supported languageName values (from divine's VALID set) to
// BCP 47 locale tags for Intl.DateTimeFormat. K'iche' Maya has no standard
// BCP 47 tag — es-GT is the closest registered locale and produces Spanish
// month names, which is the most recognizable approximation for that language
// community. Falls through to 'en-US' for any unrecognised value.
const LANGUAGE_TO_LOCALE: Record<string, string> = {
  'English': 'en-US',
  'Spanish': 'es',
  "K\u2019iche\u2019 Maya": 'es-GT',
  'French': 'fr',
  'Portuguese': 'pt',
  'German': 'de',
  'Danish': 'da',
  'Dutch': 'nl',
  'Japanese': 'ja',
  'Simplified Chinese': 'zh-Hans',
};

function sanitize(v: string): string {
  return v
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, MAX_VALUE_CHARS);
}

function monthYear(iso: string, locale: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(d);
  } catch {
    return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(d);
  }
}

/**
 * Compact, capped block of this seeker's floor-crossed confirmed threads,
 * for buildSystemPrompt's trajectoryContext parameter. '' when there is
 * nothing that may honestly be spoken.
 */
export async function buildTrajectoryContext(
  userId: number,
  languageName: string = 'English'
): Promise<string> {
  try {
    if (!trajectoryEnabled()) return '';

    const locale = LANGUAGE_TO_LOCALE[languageName] ?? 'en-US';
    const markers = await getTrajectoryMarkers(userId);
    if (markers.length === 0) return '';

    const lines = markers.slice(0, MAX_THREADS_SPOKEN).map((m) => {
      const since = monthYear(m.firstSeen, locale);
      const value = sanitize(m.markerValue);
      if (!value) return '';
      return `- ${m.markerType}: "${value}"${since ? ` — returning since ${since}` : ''}`;
    }).filter(Boolean);
    if (lines.length === 0) return '';

    let pairLines: string[] = [];
    try {
      const pairs = await getMarkerCooccurrences(userId);
      pairLines = pairs.slice(0, MAX_PAIRS_SPOKEN).map((p) => {
        const a = sanitize(p.a.markerValue);
        const b = sanitize(p.b.markerValue);
        if (!a || !b) return '';
        return `- "${a}" and "${b}" have arrived within the same reading`;
      }).filter(Boolean);
    } catch {
      // Pairs are an optional grace — never block the thread list on them.
    }

    return [
      ...lines,
      ...(pairLines.length
        ? ['', 'Threads that have arrived together:', ...pairLines]
        : []),
    ].join('\n');
  } catch {
    return '';
  }
}
