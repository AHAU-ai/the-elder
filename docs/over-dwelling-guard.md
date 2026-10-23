# The over-dwelling guard (M7): what is built and how it is lit

**Status:** built, inert. It runs only after a human reviewer approves
`overDwellingThreshold` (`lib/compliance/signoff-status.json`) and adopts the
wording the guard needs. Nothing in this change approves it, picks its number,
or writes its words. The review questions are in
`docs/signoff/over-dwelling-threshold-packet.md`; this document is the
engineering side of that packet.

**Decision (2026-10-23, Jesse):** build the guard before anything else dwells
deeper. This supersedes the packet's earlier line that the guard would stay
unbuilt until approved. What survives from that line: it ships dark, behind
the reviewer, and the reviewer owns the number and the words.

## What it does

Counts **one thing**: completed Readings in the visit ledger for the signed-in
account, in a rolling window (`recentVisitTimes`, `lib/returning/visit.ts`).
When the count reaches the threshold, the **close** of a sitting changes, and
only the close:

| What | Where | Change |
|---|---|---|
| The fire | `app/components/HearthHour.tsx` | A veil eases in over 9s, capped at `QUIET_VEIL_MAX` (0.14, half the M5 ceiling), and eases out when the window ends. Never for reduced motion. |
| The ring | `app/components/ThresholdLetter.tsx` | The closing ring draws in 1.5x more slowly. |
| The line | same | If the reviewer adopted one, it stands where the optional myth acknowledgment would. Never beside it. |
| About | `app/about/page.tsx` | One sentence of disclosure, in the reviewer's words, shown only while the guard can run. |

## What it never does

- Gate, hide, delay, ration or refuse anything. "Return to the fire" and the
  exit stay exactly as they are; existing rate limits are untouched.
- Speak about the pattern: no count, no "again", no "enough", no "rest".
  `closingLineViolations()` and `scripts/check-opening-register.mjs` fail the
  build on any adopted wording that does.
- Infer anything. It cannot tell enthusiasm from distress and does not try.
- Look at content, markers, chains, hour of day, or page loads.
- Reach beyond the account. Anonymous seekers are invisible to it (known limit,
  packet question 10).
- Store anything on the server. The only trace is `elder_hearth_quiet_until_v1`
  in the seeker's own browser, so the fire stays low across page loads until the
  window ends, as the bank already does.

## The three gates (all closed)

`lib/compliance/overDwellingGate.ts`: `overDwellingGuardActive()` needs all of

1. `overDwellingThreshold` recorded as a clean `approved`
   (`approved_with_conditions` does not pass; a human applies conditions first),
2. `OVER_DWELLING_GUARD_ENABLED=true`,
3. `QUIET_DISCLOSURE` set, so the guard is **never live undisclosed**.

While any is closed, `GET /api/user/dwelling` answers
`{ quiet: false }` without a database query, and the client changes nothing.
A ledger error also reads as "not quiet".

## What the reviewer fills in (`lib/overDwelling.ts`)

| Constant | Now | Meaning |
|---|---|---|
| `OVER_DWELLING.windowMs` / `.threshold` | 24h / 3 | **Engineering's strawman**, not evidence. The reviewer changes them (packet Artifact 2). |
| `QUIET_CLOSING_LINE` | `null` | The one plain line. `null` means a quieter, slower close that says nothing extra. |
| `QUIET_DISCLOSURE` | `null` | The About sentence. No number. Adopting it means adding it to every catalog in `lib/i18n` with the usual review. |

The packet's three candidate lines are tested as in-register, but are not
adopted.

## Lighting it

1. Reviewer decides (whether, threshold, response) and fills the decision record
   in the packet.
2. A person edits the three constants above to the reviewer's values, adds the
   disclosure to the i18n catalogs, and updates `signoff-status.json`.
3. Set `OVER_DWELLING_GUARD_ENABLED=true` for testers' deployment first; verify
   with a tester account that a third sitting in the window gives a slower ring
   and a lower fire, a fourth sitting does not lock anything, and a non-signed-in
   sitting is unchanged.

## Guardrail metric

Packet and `docs/inhabiting-the-elder.md`: how often this triggers is the
measure of whether the place is working against the seeker. If it triggers
often, the rest is wrong. Collecting that is a separate step with its own
privacy review (the packet's "anonymous aggregate distribution"); this change
collects nothing.

## Tests

`lib/overDwelling.test.ts` (window, expiry, clock oddities, cap below the M5
ceiling, wording rules, inert by default, no ledger query while dark) and
`scripts/check-opening-register.mjs` (any adopted wording).
