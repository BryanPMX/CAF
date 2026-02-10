-- Migration: 0049_offices_remove_soft_delete.sql
-- Description: Remove soft delete from offices; use hard delete only.
-- Reassigns users, cases, appointments, audit_logs, and therapist_office_capacities
-- that reference soft-deleted offices to one remaining office, then deletes the rest and drops deleted_at.

DO $$
DECLARE
  anchor_id INTEGER;
BEGIN
  -- Choose one office to keep: first with deleted_at IS NULL, or if all are soft-deleted, keep the first by id
  SELECT id INTO anchor_id FROM offices WHERE deleted_at IS NULL ORDER BY id LIMIT 1;
  IF anchor_id IS NULL THEN
    SELECT id INTO anchor_id FROM offices ORDER BY id LIMIT 1;
    IF anchor_id IS NOT NULL THEN
      UPDATE offices SET deleted_at = NULL WHERE id = anchor_id;
    END IF;
  END IF;

  IF anchor_id IS NOT NULL THEN
    -- Reassign references to the anchor office so we can delete the soft-deleted offices
    UPDATE users SET office_id = anchor_id WHERE office_id IN (SELECT id FROM offices WHERE deleted_at IS NOT NULL);
    UPDATE cases SET office_id = anchor_id WHERE office_id IN (SELECT id FROM offices WHERE deleted_at IS NOT NULL);
    UPDATE appointments SET office_id = anchor_id WHERE office_id IN (SELECT id FROM offices WHERE deleted_at IS NOT NULL);
    UPDATE audit_logs SET user_office_id = anchor_id WHERE user_office_id IN (SELECT id FROM offices WHERE deleted_at IS NOT NULL);
    -- Remove capacity rows for offices we are about to delete (no FK in 0040, but keeps data consistent)
    DELETE FROM therapist_office_capacities WHERE office_id IN (SELECT id FROM offices WHERE deleted_at IS NOT NULL);
  END IF;
END $$;

-- Now safe to delete soft-deleted offices
DELETE FROM offices WHERE deleted_at IS NOT NULL;

-- Drop the column
ALTER TABLE offices DROP COLUMN IF EXISTS deleted_at;
