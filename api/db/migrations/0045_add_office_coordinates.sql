-- Migration: 0045_add_office_coordinates.sql
-- Description: Add latitude and longitude columns to offices table for map markers
-- Date: 2025-02-09
-- Author: CAF System

-- Add latitude column to offices table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'offices' AND column_name = 'latitude'
    ) THEN
        ALTER TABLE offices ADD COLUMN latitude DECIMAL(10,8);
        RAISE NOTICE 'Added latitude column to offices table';
    ELSE
        RAISE NOTICE 'latitude column already exists in offices table';
    END IF;
END $$;

-- Add longitude column to offices table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'offices' AND column_name = 'longitude'
    ) THEN
        ALTER TABLE offices ADD COLUMN longitude DECIMAL(11,8);
        RAISE NOTICE 'Added longitude column to offices table';
    ELSE
        RAISE NOTICE 'longitude column already exists in offices table';
    END IF;
END $$;

-- Add index for geo queries (optional, for future location-based search)
CREATE INDEX IF NOT EXISTS idx_offices_coordinates ON offices(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

COMMENT ON COLUMN offices.latitude IS 'Office latitude for map markers';
COMMENT ON COLUMN offices.longitude IS 'Office longitude for map markers';
