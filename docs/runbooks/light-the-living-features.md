# Runbook: lighting the living features, testers first

**Status:** procedure only. Nothing here has been run, and no flag in this
repository was changed by writing it. Every step in sections 3 to 6 is a
**governance action** taken by a named person, not a deploy step and not part
of any PR (`config/returning-features.ts` header).

**What this lights.** Four features are built and dark:

| Feature | What a seeker would notice | Master gate | Stage-2 flag |
|---|---|---|---|
| Trajectory | The Elder speaks threads the seeker confirmed three times; the movement tone; the return-visit reflection (R1); the Tree's marker roots | `ELDER_TRAJECTORY_ENABLED`, `MARKER_CONFIRMATION_READY`, `CEILING_RATIFIED` | `TRAJECTORY_ALL_SEEKERS` |
| The seeker's carry (R2/R3) | A looking practice and/or one line in the seeker's own words | trajectory's three, plus `ELDER_CARRY_ENABLED` | `TRAJECTORY_ALL_SEEKERS` (shared) |
| Figure continuity | "Continue as {figure}"; pairings with characters in the home myth | `FIGURE_CONTINUITY_ENABLED`, `MARKER_CONFIRMATION_READY`, `FIGURE_CONTINUITY_RELEASE_VERIFIED` | `FIGURE_CONTINUITY_ALL_SEEKERS` |
| Myth-first | A new seeker's first Reading is told myth, figure, return | `MYTH_FIRST_ENABLED` | `MYTH_FIRST_ALL_SEEKERS` |
| Hearth follows movement | The fire carries a faint, warm-only trace of the seeker's movement (`docs/axis-4-hearth-movement.md`) | `HEARTH_RESPONDS_TO_MOVEMENT_ENABLED` plus all of trajectory's | `TRAJECTORY_ALL_SEEKERS` (shared) |
| Fireside | A room to talk with the Elder as host (`docs/fireside.md`); needs migration 033 | `FIRESIDE_ENABLED` | `FIRESIDE_ALL_SEEKERS` |

**The staging rule (the same for all four).** With the master gates met, only
tester accounts see the feature until the stage-2 flag is also exactly `true`.
Unset or any other value fails closed. Enforced in `config/returning-features.ts`
(`stageAllows`) and `lib/returning/rollout.ts`; tested in
`lib/returning/rollout.test.ts`. A stage-2 flag set without its master gates
does nothing.

## 1. Who decides

| Decision | Owner | Evidence to record in `governance/signoffs/` |
|---|---|---|
| Trajectory and carry | Jesse, on Shalom's ratification of the Appendix B ceiling | the 2026-06-30 ceiling sign-off already exists; add a dated "stage 1 lit" note |
| Figure continuity | Jesse; Vincent Stanzione for the clause | see the caveat in section 5 |
| Myth-first | Jesse (D13: no separate review); MF-8 checklist | the MF-7 voice reviews for maya, greek, sufi |

## 2. Before any flip (once)

1. `npm run gk-007` and `npm run verify` green on the commit to be deployed.
2. `npm run check:crisis-directive` green, and run against the deployment.
3. Migrations through `032` applied on the target database (`migrations/README.md`).
4. At least two tester accounts exist and are marked with
   `POST /api/admin/set-tester` (`ADMIN_SECRET`-gated). A tester reads back as
   `council` tier, so tier gates do not hide the feature from them. Use one
   account per tier you want covered by hand (testers cover the paid paths).
5. A non-tester account exists to confirm the feature stays dark for it.
6. Note the current Vercel deployment id. Rollback (section 7) is to unset the
   flags and redeploy, or promote that deployment.

## 3. Stage 1: testers only

Set the **master** gates only. Leave every `*_ALL_SEEKERS` unset. Order, one
feature per day so any regression has one suspect:

1. **Myth-first** (`MYTH_FIRST_ENABLED=true`). Smallest blast radius.
   - Tester: a new lineage's first Reading opens on the myth. Non-tester: unchanged.
   - Confirm the distress-tier gate on the deployment (MF-8): send a distress-tier
     message as the tester; the Reading must be story-first.
2. **Trajectory** (`ELDER_TRAJECTORY_ENABLED=true`, `CEILING_RATIFIED=true`;
   `MARKER_CONFIRMATION_READY` is already `true` in production).
   - Tester with three confirmed sittings on one thread: the Elder speaks it, the
     Tree grows a root, the next arrival shows the reflection. Never a count, never
     a label for the movement.
   - Non-tester: `/api/user/reflection` returns `{ reflection: null }`,
     `/api/user/tree-state` has no marker roots, the Reading carries no threads.
   - Welfare-elevated turn as tester: no threads spoken, no stage-up offer.
3. **Carry** (`ELDER_CARRY_ENABLED=true`) after trajectory has run clean for a week.
4. **Figure continuity**: see section 5 first. `readChainFigure` also read the
   figure marker in the wrong shape and was corrected in the same change; verify a
   confirmed figure actually offers "continue as {figure}" for a tester.
5. **Hearth follows movement** and **the fireside** after trajectory has run clean
   for a week. The fireside is a new generating surface: read the first tester
   exchanges yourself, and confirm a crisis message returns the crisis copy and
   writes no row. The over-dwelling guard counts Readings only and does not count
   fireside turns (`docs/fireside.md`); settle that with the reviewer before stage 2.

## 4. What to watch during stage 1

At least two weeks and at least a handful of tester sittings per feature:

- `anomaly_record` near-misses for the feature (Vercel runtime errors via
  `get_runtime_errors`; no seeker text is logged, by design).
- The register scripts on a sample of real output: `npm run check:opening-register`,
  `check:reflection`, `check:carry`.
- Any tester report that a line sounded like longing ("missed you", "come back").
  One such report pauses the rollout (RT-6, Appendix B).
- Tree and reflection read as the seeker's own words, never the Elder's.

## 5. Figure continuity caveat

Vincent's approval of the clause is recorded as a **relay** through Jesse
(`docs/figure-continuity-governance.md` D7). His permission letter's section 6.1
requires his written approval for that specific item before anyone states he
approved it. Get that in writing before stage 2 at the latest; stage 1 with
testers is an internal trial. Do not describe the feature externally as
lineage-approved until then.

Flip order for stage 1: complete checklist item 6 (release and removal verified
end to end on the deployment), then set `FIGURE_CONTINUITY_RELEASE_VERIFIED=true`,
then `FIGURE_CONTINUITY_ENABLED=true`.

## 6. Stage 2: everyone

Only after stage 1 has been clean for the period you set, and the owner in
section 1 has written the decision down:

| Feature | Set |
|---|---|
| Myth-first | `MYTH_FIRST_ALL_SEEKERS=true` |
| Trajectory and carry | `TRAJECTORY_ALL_SEEKERS=true` |
| Figure continuity | `FIGURE_CONTINUITY_ALL_SEEKERS=true` |

One feature at a time. A production env change redeploys; verify with a
non-tester account that the feature is now visible, then record the date.

**The classifier fix.** Until 2026-10-23 the movement classifier threw on real
data (it read confirmed markers as strings; the database stores objects) and the
divine route silently treated every seeker as ARRIVING. `lib/returning/trajectory.ts`
now reads the stored shape (`lib/returning/trajectory.test.ts`). Lighting trajectory
therefore turns on the movement tone for the first time: sample it during stage 1.

**Do not widen further while the over-dwelling guard is unapproved**
(`docs/signoff/over-dwelling-threshold-packet.md`): the guard is the price of
every retention-adjacent feature, and trajectory and the Tree are the most
retention-adjacent things in this list. It is built and dark
(`docs/over-dwelling-guard.md`); stage 2 of trajectory should wait for its
review.

## 7. Rollback

Unset the stage-2 flag first (back to testers only), then the master gate.
Both take effect on redeploy. Nothing is deleted: confirmed markers, pairings
and carry lines stay in the seeker's own records, and the release paths
(`/api/user/history`, `/api/journal`, `/mappings`) work whether or not a
feature is lit.

## 8. Record

After each flip add a dated line to `CHANGELOG.ceremonial.md` or a note under
`governance/signoffs/` naming who flipped what, at which stage, and the
deployment id. The env change itself leaves no trace in the repo.
