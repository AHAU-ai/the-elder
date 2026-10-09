/**
 * lib/fireside/ember/alt.ts
 *
 * Alt text for the sigil. It describes the GEOMETRY only: counts of rings and marks,
 * the motif, a gap, small dots, the size of the core. It never says what the sitting
 * felt like, and it says plainly that the sigil is not an omen.
 */
import type { EmberMotif, EmberProfile } from './profile';

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen'];
const word = (n: number) => WORDS[n] ?? String(n);

const MOTIF_PHRASE: Record<EmberMotif, string> = {
  spiral: 'short arcs winding outward in a spiral',
  rays: 'straight rays spreading from the centre',
  lattice: 'small crosses in a loose lattice',
  petals: 'petal shapes ringed around the centre',
  arcs: 'short arcs at varied distances',
  knot: 'small diamonds scattered in a knot',
};

export const SIGIL_DISCLAIMER = 'It records the shape of a sitting, not what it meant, and it is not an omen.';

export function describeSigil(p: EmberProfile): string {
  const rings = 1 + p.durationBand;
  const marks = 6 + p.segmentBand * 3;
  const gap = ['', ' with a small gap in each ring', ' with a gap in each ring', ' with a wide gap in each ring'][p.silenceBand];
  const dots = p.reactionBands[0] + p.reactionBands[1] + p.reactionBands[2];
  const core = ['a small', 'a modest', 'a medium', 'a large'][p.depthStage];
  const dotPhrase = dots > 0 ? `, ${word(dots)} small dot${dots === 1 ? '' : 's'} near the centre` : '';
  return `A sigil of this sitting: ${word(rings)} ring${rings === 1 ? '' : 's'}${gap}, ${word(marks)} marks as ${MOTIF_PHRASE[p.motif]}${dotPhrase}, and ${core} glowing core. ${SIGIL_DISCLAIMER}`;
}
