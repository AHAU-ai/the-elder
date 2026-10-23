// lib/corpusMarker.ts
//
// The K'iche' voice's generation contract has the model end a Reading with a
// `<delim>CORPUS:arc_id:passage_label<delim>` self-report line (lib/lineages.ts).
// It is a machine line, "stripped before display" (lib/narrativeForm.ts), but
// app/api/divine/route.ts removed READY, MORE, CEILING and MYTH and not this one,
// so it reached the seeker's screen. Pure and dependency-free so it is testable
// on its own. The delimiter is built from its code point, never typed.

const D = String.fromCharCode(0x29c1);
const CORPUS_MARKER = new RegExp(D + 'CORPUS:[^' + D + ']*' + D, 'g');

/** Remove every complete CORPUS marker from a response. Anything else, including other delimiters, is left alone. */
export function stripCorpusMarker(text: string): string {
  return text.replace(CORPUS_MARKER, '');
}
