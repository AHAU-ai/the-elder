// lib/returning/echoedNames.ts
//
// Figure Continuity clause rule 2: refer to people by the role the seeker uses ("your sister"); never repeat a
// name. The clause asks; this makes it true. The model sometimes repeats a name while declining to use it ("I will
// not name Maria Gonzalez as a character"), which probes P12 caught in two independent runs, so the text that
// leaves the route is scrubbed deterministically when Figure Continuity is active.
//
// What counts as a name is deliberately narrow, to avoid scrubbing the tradition's own words: a capitalized
// sequence the seeker introduced as a person, i.e. directly after a relation word ("my sister Maria Gonzalez
// Lopez", "his boss Dana") or after "named" / "called". A name the seeker never tied to a person ("I told Maria
// off") is NOT caught; that is a known limit, recorded in docs/figure-continuity-governance.md, and the clause and
// the probes remain the first defense. Matching in the response is case-SENSITIVE (a name "Mark" must not scrub
// the word "mark"), and tokens that belong to the figure or the myth are protected.
//
// Pure module: no I/O, no imports. The text is plain ASCII; the one non-ASCII character (a right single quote) is
// built from its code point.

const RELATIONS = [
  'sister', 'brother', 'mother', 'mom', 'mum', 'father', 'dad', 'aunt', 'uncle', 'cousin', 'grandmother',
  'grandfather', 'grandma', 'grandpa', 'friend', 'boss', 'manager', 'supervisor', 'coworker', 'co-worker',
  'colleague', 'partner', 'husband', 'wife', 'ex', 'son', 'daughter', 'niece', 'nephew', 'teacher', 'neighbor',
  'neighbour', 'roommate', 'boyfriend', 'girlfriend', 'landlord', 'landlady', 'stepmother', 'stepfather',
  'sponsor', 'therapist', 'doctor',
];

const B = String.fromCharCode(92); // backslash, so no escape sequence has to survive any tooling
const APOS = "'" + String.fromCharCode(0x2019);
const NAME_WORD = new RegExp('^' + B + 'p{Lu}[' + B + 'p{L}' + APOS + '-]*' + B + 'p{L}', 'u');
const PARTICLES = new Set(['de', 'del', 'della', 'di', 'da', 'la', 'le', 'van', 'von', 'der', 'den', 'bin', 'ibn', 'al', 'el', 'dos', 'das', 'do']);
const MAX_NAME_WORDS = 4;

export interface NameCandidate {
  /** The name as the seeker wrote it, words joined by single spaces. */
  full: string;
  /** What to say instead: "your sister" from a relation word, "this person" otherwise. */
  role: string;
}

const RELATION_LEAD = new RegExp('(?:^|[^' + B + 'p{L}])(?:my|our|his|her|their|your|the)' + B + 's+(' + RELATIONS.map(r => r.replace('-', '[-]')).join('|') + ')' + B + 's+', 'giu');
const NAMED_LEAD = new RegExp('(?:^|[^' + B + 'p{L}])(?:named|called)' + B + 's+', 'giu');

/** Read up to MAX_NAME_WORDS capitalized words (with lowercase particles between) starting at `from`; null if none. */
function readName(text: string, from: number): string | null {
  const words: string[] = [];
  let i = from;
  while (words.length < MAX_NAME_WORDS) {
    const m = /^[^\s]+/.exec(text.slice(i));
    if (!m) break;
    const token = m[0].replace(new RegExp('[.,;:!?)' + B + ']"' + String.fromCharCode(0x201d) + String.fromCharCode(0x2019) + ']+$'), '');
    if (NAME_WORD.test(token)) {
      words.push(token);
      i += m[0].length;
    } else if (words.length > 0 && PARTICLES.has(token)) {
      // particles ("de la", "van der") are only part of the name when a capitalized word follows them
      const run = [token];
      let rest = text.slice(i + m[0].length).replace(/^\s+/, '');
      let next = /^[^\s]+/.exec(rest);
      while (next && PARTICLES.has(next[0])) {
        run.push(next[0]);
        rest = rest.slice(next[0].length).replace(/^\s+/, '');
        next = /^[^\s]+/.exec(rest);
      }
      if (!next || !NAME_WORD.test(next[0])) break;
      words.push(...run);
      i = text.length - rest.length;
      continue;
    } else {
      break;
    }
    const ws = /^\s+/.exec(text.slice(i));
    if (!ws) break;
    i += ws[0].length;
    // a trailing sentence mark ended the name already
    if (/[.,;:!?]$/.test(m[0])) break;
  }
  while (words.length > 0 && PARTICLES.has(words[words.length - 1])) words.pop();
  if (words.length === 0) return null;
  return words.join(' ').replace(new RegExp('[.,;:!?)' + B + ']"' + String.fromCharCode(0x201d) + ']+$'), '');
}

/** Names the seeker introduced as people, across all their messages. */
export function nameCandidates(userTexts: string[]): NameCandidate[] {
  const found = new Map<string, NameCandidate>();
  for (const text of userTexts) {
    for (const m of text.matchAll(RELATION_LEAD)) {
      const at = (m.index ?? 0) + m[0].length;
      const name = readName(text, at);
      if (name && !found.has(name)) found.set(name, { full: name, role: `your ${m[1].toLowerCase()}` });
    }
    for (const m of text.matchAll(NAMED_LEAD)) {
      const at = (m.index ?? 0) + m[0].length;
      const name = readName(text, at);
      if (name && !found.has(name)) found.set(name, { full: name, role: 'this person' });
    }
  }
  return [...found.values()];
}

function escapeRe(s: string): string {
  return s.replace(new RegExp('[.*+?^${}()|[' + B + ']' + B + B + ']', 'g'), B + '$&');
}

function replacement(text: string, offset: number, role: string): string {
  const before = text.slice(0, offset).replace(/\s+$/, '');
  const startsSentence = before.length === 0 || /[.!?]["'“‘(]*$/.test(before) || /\n\s*$/.test(text.slice(0, offset));
  return startsSentence ? role.charAt(0).toUpperCase() + role.slice(1) : role;
}

export interface ScrubResult { text: string; replaced: number }

/**
 * Replace every occurrence of a name the seeker gave, or any single part of it, with the role they used. `protect`
 * lists words that belong to the figure or the myth and are never scrubbed.
 */
export function scrubEchoedNames(text: string, userTexts: string[], protect: string[] = []): ScrubResult {
  const protectedWords = new Set(protect.flatMap(p => p.split(/\s+/)).map(w => w.toLowerCase()).filter(Boolean));
  let out = text;
  let replaced = 0;
  const candidates = nameCandidates(userTexts);
  const targets: Array<{ pattern: string; role: string }> = [];
  for (const c of candidates) {
    targets.push({ pattern: c.full.split(/\s+/).map(escapeRe).join(B + 's+'), role: c.role });
  }
  for (const c of candidates) {
    for (const part of c.full.split(/\s+/)) {
      if (part.length < 3 || PARTICLES.has(part) || protectedWords.has(part.toLowerCase())) continue;
      targets.push({ pattern: escapeRe(part), role: c.role });
    }
  }
  const skip = new Set(candidates.filter(c => c.full.split(/\s+/).every(p => protectedWords.has(p.toLowerCase()))).map(c => c.full));
  for (const t of targets) {
    const re = new RegExp('(?<![' + B + 'p{L}])' + t.pattern + '(?![' + B + 'p{L}])', 'gu');
    out = out.replace(re, (match: string, ...rest: unknown[]) => {
      if (skip.has(match)) return match;
      const offset = rest[rest.length - 2] as number;
      replaced++;
      return replacement(out, offset, t.role);
    });
  }
  return { text: out, replaced };
}
