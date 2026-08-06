-- migrations/007_narrative_register.sql
-- The Elder — Age-Tiered Narrative Register (docs/age-register-spec.md).
--
-- Adds the coarse narrative-register tier to elder_user, following the same
-- shape as myth_archetype's user_id -> elder_user(id) pattern.
--
-- HARD CONSTRAINT (spec §9, COPPA mitigation): 'child' must never be
-- persisted here, for any user, signed in or not. Only 'young_adult' and
-- 'adult' are valid persisted values. This is enforced twice: at the DB
-- layer via the CHECK constraint below, and again at the application layer
-- in lib/narrativeRegister.ts (setNarrativeRegister rejects/no-ops on
-- 'child'). Belt and suspenders — a legal-risk mitigation, not a normal
-- validation rule.
--
-- Idempotent. Run against a Neon DEV branch first.

BEGIN;

ALTER TABLE elder_user
  ADD COLUMN IF NOT EXISTS narrative_register TEXT NOT NULL DEFAULT 'adult';

-- Constraint added separately (ALTER TABLE ... ADD COLUMN ... CHECK isn't
-- universally supported in one step across PG versions we target) and
-- guarded so re-running the migration doesn't fail on a constraint that
-- already exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'elder_user_narrative_register_check'
  ) THEN
    ALTER TABLE elder_user
      ADD CONSTRAINT elder_user_narrative_register_check
      CHECK (narrative_register IN ('young_adult', 'adult'));
  END IF;
END $$;

COMMIT;
