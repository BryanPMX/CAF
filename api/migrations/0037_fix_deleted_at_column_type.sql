-- Migration 0037: Fix timestamp column type issues
-- This migration addresses the GORM auto-migration error where it cannot alter
-- column types because they're used by views

-- Step 1: Drop views that depend on any timestamp columns in the cases table
DROP VIEW IF EXISTS active_cases;
DROP VIEW IF EXISTS deleted_cases;

-- Step 2: Alter all timestamp columns to ensure they're the correct type
-- This allows GORM to successfully alter the column types
ALTER TABLE cases 
ALTER COLUMN deleted_at TYPE timestamp USING deleted_at::timestamp,
ALTER COLUMN completed_at TYPE timestamp USING completed_at::timestamp,
ALTER COLUMN archived_at TYPE timestamp USING archived_at::timestamp,
ALTER COLUMN created_at TYPE timestamp USING created_at::timestamp,
ALTER COLUMN updated_at TYPE timestamp USING updated_at::timestamp;

-- Step 3: Recreate the views with the updated column types
CREATE OR REPLACE VIEW active_cases AS
SELECT * FROM cases 
WHERE deleted_at IS NULL AND is_archived = FALSE;

CREATE OR REPLACE VIEW deleted_cases AS
SELECT * FROM cases 
WHERE deleted_at IS NOT NULL OR is_archived = TRUE;

-- Step 4: Add comments for documentation
COMMENT ON VIEW active_cases IS 'View showing only active (non-deleted, non-archived) cases';
COMMENT ON VIEW deleted_cases IS 'View showing only deleted or archived cases';
