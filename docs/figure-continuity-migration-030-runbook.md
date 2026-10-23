# Runbook: apply migration 030 (`figure_mapping`) to production

**Status:** DONE 2026-10-06. Applied by Jesse by hand in the Neon SQL editor on the production endpoint (no production credential was used from a workstation). Fingerprint before: 0 users, 0 visits, 2000 passages, `figure_mapping` absent. Verified after: the table, 0 rows, and `figure_mapping_offer_expiry`, `_one_offer`, `_pkey`, `_uniq`, `_user_chain`. `npm run check:schema-drift` against production was not run. Kept below for reference and for any rebuild.
**Who runs it:** Jesse, or Claude with Jesse's explicit yes at step 4.
**Risk:** low. The migration creates one new table and four indexes and touches no existing table. Nothing reads or writes the table while the feature flag is dark. The SQL is idempotent (`IF NOT EXISTS`) and wrapped in a transaction.

**Hosts (the only rule to remember):** production is `ep-odd-term-aitveb5q`, dev is `ep-frosty-mode-aijgrxmb`. Neon's branch labels are inverted relative to this, so never go by the branch name or by position in `.env.local`. Only ever print hostnames, never connection strings.

## Steps

1. **Merge first.** Once FC-A to FC-G are on `main`, the deployed code already tolerates the table's absence and then its presence.
2. **Pick the connection.** Use the unpooled URL for DDL (`migrations/README.md`). State the host: it must contain `odd-term`.
3. **Fingerprint (read-only).** On that connection run:
   ```sql
   SELECT (SELECT count(*) FROM elder_user)      AS users,
          (SELECT count(*) FROM visit_record)    AS visits,
          (SELECT count(*) FROM corpus_passage)  AS passages,
          to_regclass('public.figure_mapping')   AS figure_mapping;
   ```
   Expected on production: real seeker and visit counts, `passages` over a thousand (the live corpus), and `figure_mapping` **NULL**. Dev looks different: throwaway users and `figure_mapping` present. If the host and the counts disagree, **stop and change nothing.**
4. **Confirm.** Show the host, the counts and the NULL to Jesse and wait for a yes. Nothing is written before this.
5. **Apply.** Run `migrations/030_figure_mapping.sql` once, as is.
6. **Verify.** `\d figure_mapping` shows the table, the two `CHECK`-constrained columns, the two foreign keys (`elder_user`, `corpus_passage`) and the four indexes (`figure_mapping_uniq`, `figure_mapping_one_offer`, `figure_mapping_user_chain`, `figure_mapping_offer_expiry`). Then `SELECT count(*) FROM figure_mapping;` returns 0. Then run `npm run check:schema-drift` with the production `DATABASE_URL`.
7. **Do not set any flag.** `FIGURE_CONTINUITY_RELEASE_VERIFIED` is set only after the staging release check (checklist item 6, second half).

## Rollback

Safe only while nothing has written to the table (always true while dark):

```sql
DROP TABLE figure_mapping;
```

Once the feature has been lit and seekers have confirmed pairings, do **not** drop the table: that deletes their data. Turn the flag off instead (see the governance doc, section 8).

## What the application does if the table is missing

The release paths tolerate its absence so nothing existing breaks. The feature itself needs the table, which is why this runs before the observation week.
