-- migrations/017_share_card_provenance.sql
--
-- Resolves src/resilience/provenance.ts's provenanceMetadata() doc comment
-- ("the machine-readable stamp embedded in every exported/shared artifact")
-- for the persisted half of "exported/shared": a signed-in seeker's kept
-- card, reachable via the public /share/[id] link. The PNG half (every
-- seeker, signed-in or anonymous) is handled client-side in
-- lib/pngProvenance.ts and never touches the database.
--
-- Nullable, not backfilled: existing share_card rows predate this column
-- and genuinely have no provenance to record (the reading that produced
-- them is long gone) -- NULL here means "unknown," not "empty," and no
-- fabricated value would be honest.

ALTER TABLE share_card
  ADD COLUMN IF NOT EXISTS provenance JSONB NULL;
