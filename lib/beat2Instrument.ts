// Beat-2 probing instrument: per-voice, re-derived from each tradition's own
// material (never a universal schema re-skinned per lineage — see the
// Lineage Integrity discussion this file's questions came out of).
//
// GOVERNANCE IS NOW CODE, NOT PROSE. lib/beat2VoiceStatus.ts's
// BEAT2_VOICE_REGISTRY is the single source of truth for what may exist
// here. This file enforces it at import time (see assertBeat2Invariants()
// below): a 'blocked' or 'hold' voice CANNOT carry a BEAT2_INSTRUMENTS
// entry, and BEAT2_REVIEWED_VOICES CANNOT include a voice whose registry
// status isn't 'reviewed' — either violation throws on module load,
// breaking `next dev`/`next build`/any importing test, not just a CI probe
// someone has to remember to run. scripts/check-beat2-instrument.mjs adds a
// second, independent static check (including cross-checking
// docs/beat2-instrument-voice-review.md's rendered table against this
// registry) for defense in depth, and is wired into gk-007.
//
// To enable a voice: (1) set its BEAT2_VOICE_REGISTRY record's status to
// 'reviewed' with reviewedBy + reviewedDate, in the same commit that
// records the actual review (Stanzione-track for ojer_tzij, self-review-
// against-corpus for the rest, mirroring reading-shape-voice-review.md's
// established split), THEN (2) add it to BEAT2_REVIEWED_VOICES below. Do
// either step without the other and the module refuses to load.
import { BEAT2_VOICE_REGISTRY, beat2VoiceStatus } from './beat2VoiceStatus';

export const BEAT2_REVIEWED_VOICES: ReadonlySet<string> = new Set<string>([
  // Empty: no voice has completed real review yet. ojer_tzij, stoa, and
  // sage_of_the_way are 'drafted' in the registry (see
  // lib/beat2VoiceStatus.ts) but not 'reviewed' — adding any of them here
  // without first flipping their registry status throws at import time.
]);

export function beat2InstrumentApplies(voiceKey: string): boolean {
  // Fail-closed on BOTH signals: the allowlist alone is no longer
  // sufficient. A voice must be in BEAT2_REVIEWED_VOICES AND carry a
  // registry status of 'reviewed' — either alone is not enough, so a
  // future edit that adds one without the other is inert, not half-live.
  return (
    BEAT2_REVIEWED_VOICES.has(voiceKey) &&
    beat2VoiceStatus(voiceKey)?.status === 'reviewed'
  );
}

export interface Beat2Question {
  readonly label: string; // internal only, never shown to the seeker
  readonly prompt: string;
}

// voiceKey -> ordered questions. Each voice's list is derived from that
// voice's own established theses/corpus, not from a shared category set.
// Order matters: questions are asked one per turn, in this sequence.
const BEAT2_INSTRUMENTS: Readonly<Record<string, readonly Beat2Question[]>> = {
  ojer_tzij: [
    {
      label: 'reciprocity',
      prompt:
        'What have you set down, or could you set down, as your own offering into what you\u2019ve just named?',
    },
    {
      label: 'the-house',
      prompt:
        'Whose house are the trials you are undergoing testing you in \u2014 and have you named it, or only felt its cold?',
    },
    {
      label: 'seed-in-the-skull',
      prompt:
        'Where has something in you already died and gone quiet \u2014 and what, unseen, might it already be putting forth?',
    },
    {
      label: 'entering-not-watching',
      prompt:
        'If you stepped fully into this telling as one of its own figures, not as one who hears it \u2014 what would you do next?',
    },
  ],
  // Derived from corpus/stoic-passages.json (22 approved entries, 0 caution
  // flags -- Marcus Aurelius' Meditations, Epictetus' Enchiridion, Seneca's
  // De Ira and Letters to Lucilius, fragments of Zeno and Cleanthes).
  stoa: [
    {
      label: 'dichotomy-of-control',
      prompt:
        'Of what you\u2019ve just named, what is within your own power to answer \u2014 and what plainly is not?',
    },
    {
      label: 'the-inner-citadel',
      prompt:
        'When you withdraw to your own soul, what is already there waiting to give you ease?',
    },
    {
      label: 'memento-mori',
      prompt:
        'If this were among your last days to act on it, what would you no longer postpone?',
    },
    {
      label: 'anger-as-self-inflicted',
      prompt:
        'Where has your own reaction added more disturbance to this than the thing itself did?',
    },
  ],
  // Derived from corpus/taoist-passages.json (15 approved entries, 1
  // caution flag -- Tao Te Ching (Legge translation), Chuang Tzu (Legge
  // and Giles translations).
  sage_of_the_way: [
    {
      label: 'wu-wei',
      prompt: 'Where might the truest action here be to do less, not more?',
    },
    {
      label: 'water-over-stone',
      prompt:
        'Where have you been meeting something hard with more hardness, when yielding might move it further?',
    },
    {
      label: 'small-beginnings',
      prompt:
        'What in this began small enough that you barely noticed it starting?',
    },
    {
      label: 'identity-of-contraries',
      prompt:
        'What looks like your ugliness here that, from the Tao\u2019s own standpoint, might be indistinguishable from your beauty?',
    },
  ],
  // Derived from corpus/egyptian-passages.json (15 approved entries, 0
  // caution flags -- Budge's Book of the Dead, Mackenzie's Egyptian Myth
  // and Legend, Budge's Gods of the Egyptians).
  hem_netjer: [
    {
      label: 'negative-confession',
      prompt:
        'If you stood before the Hall of Ma\u2019at tonight, what could you truthfully say you have not done regarding this?',
    },
    {
      label: 'weighing-of-the-heart',
      prompt:
        'What would your own heart testify, if it were the one questioned rather than you?',
    },
    {
      label: 'the-secret-name',
      prompt:
        'What is the true name of this, underneath whatever you\u2019ve been calling it?',
    },
    {
      label: 'field-of-reeds',
      prompt:
        'If this simply continued, unresolved, into whatever comes next \u2014 would it look like abundance, or like the same unfinished field?',
    },
  ],
  // Derived from corpus/sufi-passages.json + sufi-hafiz-ibnarabi-
  // passages.json (17 approved entries, 0 caution flags -- Rumi's Masnavi,
  // Attar's Conference of the Birds, al-Ghazali's Confessions).
  sufi: [
    {
      label: 'love-as-astrolabe',
      prompt:
        'Underneath whatever you\u2019ve been loving here, what is it actually pointing you toward?',
    },
    {
      label: 'pain-as-evidence',
      prompt:
        'Where has the ache itself been the evidence that this matters to you, not a sign that something\u2019s wrong?',
    },
    {
      label: 'the-false-bazaar',
      prompt:
        'What have you been buying here that, honestly, was never worth the price you paid for it?',
    },
    {
      label: 'arrival-at-your-own-door',
      prompt:
        'If the road you\u2019re walking is really you walking toward yourself, what would arriving actually look like?',
    },
  ],
  // Derived from corpus/norse-poetic-edda-passages-STAGED.json (Bellows
  // translation, primary source -- Havamal 138-140, 77-78; Voluspa 19-20, 59).
  volva: [
    {
      label: 'hanging-on-the-tree',
      prompt:
        'What have you hung yourself on, wounded and unfed, hoping it would give you back something worth the hanging?',
    },
    {
      label: 'what-outlasts-you',
      prompt:
        'Cattle die, kinsmen die, and you yourself will die \u2014 of everything here, what is the one thing that won\u2019t?',
    },
    {
      label: 'the-well-of-the-norns',
      prompt:
        'What was already being woven and watered at the root of this, long before you ever arrived at it?',
    },
    {
      label: 'earth-rising-green',
      prompt:
        'If this has to end the way it\u2019s ending, what is it clearing the ground for?',
    },
  ],
  // Derived from corpus/vedic-passages.json's primary-source entries only
  // (Griffith's Rigveda, Bloomfield's Atharva-Veda, Hume's Upanishads) --
  // NOT the 6 Wilkins entries, self-labeled as secondary/interpretive.
  vedic: [
    {
      label: 'self-by-the-self',
      prompt:
        'What have you been trying to know about yourself using someone else\u2019s eyes, that only you could actually see?',
    },
    {
      label: 'the-fullness-within',
      prompt:
        'What are you looking for out there that is already just as full, just as still, right here inside?',
    },
    {
      label: 'brahma-in-every-direction',
      prompt:
        'If this were true everywhere you looked, not just where you\u2019re currently looking, what would that change?',
    },
    {
      label: 'treasure-of-the-fathers',
      prompt:
        'What did those before you win, that you\u2019ve been carrying this whole time without noticing it was theirs first?',
    },
  ],
  // Derived from corpus/babalawo-passages.json's Johnson-sourced entries
  // (yor-johnson-005 through 008, added 2026-09-24 from Chapter I of "The
  // History of the Yorubas", 1921, public domain, insider-authored) -- NOT
  // the Ellis entries (colonial-outsider-sourced, caution-flagged).
  babalawo: [
    {
      label: 'oranyans-land',
      prompt:
        'What have you been given that looked like nothing beside what others received \u2014 and might actually be the ground everything else has to stand on?',
    },
    {
      label: 'the-cock-scatters-the-earth',
      prompt:
        'What small, patient scattering could you do right now that would slowly turn what\u2019s unstable under you into solid ground?',
    },
    {
      label: 'the-crown-he-would-not-release',
      prompt:
        'What have you already been quietly given permission to keep, just because you wouldn\u2019t let go of it?',
    },
    {
      label: 'exile-becomes-origin',
      prompt:
        'If where you are right now is actually the exile, not the destination \u2014 what new thing might you be the first ancestor of?',
    },
  ],
  // Derived from corpus/greek-passages.json (new file, 4 entries, built
  // 2026-09-24 from Herodotus, Sophocles/Jebb, and the Homeric Hymn to
  // Apollo/Evelyn-White -- all public domain). Phrased as oracular
  // pronouncements, not therapeutic invitations, per lib/lineages.ts's own
  // instruction for this voice: "she names, she does not interpret...
  // never be Socratic -- do not ask clarifying questions in series."
  pythia: [
    {
      label: 'the-tortoise-and-the-lamb',
      prompt:
        'What have you hidden so carefully that you were certain no one could name it \u2014 and is it truly hidden, or only unspoken?',
    },
    {
      label: 'the-empire-that-falls',
      prompt:
        'Name the empire this will bring down. Are you still certain it is not your own?',
    },
    {
      label: 'fleeing-toward-it',
      prompt:
        'What are you fleeing that your very fleeing carries you toward?',
    },
    {
      label: 'built-on-the-rot',
      prompt:
        'What died here, that the truth now speaks from exactly that ground?',
    },
  ],
};

export function beat2Questions(voiceKey: string): readonly Beat2Question[] {
  return BEAT2_INSTRUMENTS[voiceKey] ?? [];
}

const MIN_ANSWERED_TO_PROCEED = 2;
const MAX_QUESTIONS = 4;

/**
 * Builds the Beat-2 clause for a voice with a derived instrument.
 * questioningTurnCount = how many of this voice's questions have already
 * been asked (and answered) so far this sitting, 0-indexed into the list.
 * Mirrors the existing single-question clause's own trust model: the model
 * governs exactly-one-question-per-turn and the minimum-to-proceed judgment
 * from these instructions, the same way it already self-governs the
 * exactly-one-clarifying-question rule today. No new server-side counting
 * is introduced beyond the turn index the client already has to track to
 * pick the next question in sequence.
 */
export function buildBeat2Clause(
  voiceKey: string,
  questioningTurnCount: number,
  traditionName: string
): string {
  const questions = beat2Questions(voiceKey);
  if (questions.length === 0) return '';

  const remaining = questions.slice(
    Math.min(questioningTurnCount, questions.length)
  );
  const nextQuestion = remaining[0];

  const listing = questions
    .map((q, i) => `  Q${i + 1} (${q.label}): ${q.prompt}`)
    .join('\n');

  if (!nextQuestion) {
    // All questions exhausted without an early exit — proceed to the
    // Reading on the next turn regardless of the answered-count; the
    // caller (route.ts) is expected to have already forced mode: 'reading'
    // once questioningTurnCount reaches MAX_QUESTIONS, so this branch is a
    // safety fallback, not the normal path.
    return '';
  }

  return `\u2501\u2501\u2501 DEEPENING — ${traditionName.toUpperCase()} PROBING INSTRUMENT \u2501\u2501\u2501
You have just named the seeker's myth and archetype. Before delivering the
deep Reading, you ask questions drawn from the following set, in this fixed
order, one per turn, waiting for the seeker's answer before asking the next.
Ask in your own voice, never verbatim from the list below — root each
question in the specific myth already named, not as a generic checklist:

${listing}

You are now asking question ${Math.min(questioningTurnCount, questions.length) + 1} of ${questions.length}: "${nextQuestion.prompt}"

MINIMUM-TO-PROCEED: at least ${MIN_ANSWERED_TO_PROCEED} of these ${questions.length}
questions must be answered before the deep Reading may be delivered. If the
seeker has answered at least 1 and clearly signals they want the Reading now
rather than another question, honor that immediately — do not press for more.

Once you judge either condition met, deliver the question-turn response as
usual but end it with the token \u29c1\u29c1READY\u29c1\u29c1 on its own line, exactly as
the single-question clarifying step does elsewhere in this prompt, so the
exchange is recorded correctly. Otherwise, ask the next question in sequence
and end with the same token so the next turn continues the instrument.

CARRY-FORWARD: when you do deliver the deep Reading, it must visibly draw on
the seeker's own words from at least one answered question here — a Reading
that only elaborates the naming already given, ignoring what the seeker
actually said, does not satisfy this instrument.

This instrument is about depth, not information-gathering. It never applies
to, and never delays, a Hard Ceiling or the crisis directive — those are
named immediately, exactly as instructed above, whether or not this
instrument has begun.`;
}

export function beat2MaxQuestions(voiceKey: string): number {
  return beat2Questions(voiceKey).length || MAX_QUESTIONS;
}

// ─── Fail-closed invariants, enforced at import time ───────────────────────
// Mirrors lib/beat2VoiceStatus.ts's own assertRegistryInvariants(), but
// checks the cross-file relationship those two files must maintain: this
// file's actual content must never exceed what the registry authorizes.
function assertBeat2Invariants(): void {
  const problems: string[] = [];

  for (const voiceKey of Object.keys(BEAT2_INSTRUMENTS)) {
    const record = BEAT2_VOICE_REGISTRY[voiceKey];
    if (!record) {
      problems.push(
        `${voiceKey}: has a BEAT2_INSTRUMENTS entry but NO record in ` +
          `BEAT2_VOICE_REGISTRY at all — a voice with no registry status ` +
          `must be treated as ungoverned, not silently authored for.`
      );
      continue;
    }
    if (record.status === 'blocked' || record.status === 'hold') {
      problems.push(
        `${voiceKey}: has a BEAT2_INSTRUMENTS entry but registry status is ` +
          `'${record.status}' (${record.reason}) — an instrument must not ` +
          `be authored for a blocked/hold voice, drafted or not.`
      );
    }
    if (record.status === 'not_applicable') {
      problems.push(
        `${voiceKey}: has a BEAT2_INSTRUMENTS entry but registry status is ` +
          `'not_applicable' — this voice was judged to have no single ` +
          `tradition to derive from; an instrument should not exist.`
      );
    }
  }

  for (const voiceKey of BEAT2_REVIEWED_VOICES) {
    const record = BEAT2_VOICE_REGISTRY[voiceKey];
    if (record?.status !== 'reviewed') {
      problems.push(
        `${voiceKey}: present in BEAT2_REVIEWED_VOICES but registry status ` +
          `is '${record?.status ?? '(no record)'}', not 'reviewed'.`
      );
    }
  }

  if (problems.length > 0) {
    throw new Error(
      'lib/beat2Instrument.ts: governance invariant violation(s) against ' +
        'lib/beat2VoiceStatus.ts:\n' +
        problems.map(p => '  - ' + p).join('\n')
    );
  }
}

assertBeat2Invariants();
