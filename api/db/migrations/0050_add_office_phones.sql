-- Migration: 0050_add_office_phones.sql
-- Description: Add phone_office and phone_cell columns to offices table (nullable for existing rows)
-- Date: 2025-02-10
-- Author: CAF System

-- Add phone_office column (nullable - existing offices have no phone data)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'offices' AND column_name = 'phone_office'
    ) THEN
        ALTER TABLE offices ADD COLUMN phone_office VARCHAR(50);
        RAISE NOTICE 'Added phone_office column to offices table';
    ELSE
        RAISE NOTICE 'phone_office column already exists in offices table';
    END IF;
END $$;

-- Add phone_cell column (nullable - optional secondary contact)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'offices' AND column_name = 'phone_cell'
    ) THEN
        ALTER TABLE offices ADD COLUMN phone_cell VARCHAR(50);
        RAISE NOTICE 'Added phone_cell column to offices table';
    ELSE
        RAISE NOTICE 'phone_cell column already exists in offices table';
    END IF;
END $$;

COMMENT ON COLUMN offices.phone_office IS 'Office landline/desk phone (optional for backward compatibility)';
COMMENT ON COLUMN offices.phone_cell IS 'Office mobile/cell phone (optional)';
