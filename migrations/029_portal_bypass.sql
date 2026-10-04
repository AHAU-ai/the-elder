-- migrations/029_portal_bypass.sql
--
-- A signed-in member may choose to skip the portal (the cold room and its
-- door) on arrival and land on the breath, on every device. The door stays
-- visible to everyone who is not signed in; this only records a member's own
-- standing choice. Default FALSE: nobody is opted in by us.
--
-- Additive and idempotent. NOT NULL DEFAULT FALSE is a metadata-only change
-- on PostgreSQL 11+ (no table rewrite).
--
-- DEPLOY ORDER: apply this BEFORE shipping the code that reads it. (The new
-- route degrades to "no preference" if the column is missing, so a missed
-- order never signs anyone out or blocks the door -- but the choice would not
-- save until the column exists.)

ALTER TABLE elder_user
  ADD COLUMN IF NOT EXISTS portal_bypass BOOLEAN NOT NULL DEFAULT FALSE;
