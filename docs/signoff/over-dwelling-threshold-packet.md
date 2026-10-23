# Governance / clinical review packet — the over-dwelling threshold (M7)

**Status:** not reviewed. Tracked in `lib/compliance/signoff-status.json`
(`overDwellingThreshold`). **Nothing is built** behind this packet: the guard
(M7 in `docs/inhabiting-the-elder.md`) does not exist in code and will not be
written until a reviewer has decided the questions below. When it is built it
ships behind a flag that stays off until this is `approved`, the same posture as
`ELDER_TRAJECTORY` (a governance action, not an engineering one).

**Who this is for:** Shalom, as governance reviewer of the instrument, and a
clinician with experience in digital-wellbeing or compulsive-use patterns (the
reviewer to be named by Jesse; this packet deliberately does not assume who).
Engineering supplies the mechanism and the data it can honestly count. It does
not choose the number.

## What's being decided

The Elder is being shaped into a place a seeker might want to return to often
(`docs/inhabiting-the-elder.md`, decision of 2026-10-03: *dwelling, not
retention*). A place that works will sometimes be used too much. This packet
asks whether, and at what point, the instrument should *change how it closes a
sitting* for a seeker who has had many sittings in a short time.

Three things are being decided, and a reviewer may decide them separately:

1. **Whether to have the guard at all.**
2. **What counts and at what level it triggers** (the threshold).
3. **What the response is** (the exact words and atmosphere).

## Why this needs review

Everything else in the dwelling work is atmosphere or a seeker-chosen
preference. This one is a judgement about the seeker's wellbeing made by the
instrument, which is the category of decision the project reserves to people
with the authority to make it (same reasoning as the crisis-copy packet). Two
of the project's own invariants press on it from opposite sides:

- **Never snubbed / never a gate.** The response may never block, ration or
  refuse a seeker, and may never imply they are doing something wrong.
- **Fabricated connection is a trust violation.** The guard may not infer
  anything about the seeker that they have not confirmed (that they are
  struggling, avoiding something, repeating a wound). It may only count a fact
  the system already holds and change its own manner in response.

## Artifact 1: the mechanism (what the guard would do)

**It counts one thing.** Completed sittings, meaning a Reading delivered and
recorded in the visit ledger (`lib/returning/visit.ts`), per signed-in account,
inside a rolling window. Not page loads, not time on site, not what was said.

**It changes only the instrument's manner.** When the count crosses the
threshold, the close of a sitting is quieter: the fire is banked a little lower
for the remainder of the window (the same device as M5, bounded to stay clearly
lit), the closing beat is slower, and one plain line is given in place of the
usual closing. Nothing is locked, hidden, delayed, or rate-limited by this guard
(rate limits that already exist are separate and unchanged).

**It never speaks about the pattern.** No line names how often the seeker has
come, no line says "again," "so soon," "enough," or "rest."

**It is disclosed.** One sentence in About says that the fire closes more
quietly when sittings come close together. It does not give the number.

**Known limits (surfaced honestly, not hidden):**
- Only signed-in seekers can be counted; visit history is keyed to the account.
  An anonymous seeker, or one who signs out, is invisible to this guard. A
  device-local counter could cover part of that gap but is trivially reset; it
  is listed as a question below, not assumed.
- It cannot tell enthusiasm from distress, and does not try to.
- It cannot see what happens outside the instrument.

## Artifact 2: strawman values (engineering's guess, not evidence)

These exist only to give the reviewer something concrete to correct. None is
grounded in research; all are expected to change.

| Parameter | Strawman | Notes |
|---|---|---|
| Counted event | Completed Reading recorded in the visit ledger | Not "visit," not "message" |
| Window | Rolling 24 hours | Alternatives: calendar day in the seeker's timezone; rolling 12h; two tiers |
| Trigger | 3 or more completed Readings in the window | A first-pass guess, no basis beyond "unusually many for a practice of this kind" |
| Duration | Until the window falls below the trigger | No lingering penalty, no "cooldown" state shown |
| Late-night variant | None in v1 | Raised as a question below |
| Atmosphere | Fire banked to at most the M5 ceiling (never below "clearly lit") | See `lib/hearthBank.ts` |

**Candidate closing lines** (Elder's voice: witnessing, not instructive, no
flattery, no imperatives; would be added to `check:opening-register` before use):

- "This will keep."
- "The fire holds what was said."
- "What was spoken here stays."

None may contain a greeting, an imperative, a number, or a reference to
frequency. Wording is the reviewer's to choose, change or reject.

## Questions for the reviewer

**On whether to have it**
1. Is a visit-count-only guard worth having, or does a mechanism this blunt do
   more harm (feels like rationing, feels like surveillance) than good?
2. If it exists, is it better as a quiet change in manner (as sketched), or as
   nothing the seeker perceives at all?

**On the threshold**
3. What level of sittings in what window is plausibly "a lot" for this kind of
   practice, and what evidence would you want before fixing a number? Should
   engineering collect anonymous, aggregate distributions first (no per-seeker
   data) so the number is not a guess?
4. Is a single threshold adequate, or should there be two tiers (a gentle one,
   then a stronger one)?
5. Should hour of day matter (e.g. repeated sittings in the small hours)?
   The M1 design deliberately avoids treating the hour as a signal; is that
   still right here?
6. How should it treat a seeker who is mid-way through a deliberately long
   piece of work (e.g. a researcher, a teacher, a practitioner working
   through a Journal)? Is an opt-out the seeker controls acceptable, or does
   that defeat the purpose?

**On the response**
7. Is slowing the close and offering one plain line the right response, or
   should the instrument do something different (nothing, or something more
   direct)?
8. Do the candidate lines read as steadying, or as dismissive, odd, or
   quietly pathologizing? Which, if any, would you adopt or rewrite?
9. Is the About disclosure sufficient, or does the seeker need to be told in
   the moment?

**On limits and risk**
10. Given that it only sees signed-in seekers, is a partial guard acceptable,
    or does partial coverage create a false sense of safety?
11. Is there any version of this you would want removed entirely on the
    grounds that the instrument should not be making this judgement?

## What engineering will and will not do meanwhile

- Will: collect nothing new. (Any anonymous aggregate distribution of
  sittings per account per day would be proposed to the reviewer as its own
  step, with its own privacy review, before it is built.)
- Will: keep the guard unbuilt and the flag absent until this is `approved`.
- Will not: pick a number, write a closing line into the code, or enable
  anything on the strength of the strawman above.

## Decision record

Update `lib/compliance/signoff-status.json` → `overDwellingThreshold`.
"approved_with_conditions" does not auto-pass (see `signoffStatus.ts`): a human
must apply the conditions in code first.

```
Reviewer:        [name / credentials]
Date:            [ISO date]
Scope:           [whether | threshold | response | all]
Decision:        [approved | approved_with_changes | rejected]
Threshold:       [counted event / window / level / tiers]
Response:        [exact closing line(s), atmosphere]
Required changes:[if any]
Notes:
```

## Why this is not a hard block on the rest of the work

The guard is the counterweight to the dwelling features, not a precondition for
them. The dwelling work shipped so far (light that follows the hour, the
nav, the door) carries no per-seeker count and nothing that invites more
sittings. The mechanisms that do lean toward return (M4's seeker-chosen letter
delay, M5's banked fire) are bounded so that they cannot punish absence or
reward frequency. If this review concludes that no guard should exist, that is a
valid outcome and the rest of `docs/inhabiting-the-elder.md` stands; if it
concludes a guard is needed, M4 and M5 should not be widened (more letters,
stronger hearth signals) until it is built.
