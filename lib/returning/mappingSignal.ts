// lib/returning/mappingSignal.ts
//
// Pure parse, strip and validate for the MAPPING_OFFER signal (Figure
// Continuity; docs/figure-continuity-spec.md v0.2, section 5, guard G13).
// No I/O, no model, no database, so it is testable with hostile input alone.
//
// The signal rides the route's existing sentinel family: the model may end a
// segment with one line,
//     <U+29C1>MAPPING_OFFER:{"kind":...,"subject":...,"counterpart":...,"basis":...}<U+29C1>
// like the READY, CEILING and MYTH tokens in app/api/divine/route.ts.
//
// Two jobs, deliberately separate:
//   1. STRIP: every trace of the signal is removed from the visible text, in
//      every shape the model might emit it (delimited, unterminated, cut short
//      by a stray delimiter, missing its delimiters, repeated, mid-text). This
//      happens whether or not the offer is honored, and before the dual
//      guardian sees the text. Every occurrence goes (the 2026-08-20 CEILING
//      bug: a non-global replace left the second token behind to leak).
//   2. VALIDATE: the first signal is parsed as JSON and checked field by field.
//      Anything wrong means no offer; the prose stands on its own. Labels are
//      model output that is stored and later re-fed to the model, and the dual
//      guardian never sees them, so they are cleaned, bounded and screened here.
//
// The scan is linear (indexOf, no nested quantifiers), so adversarial text
// cannot trigger catastrophic backtracking. The delimiter is built from its
// code point so no escape sequence or raw special character lives in this source.

import {
  sanitizeLabel,
  SUBJECT_LABEL_MAX,
  COUNTERPART_LABEL_MAX,
} from './figureMappingLabels';

const D = String.fromCharCode(0x29c1);
const OPEN = D + 'MAPPING_OFFER:';

// Anything still naming the tag once the delimited signals are gone: a signal
// missing its delimiters, or a re-cased or spaced variant. The whole line goes,
// so no half-signal reaches the seeker.
const RESIDUAL_LINE = /^.*MAPPING[_\s-]?OFFER.*$/gim;

/** A payload larger than this is not a plausible offer; refuse before parsing. */
const PAYLOAD_MAX_CHARS = 600;

export interface ParsedMappingOffer {
  kind: 'person' | 'situation';
  subject: string;
  counterpart: string;
  /** What the model CLAIMED. Advisory only: the server decides the real basis. */
  claimedBasis: 'corpus' | 'model';
}

export interface ExtractedMappingOffer {
  /** The text with every trace of the signal removed. Identical to the input if none was present. */
  text: string;
  /** The first signal, validated; null if there was none or it failed any check. */
  offer: ParsedMappingOffer | null;
  /** How many signals were present, valid or not (extras are ignored and stripped). */
  signalCount: number;
}

// Coarse screens on model-authored labels (G13). They are a backstop, not the
// defense: the clause forbids these moves and the red-team probes (P1, P3,
// P10) test the model's behavior. Over-blocking is the safe direction: a
// refused offer costs the seeker one pairing; a stored one is re-fed forever.
const INSTRUCTION_LIKE: RegExp[] = [
  /\b(ignore|disregard|forget|override|bypass)\b.{0,60}\b(instruction|prompt|rule|directive|guideline|polic)/i,
  /\b(system|developer)\s*(prompt|message|instruction|:)/i,
  /\byou are now\b/i,
  /\b(assistant|system|user)\s*:/i,
  /\b(jailbreak|prompt injection)\b/i,
  /<\s*\/?\s*[a-z][^>]*>/i,
];
// Casting a person as a figure of ruin is the one thing the clause forbids on
// the counterpart side (rule 6). Applied to the counterpart only.
const VILLAIN_COUNTERPART = /\b(villain\w*|monster\w*|demon\w*|devil\w*|fiend\w*|evil|wicked)\b/i;

function cleanLabel(raw: unknown, max: number): string | null {
  const label = sanitizeLabel(raw, max);
  if (!label) return null;
  if (INSTRUCTION_LIKE.some(re => re.test(label))) return null;
  return label;
}

function parsePayload(payload: string): ParsedMappingOffer | null {
  if (payload.length > PAYLOAD_MAX_CHARS) return null;
  let obj: unknown;
  try {
    obj = JSON.parse(payload.trim());
  } catch {
    return null;
  }
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const o = obj as Record<string, unknown>;
  if (o.kind !== 'person' && o.kind !== 'situation') return null;
  if (o.basis !== 'corpus' && o.basis !== 'model') return null;
  const subject = cleanLabel(o.subject, SUBJECT_LABEL_MAX);
  const counterpart = cleanLabel(o.counterpart, COUNTERPART_LABEL_MAX);
  if (!subject || !counterpart) return null;
  if (VILLAIN_COUNTERPART.test(counterpart)) return null;
  return { kind: o.kind, subject, counterpart, claimedBasis: o.basis };
}

/**
 * Strip every trace of the signal from `raw` and validate the first one.
 * Safe to call on any text, with the feature on or off; text containing no
 * signal comes back unchanged.
 */
export function extractMappingOffer(raw: string): ExtractedMappingOffer {
  if (typeof raw !== 'string' || !/MAPPING[_\s-]?OFFER/i.test(raw)) {
    return { text: typeof raw === 'string' ? raw : '', offer: null, signalCount: 0 };
  }
  // A linear scan, so a malformed signal cannot leave a JSON fragment on
  // screen. For each opening, find the next delimiter. If the payload between
  // them is a complete object (ends in "}"), remove exactly the signal. If it
  // is not (an unterminated signal, or a stray delimiter inside the payload cut
  // it short), remove the rest of the line too, because whatever follows is the
  // remainder of the payload.
  const payloads: string[] = [];
  let kept = '';
  let i = 0;
  const endOfLine = (from: number) => {
    const n = raw.indexOf('\n', from);
    return n < 0 ? raw.length : n;
  };
  for (;;) {
    const at = raw.indexOf(OPEN, i);
    if (at < 0) {
      kept += raw.slice(i);
      break;
    }
    kept += raw.slice(i, at);
    const start = at + OPEN.length;
    const close = raw.indexOf(D, start);
    if (close < 0) {
      payloads.push(raw.slice(start, endOfLine(start)));
      i = endOfLine(start);
      continue;
    }
    const payload = raw.slice(start, close);
    payloads.push(payload);
    i = payload.trim().endsWith('}') ? close + 1 : endOfLine(close);
  }
  let text = kept.replace(RESIDUAL_LINE, '');
  // Tidy only what removal leaves behind: runs of blank lines and trailing space.
  text = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trimEnd();
  return {
    text,
    offer: payloads.length > 0 ? parsePayload(payloads[0]) : null,
    signalCount: payloads.length,
  };
}
