# Seeker's carry: privacy disclosure language (DRAFT)

Closes the pre-launch requirement in ADR-0015 (Consequences) and issue #194.

**Status: published at the point of collection on 2026-10-23 on the founder's authority (see `governance/signoffs/2026-10-23-seeker-carry-disclosure-and-flag-barber.md`). Counsel has NOT approved it.**
Per `governance/checklist.yaml` ("Legal Entity, Terms of Use, Honest Disclosure Language"),
disclosure language is an open legal item. The short notice now shown under the line field
(`CARRY_COPY.lineNotice`) is a condensed form of the paragraph below. The full paragraph is still
the candidate text for counsel. Counsel's approval, recorded in `governance/signoffs/`, is the
condition for treating #194 as satisfied by counsel's standard, rather than the founder's.

## Candidate paragraph

> **What you choose to carry.** After a reading you may choose to carry one way of looking
> and/or one line in your own words. If you write a line, we store it as plain text in our
> database, with the standard protections that apply to all our data. It is not specially
> encrypted, and anyone with direct access to the database could read it. We do not send it to
> any AI model. The only automated check it passes through is the same safety review applied
> to everything you type, which looks for signs that you may be in distress. If that review
> finds such signs, the line is not stored. We show it back only to you, when you return. You
> can choose "Release this" at any time; the line is then deleted immediately and permanently.
> Releasing a reading, a chain of readings, or your account also deletes what you carried from
> it.

## Each claim, and where the code backs it

| Claim | Basis |
|---|---|
| Stored as plain text, not specially encrypted | `migrations/032_seeker_carry.sql` (`line TEXT`); ADR-0015 Consequences |
| Sent to no model except the safety review | ADR-0015 rule 3; `scripts/check-carry-register.mjs` |
| A crisis-tier line is not stored | `app/api/user/carry/route.ts` (`welfare_crisis`, `welfare_distress` return before write) |
| Shown back only to the same seeker | Session-scoped in the carry route |
| "Release this" deletes immediately and permanently | `DELETE` in the carry route, never gated; `releaseCarry` |
| Cascades on reading, chain or account release | `ON DELETE CASCADE` on `visit_id` and `user_id` |

## For counsel to decide

1. Whether "standard protections" needs to name specifics (encryption at rest by the host,
   access controls) or can stay general.
2. Whether "anyone with direct database access" should say who that is (staff, hosting
   provider).
3. Backups: deletion removes the row from the live database; whether copies persist in
   backups, and for how long, is not stated here and must be confirmed before approval.
4. Where the paragraph lives, since no in-repo privacy disclosure file exists yet.
5. Translation: the carry UI copy is English-only today (ADR-0015), so the disclosure will be
   too until the copy is translated.
