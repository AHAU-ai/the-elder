# Seeker's carry: migration 032 and flag-on runbook

Covers `migrations/032_seeker_carry.sql` (ADR-0015). Dev was verified 2026-10-23. Prod has not been migrated.

## State at time of writing

| | Dev (`ep-frosty-mode`) | Prod |
|---|---|---|
| Migration 032 | applied, verified | **not applied** |
| `ELDER_CARRY_ENABLED` | `true` in `.env.local` | **not set** |
| Trajectory gates | on | `ELDER_TRAJECTORY_ENABLED`, `MARKER_CONFIRMATION_READY`, `CEILING_RATIFIED` exist (values are sensitive, not checked) |
| #194 disclosure | n/a | draft only, awaiting counsel |

Prod `DATABASE_URL_UNPOOLED` is a Vercel *sensitive* variable and cannot be read back, so the
easiest ways to run the migration are the Neon SQL editor or an authenticated `vercel env pull`.

## 1. Apply to prod (no user impact: adds a table nothing reads while the flag is off)

Option A, Neon SQL editor: open the **prod** project's branch, paste
`migrations/032_seeker_carry.sql`, run. Confirm the branch name before running.

Option B, CLI:

```
npx vercel login
npx vercel env pull .env.prod --environment=production
# confirm the host is the prod one, not ep-frosty-mode, then run the file
# against DATABASE_URL_UNPOOLED with psql -f, or node with @neondatabase/serverless
```

Delete `.env.prod` afterwards. It is gitignored (`.env*`), but it holds prod secrets.

## 2. Verify

```sql
select column_name from information_schema.columns where table_name = 'seeker_carry' order by ordinal_position;
-- id, user_id, visit_id, practice_key, line, created_at
select indexname from pg_indexes where tablename = 'seeker_carry';
-- idx_seeker_carry_user_created, seeker_carry_pkey, uq_seeker_carry_visit
select count(*) from seeker_carry;  -- 0
```

## 3. Flip order (do not reorder)

1. Counsel approves the #308 disclosure text; record it in `governance/signoffs/`.
2. Publish that text wherever the privacy disclosure lives.
3. Step 1 above is done and verified.
4. Set `ELDER_CARRY_ENABLED=true` in Vercel production and redeploy (env is read at call time,
   but a production env change needs a redeploy to apply).
5. Smoke test with one account: make a carry, return after 12 hours or adjust, see it, "Release this".

## Rollback

- Flag: unset `ELDER_CARRY_ENABLED` and redeploy. Stored lines stay but nothing reads them.
- Table: `DROP TABLE seeker_carry;` is safe only while it holds no rows you need to keep.
  Prefer unsetting the flag.
