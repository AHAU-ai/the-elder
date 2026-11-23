# Why the Reading feels flat: prompt audit (2026-11-20)

Status: findings and proposals only. Nothing here is wired into the prompt.
Voice register and contract-hash changes go through the usual governance
(ojer_tzij register: Vincent Stanzione's signature).

## What was measured

Assembled with `buildSystemPrompt('maya', false, true, 'English')`, i.e. a
primary K'iche' reading, the same call `/api/divine` makes:

- about 18,400 characters (~4,600 tokens), 20 sections
- 56 negations ("never", "do not", "must not") against **zero example readings**
- the voice's own section ("MYTHIC REGISTER") is one line: a list of names
  (Popol Wuj, Hero Twins, the ball court, the six Houses...). It names topics;
  it does not hand the model a single scene to tell.
- the closing-shape clause is dark for ojer_tzij (reviewed set is `norse` only)
- production model is `claude-sonnet-4-6` (`lib/model.config.ts`)

Craft is not absent: `ENGAGEMENT_DIRECTIVE` already demands a specific first
sentence and escalating stakes. The flatness is more likely to come from what
surrounds it.

## Findings (ranked by how likely each is to matter)

1. **The model is asked to be specific but is not given anything specific.**
   "Never invent a Lord, a nawal quality or a Popol Wuj beat that cannot be
   traced to the corpus; if the corpus has not spoken, hold silence" is the
   right ethic. With only a noun list in the prompt and at most 2 retrieved
   passages (`retrieveForVoice(..., 2)`), the safest compliant output is
   general. Whether the 1,069 staged Stanzione passages are actually in
   `retrievable_passage` is not visible from the repo; check (below).
2. **Prohibitions outweigh demonstrations.** A long NEVER list with no example
   of a good reading pulls toward cautious, even prose. One annotated
   exemplar usually teaches more than ten more rules.
3. **The arc cannot fit the word budget.** The arc asks for six movements
   (pattern, lens, shadow, threshold, ancestor, charge) and segments are
   ~220 words. About 35 words per movement is a summary of each, not a telling.
4. **Two rules disagree.** ENGAGEMENT wants "a precise claim about this
   seeker's own situation"; STRUCTURAL LAWS say "you name what is already
   moving, you do not invent." With no sanctioned way to speak about the
   seeker, the model gestures.
5. **Model generation.** Production readings run on a model a generation behind
   what is available. Cheap to test, with a cost trade-off against the $200
   monthly cap.

## Check first (one query, no code)

```sql
SELECT lineage_key, count(*) FROM retrievable_passage GROUP BY 1 ORDER BY 2 DESC;
```

If `ojer_tzij` is near zero, finding 1 is the main cause and nothing in the
prompt will fix it; ingest and approve the staged corpus first.

## Test it (needs a funded key)

```bash
ANTHROPIC_API_KEY=... npx tsx scripts/compare-reading-prompts.ts \
  --question "I have lost my way and I don't know what I am for anymore." --n 3 > compare.md
# then the same with a newer model:
ANTHROPIC_API_KEY=... npx tsx scripts/compare-reading-prompts.ts \
  --question "..." --n 3 --model claude-sonnet-5-5 > compare-newer.md
```

`--dry` prints prompt sizes with no API call. Read A (production) and B (bare)
blind. B better: the constraints flatten it. Both flat: story material or
model. Newer model better: model.

## Proposed changes, smallest first

1. **Surprise clause (ungated form-only craft; fits ENGAGEMENT_DIRECTIVE).**
   Add: "Include exactly one turn the seeker could not have predicted from
   their own question: an inversion, a cost, or a detail of the myth that
   reframes their situation. Say it plainly; do not hedge it."
2. **Sanction the seeker-side claim.** In STRUCTURAL LAWS, keep "do not invent"
   for the *myth side* and add: "About the seeker, offer one claim built from
   one phrase of their own words, quoted or closely echoed, framed so they can
   refuse it." Strictness about the tradition stays; the voice gets a way to
   be specific about the person.
3. **One movement per segment.** In segmented mode, give each ~220-word
   segment one scene told fully, not all six movements compressed.
4. **One annotated exemplar per voice**, replacing a few NEVER lines. For
   ojer_tzij this is register material: it goes through Stanzione. Illustration
   below.
5. **More story material.** Raise retrieval from 2 to 3-4 passages for the
   chosen figure/episode, once finding 1 is confirmed.

## Illustration only (not reviewed, not for the prompt)

Seeker: "I have lost my way and I don't know what I am for anymore."
Target shape for changes 1, 2 and 4. Episode detail (Dark House: pine torch
and cigars to be returned whole, red macaw feathers and fireflies as false
fire) must be checked against the Stanzione text before anything like this
ships.

> The Lords of Xibalbá sent the Twins into the Dark House with no map. They
> gave each a pine torch and a cigar, and one instruction: return them at
> dawn exactly as given, lit and unspent.
>
> You told me you are lost, and I will say what I hear in it; refuse it if it
> is wrong. You have been burning your light to prove you carry one.
>
> The Twins did not keep the flame. They set red macaw feathers on the torch
> and fireflies on the cigar tips, and let the Lords believe in a fire that
> was not burning. At dawn the gifts were whole.
>
> What you are for may be something you carry through the night, not something
> you spend.
>
> What have you been burning to be seen as lit?

What it does differently: one scene told fully, one unpredictable turn (the
test was to *not* use the fire), one claim about the seeker built on their
phrase and open to refusal, and a single closing question.
