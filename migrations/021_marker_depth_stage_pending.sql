-- migrations/021_marker_depth_stage_pending.sql
--
-- Adds a proposed-then-affirmed gate in front of migration 020's
-- depth_stage write. The Elder never gets to decide a seeker has grown --
-- crossing the reshape-count threshold now only computes a PROPOSAL
-- (pending_stage), still pure count-based, zero model judgment. The
-- seeker's own explicit affirmation (POST /api/elder/confirm-depth-stage)
-- is what finalizes it into depth_stage, mirroring confirm-marker's own
-- propose/ratify shape exactly.
--
-- Idempotent. Run against a Neon DEV branch first.

BEGIN;

ALTER TABLE marker_trajectory
  ADD COLUMN IF NOT EXISTS pending_stage TEXT
    CHECK (pending_stage IS NULL OR pending_stage IN ('surface', 'confronted', 'integrated'));

COMMIT;
