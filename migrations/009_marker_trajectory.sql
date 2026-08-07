-- migrations/009_marker_trajectory.sql
-- The Elder — structural recurrence for confirmed markers.
--
-- marker_trajectory tracks how many times each (marker_type, marker_value)
-- has been CONFIRMED (confirmed or reshaped, never declined) via
-- /api/elder/confirm-marker — one row per distinct value a seeker has
-- ratified, incremented each time it recurs. Nothing here reads the
-- model's raw proposed markers as fact; only what the seeker confirmed
-- counts toward a count.
--
-- No separate co-occurrence table. Pairing ("this wound, always beside
-- this figure") is computed at read time in lib/returning/markerTrajectory.ts
-- from visit_record.markers (the proposed superset) filtered down to values
-- that have themselves crossed the confirmed floor here — see that module's
-- header for why a precomputed pairing table would be dishonest to what's
-- actually confirmed (only one marker is ever confirmed per visit, so two
-- markers are never confirmed together in the same row).
--
-- Idempotent. Run against a Neon DEV branch first.

BEGIN;

CREATE TABLE IF NOT EXISTS marker_trajectory (
  id                BIGSERIAL PRIMARY KEY,
  user_id           BIGINT NOT NULL REFERENCES elder_user(id) ON DELETE CASCADE,
  marker_type       TEXT NOT NULL CHECK (marker_type IN ('wound', 'figure', 'threshold', 'exile', 'pattern')),
  marker_value      TEXT NOT NULL,
  appearance_count  INTEGER NOT NULL DEFAULT 1,
  first_seen        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Case-insensitive dedupe, same pattern as myth_archetype's
-- ON CONFLICT (user_id, (lower(archetype_name))).
CREATE UNIQUE INDEX IF NOT EXISTS uq_marker_trajectory_user_type_value
  ON marker_trajectory (user_id, marker_type, lower(marker_value));

CREATE INDEX IF NOT EXISTS idx_marker_trajectory_user_count
  ON marker_trajectory (user_id, appearance_count DESC);

COMMIT;
