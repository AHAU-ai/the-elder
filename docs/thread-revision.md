# Seeker-initiated revision of the trajectory

**Status:** built. Not behind a rollout flag, on purpose (see "Why it is not
gated"). It follows the proposal in `docs/axis-3-forward-architecture.md`
("Seeker-initiated correction of the trajectory itself").

## The gap it closes

Axis 2 lets a seeker confirm, reshape or decline one proposed marker at the
moment it is offered. Weeks later, with the Tree showing a thread that has
recurred, there was no path to say: *that thread you named three times, it wasn't
that.* Markers are confirmed, not extracted-and-assumed; this applies the same
principle retroactively.

## What a seeker can do

From the Tree, under "threads you have named", for any thread:

| Act | What happens |
|---|---|
| **That wasn't that** (release) | The thread row is deleted, so it is never spoken, drawn as a root, or paired again. Every visit where the seeker confirmed that value has it blanked (`value: ""`, `mode: "released"`), so the movement classifier, the return-visit reflection and figure continuity stop counting it. The key is kept so confirm-marker's "first answer per field per visit" guard stays closed and a replayed old confirm cannot revive it. Two-step in the UI (a plain note, then "Set it down"). |
| **Say it differently** (reword) | The seeker types new words (3 to 120 characters; the field starts empty on purpose, so the words are theirs and not an edit of something the Elder said). Appearance count, reshape count and depth stage stay, because those sittings happened; the words change on the thread and in each place they were confirmed. |

`POST /api/user/thread` `{ trajectoryId, action, value? }`, code in
`releaseThread` / `rewordThread` (`lib/returning/markerTrajectory.ts`), pure
rules in `lib/threadRevision.ts`.

## Why it adds no inference

Nothing is proposed, scored, ranked or suggested. No model writes, rephrases or
pre-fills anything. The acts are the seeker's own assent, given later. The only
model call is the same welfare read every reshape already gets, on the new words:
a crisis or distress turn changes nothing and surfaces no pattern.

## Guards

- **Ownership.** Every statement filters by `user_id`; a foreign or missing id is
  a 404 indistinguishable from the outside. Verified in
  `tests/threadRevision.integration.test.ts`.
- **No merging.** Rewording onto words another thread already holds is a
  conflict (409). Merging two threads would be the system deciding they are one.
- **Atomic.** Each act is one transaction (thread row and visit rows together).
- **Loud.** A revision that did not happen is never reported as done; the UI shows
  an error and changes nothing.
- **Rate limited.** 60 a day per account.
- **Releasing is not forgetting the past.** A reading's own text is the seeker's
  record and is released through the journal paths, not here. This only withdraws
  the seeker's assent to a thread.
- **A new assent starts at one.** Naming it again later creates a new thread whose
  count starts from zero, as a fresh confirmation should, and must reach the
  appearance floor of three again before it is spoken.

## What it does not touch

Core Myth Statement versions that cited the thread keep their text, which is the
seeker's own authored synthesis; the cited id no longer resolves to source
material in the Journal spine. Becoming sentences and fireside lines are separate
records with their own release paths.

## Why it is not gated

Like the release paths in `/api/journal`, the right to withdraw or restate your own
words outlasts the feature that surfaced them. If trajectory is later switched
off, a seeker who still holds threads can still set them down. The control is only
*visible* where the Tree shows roots, which is where trajectory is lit.

## Tests

`lib/threadRevision.test.ts` (word rules), `tests/threadRevision.integration.test.ts`
(`npm run test:thread-revision`, dev database only: ownership, reword, conflict,
release, replay guard, fresh start, figure continuity).
