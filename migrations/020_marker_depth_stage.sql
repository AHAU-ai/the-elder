-- migrations/020_marker_depth_stage.sql
--
-- Adds a per-marker DEPTH STAGE to Axis 2 (marker_trajectory, migration
-- 009): surface -> confronted -> integrated. Forward/hold only, never
-- automatic regression. See docs/ for the full design record of this
-- decision (added alongside this migration).
--
-- Transition trigger is a pure count on a real seeker action already
-- flowing through /api/elder/confirm-marker (a 'reshape' response, not a
-- passive 'confirm') -- never model-assessed, to avoid reintroducing the
-- exact fabrication risk Axis 2's recurrence-counting design was built to
-- rule out on the appearance-counting side. reshape_count on a given row
-- is already a distinct-visit count by construction: confirm-marker's
-- existing atomic "NOT (markers_confirmed ? field)" guard permits at most
-- one answer per (visitId, field) ever, so N reshapes reaching the same
-- (user_id, marker_type, lower(marker_value)) row necessarily came from N
-- different visits -- no separate visit-id array needed on the hot-path row.
--
-- Idempotent. Run against a Neon DEV branch first.

BEGIN;

ALTER TABLE marker_trajectory
  ADD COLUMN IF NOT EXISTS reshape_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS depth_stage TEXT NOT NULL DEFAULT 'surface'
    CHECK (depth_stage IN ('surface', 'confronted', 'integrated')),
  ADD COLUMN IF NOT EXISTS depth_stage_updated_at TIMESTAMPTZ;

-- Append-only audit log: one row per actual stage transition (rare -- at
-- most two per marker, ever), answering "why did this move" independently
-- of marker_trajectory's own current-state row. References the trajectory
-- row by id, not by re-typed marker_value text, so it cannot reintroduce
-- the casing-drift bug the case-insensitive unique index on
-- marker_trajectory already exists to prevent.
CREATE TABLE IF NOT EXISTS marker_depth_transition (
  id                BIGSERIAL PRIMARY KEY,
  marker_trajectory_id BIGINT NOT NULL REFERENCES marker_trajectory(id) ON DELETE CASCADE,
  user_id           BIGINT NOT NULL REFERENCES elder_user(id) ON DELETE CASCADE,
  marker_type       TEXT NOT NULL CHECK (marker_type IN ('wound', 'figure', 'threshold', 'exile', 'pattern')),
  from_stage        TEXT NOT NULL CHECK (from_stage IN ('surface', 'confronted', 'integrated')),
  to_stage          TEXT NOT NULL CHECK (to_stage IN ('surface', 'confronted', 'integrated')),
  -- visit_record.id is UUID (migrations/004, 008) -- typed to match, but
  -- deliberately not a hard FK: a pruned/deleted visit_record row should
  -- never retroactively invalidate an already-written audit entry.
  visit_id          UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marker_depth_transition_trajectory
  ON marker_depth_transition (marker_trajectory_id);

COMMIT;
