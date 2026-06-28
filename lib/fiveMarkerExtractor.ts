/**
 * fiveMarkerExtractor.ts — Five-marker diagnosis extractor.
 * Constitutional principle: query built from diagnosis signals,
 * never from the seeker's literal words. The seeker's words are private.
 */

export interface FiveMarkers {
  wound:     boolean;
  figure:    boolean;
  threshold: boolean;
  exile:     boolean;
  pattern:   boolean;
}

type Message = { role: 'user' | 'assistant'; content: string };

const WOUND_SIGNALS = [
  'loss','grief','failure','broken','abandoned','hurt','pain','wound',
  'never healed','keeps happening','recurring','always ends','every time',
  'same thing','again and again','never works','lost','taken','destroyed',
  'cost me','gave up','left behind',
];
const FIGURE_SIGNALS = [
  'mother','father','parent','boss','authority','teacher','partner',
  'always someone','type of person','kind of person','reminds me',
  'like my','just like','same as','who controls','who leaves',
  'who disappears','who crushes','who demands','force','presence',
  'the one who','they always',
];
const THRESHOLD_SIGNALS = [
  'stuck','blocked','door','crossing','decision',
  'standing before','cannot move','paralyzed','frozen','edge',
  'brink','point of no return','about to','moment of','choice',
  'what i need to do','what i must','what is required','cannot face',
  'unable to','threshold','what stops me','wall',
];
const EXILE_SIGNALS = [
  'hidden','secret','ashamed','never told','disowned',
  'part of me','pushed away','rejected','cast out','suppressed',
  'buried','never let myself','not allowed','forbidden to','cut off',
  'exile','banished','what i hide','what nobody knows','dark side',
  'shadow','unacceptable','too much','cannot admit',
];
const PATTERN_SIGNALS = [
  'always','every relationship','every job','same pattern','repeating',
  'cycle','over and over','history repeats','story of my life',
  'keeps coming back','never changes','same mistake','familiar',
  'recognize this','been here before','thread through','runs through',
  'my whole life','since childhood','as long as i can remember',
];

function scoreMarker(text: string, signals: string[]): boolean {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const signal of signals) {
    if (lower.includes(signal)) hits++;
    if (hits >= 2) return true;
  }
  return hits >= 1;
}

export function extractFiveMarkers(messages: Message[]): FiveMarkers {
  const userText   = messages.filter(m => m.role === 'user').map(m => m.content).join(' ');
  const assistText = messages.filter(m => m.role === 'assistant').map(m => m.content).join(' ');
  const fullText   = userText + ' ' + assistText + ' ' + assistText;
  return {
    wound:     scoreMarker(fullText, WOUND_SIGNALS),
    figure:    scoreMarker(fullText, FIGURE_SIGNALS),
    threshold: scoreMarker(fullText, THRESHOLD_SIGNALS),
    exile:     scoreMarker(fullText, EXILE_SIGNALS),
    pattern:   scoreMarker(fullText, PATTERN_SIGNALS),
  };
}

export function buildRetrievalQuery(
  markers: FiveMarkers,
  _lineageKey: string,
  cruzContext?: string
): string {
  const parts: string[] = [];
  if (markers.wound)     parts.push('recurring wound loss grief descent into darkness suffering');
  if (markers.figure)    parts.push('antagonist shadow figure authority force that dominates or abandons');
  if (markers.threshold) parts.push('threshold crossing liminal passage doorway between worlds initiation ordeal');
  if (markers.exile)     parts.push('exile banishment hidden self disowned part shadow integration return');
  if (markers.pattern)   parts.push('repeating cycle mythic pattern fate destiny ancestral thread');
  if (parts.length === 0) parts.push('mythic journey soul seeking meaning threshold transformation');
  const cruzPrefix = cruzContext ? cruzContext + ' ' : '';
  return cruzPrefix + parts.join(' ');
}

export function markersToRecord(markers: FiveMarkers): Record<string, boolean> {
  return { ...markers };
}
