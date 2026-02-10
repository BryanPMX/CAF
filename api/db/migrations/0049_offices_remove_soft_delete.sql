-- Migration: 0049_offices_remove_soft_delete.sql
-- Description: Remove soft delete from offices; use hard delete only.
-- Permanently removes rows that were soft-deleted, then drops deleted_at column.

-- Remove soft-deleted offices (they will no longer be used)
DELETE FROM offices WHERE deleted_at IS NOT NULL;

-- Drop the deleted_at column
ALTER TABLE offices DROP COLUMN IF EXISTS deleted_at;
