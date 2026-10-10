# Welfare review packet: the FC-D change to `app/api/divine/route.ts` (PR #226)

**Decision wanted:** may #226 merge? It is on HOLD because it edits the divine route, which holds the welfare gate and the crisis hard block.
**Who decides:** Jesse. Record it as a sign-off (`governance/signoffs/YYYY-MM-DD-figure-continuity-divine-route-barber.md`, `TEMPLATE.md`), quoting the diff hunks in section 2 or the commit SHA and a hash of the file. This is pre-flip checklist item 4.
**What was reviewed here:** the route diff of `feat/fc-d-divine-pipeline` against `main` (the only change to the route; PR #226 also adds `lib/returning/` helpers, tests and static checks). The code was read, and the integration suites (below) were run, by Claude. That is evidence for the review, not the review.

## 1. The claim to check

The change **reads** the welfare result and **never modifies it, bypasses it or reorders it**. With the feature off, or on a turn where welfare is not clear, the response is what it was before.

## 2. What the diff does to the route (7 hunks, all additive except two lines)

1. **Imports** (4): the assembler, the signal parser, the counterpart matcher, the ledger's `createOffer`.
2. **Request body type:** an optional `figureContinue?: boolean`. Client-sent, so it is never trusted by itself.
3. **After the welfare gate, the chain graft and the register are all resolved, before the prompt is built:** one call, `assembleFigureContext({ userId, figureContinue: body.figureContinue === true, effectiveTier, register, welfare: { surfaceResources, allowPsychopompLayer }, mode, chainId: <server-derived graft head>, lineageKey, includeMappings: true })`. It receives **two booleans copied from `welfare`**, not the object, so it cannot write welfare state.
4. **Prompt assembly:** the result's `block` (an empty string when it returns null) is passed as one extra final argument to `buildSystemPrompt`.
5. **After generation:** the model's raw text is parsed for the mapping signal; `mappingSignal.text` (signal removed) replaces `rawText` as the input to the existing strip chain. So the signal is gone **before the dual guardian sees the text and before the seeker does**.
6. **Provenance:** one optional field, present only when a reading built on a model-recalled pairing.
7. **After a delivered reading:** if the assembler produced a context and the signal parsed, create a stored **offer** (the server decides the counterpart basis; the ledger re-validates). Two optional response fields: `mappingOffer`, and `mappingHeld: false` when the ledger could not hold it.

Not touched: the welfare call, the `finalSystemPrompt` crisis/distress branches, the crisis hard block, the guardian, the retry loop, the ceiling and MYTH handling, rate limiting, consent.

## 3. Where the gates are, and why a welfare turn gets nothing

`assembleFigureContext` (`lib/returning/figureContinuity.ts`) returns null, **before any database read**, unless all of these hold: the flag is lit (all three gates), the seeker is signed in, `figureContinue` is literally `true`, tier is Kept or Council, register is `adult`, **`!welfare.surfaceResources && welfare.allowPsychopompLayer`**, mode is `reading`, and a home chain with a confirmed figure exists in the requested lineage.

| Welfare tier | `surfaceResources` | `allowPsychopompLayer` | Figure Continuity |
|---|---|---|---|
| ordinary | false | true | may apply |
| distress | false | false | **off** (D8, decided 2026-10-04): no clause, no offer, ordinary reading with the existing distress directive |
| crisis | true | false | **off**, and the existing hard block returns before generation: the model is never called, no signal is ever parsed |

If the welfare classifier is unavailable the gate already fails **up** to a failsafe tier, which closes this feature too.

## 4. Where to look, in order (the structure a careless edit would break)

`scripts/check-figure-continuity.mjs` section 5 fails the build if any of these stop being true:
- `assessWelfare(` comes before `assembleFigureContext(` (the result is read, not bypassed).
- The crisis hard block comes before the signal is parsed.
- The signal is parsed from raw text, then stripped **before** `dualGuardReading(`.
- The decline path (`if (guardianRejectedFinal) {`) returns before `createOffer(`: no offer on a declined or silenced reading.
- The assembler's `chainId` is the server-derived graft head; no code reads a chain id from the request body.
- `figureContinue` is honored only when literally `true`; an offer is honored only when the assembler produced a context for that request.

Spot-checked while preparing this packet: changing `figureContinue: body.figureContinue === true` to a bare cast fails the check. I did not re-mutate every ordering assertion.

## 5. Behavior evidence (run against the dev database, real route, model stubbed)

`tests/figureContinuityRoute.integration.test.ts` runs the real route handler. Relevant cases, each with a positive control (the same setup with nothing wrong creates an offer):
- **Crisis:** the hard block returns before any generation (0 model calls), no offer created or returned, the crisis response is returned unchanged.
- **Distress (D8):** no clause in the prompt, no offer, nothing of the signal reaches the seeker, the reading still happens.
- Also off, one by one: `figureContinue` false or not literally `true`, signed out, first reading, council mode, lineage mismatch, free tier, `young_adult` register, no confirmed figure.
- A guardian decline and an infrastructure silence create no offer.
- A ledger failure delivers the reading and says `mappingHeld: false`; it never blocks.
- Signal text never reaches the seeker, with or without an honored offer.
Last run: all passed (2026-10-05, dev database `ep-frosty-mode`).

## 6. Things to weigh, which the tests do not settle

1. **The gate is per turn, on the latest message only.** A seeker who showed distress two messages ago and writes something neutral now gets the mapping layer back. The existing psychopomp layer has the same per-turn behavior (`welfare` is computed from `latestUser.content`); this feature inherits it rather than adding a memory of distress. Decide whether that is enough for a feature that stores descriptions of third parties.
2. **The signal strip changes behavior even while dark.** The parser removes any mapping-signal text from model output regardless of the flag. That is intended (it must never reach a seeker), but it is a change to the response text on every request in the case the model emits the signal unprompted. With no signal in the text it is a no-op, covered by a test.
3. **One more database call on the eligible path only.** The assembler reads the chain's figure after every cheaper gate passes; any database error returns null (an ordinary reading).
4. **The dual guardian now sees text with the signal removed,** the same treatment as READY, CEILING and MYTH.
5. **A client can send `figureContinue: true`.** That is by design: it only matters if every server-side gate also passes, and it is read as a boolean only.
6. **`mappingOffer` is shown to the seeker as a control;** only the seeker's own press confirms. Nothing in this route confirms anything.

## 7. What your decision does and does not open

Merging #226 does not light anything: the three-gate flag stays unset. It is one condition for the flip. Still required: migration 030 on production, the staging release check, D1-D6 and D10, copy review, and the observation week. D7 (the clause) is already signed off.

## 8. Decision options

**Approve** (merge as is) · **Approve with revisions** (list them; I make them and re-run the suites) · **Decline** (reasons).
