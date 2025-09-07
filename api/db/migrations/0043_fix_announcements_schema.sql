-- Migration: 0043_fix_announcements_schema.sql
-- Description: Fix announcements and admin_notes table schemas to match GORM models
-- Date: 2025-09-07
-- Author: CAF System Team
-- Version: 1.0 - Add missing columns to announcements and admin_notes tables

-- Add missing columns to announcements table
ALTER TABLE announcements 
ADD COLUMN IF NOT EXISTS start_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS end_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS visible_roles TEXT[],
ADD COLUMN IF NOT EXISTS visible_departments TEXT[],
ADD COLUMN IF NOT EXISTS body_html TEXT,
ADD COLUMN IF NOT EXISTS images TEXT[],
ADD COLUMN IF NOT EXISTS tags TEXT[],
ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id);

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_announcements_start_at ON announcements(start_at);
CREATE INDEX IF NOT EXISTS idx_announcements_end_at ON announcements(end_at);
CREATE INDEX IF NOT EXISTS idx_announcements_pinned ON announcements(pinned);
CREATE INDEX IF NOT EXISTS idx_announcements_visible_roles ON announcements USING GIN(visible_roles);
CREATE INDEX IF NOT EXISTS idx_announcements_visible_departments ON announcements USING GIN(visible_departments);

-- Update existing records to have proper values
-- Set pinned = is_pinned for existing records
UPDATE announcements SET pinned = is_pinned WHERE pinned IS NULL;

-- Set body_html = content for existing records (if content exists)
UPDATE announcements SET body_html = content WHERE body_html IS NULL AND content IS NOT NULL;

-- Add comment explaining the schema alignment
COMMENT ON TABLE announcements IS 'Announcements table - synchronized with GORM Announcement model';
COMMENT ON COLUMN announcements.start_at IS 'When the announcement becomes active';
COMMENT ON COLUMN announcements.end_at IS 'When the announcement expires';
COMMENT ON COLUMN announcements.visible_roles IS 'Array of roles that can see this announcement';
COMMENT ON COLUMN announcements.visible_departments IS 'Array of departments that can see this announcement';
COMMENT ON COLUMN announcements.body_html IS 'HTML content of the announcement';
COMMENT ON COLUMN announcements.images IS 'Array of image URLs';
COMMENT ON COLUMN announcements.tags IS 'Array of tags for categorization';
COMMENT ON COLUMN announcements.pinned IS 'Whether this announcement is pinned to the top';
COMMENT ON COLUMN announcements.updated_by IS 'User who last updated this announcement';

-- Fix admin_notes table schema to match GORM AdminNote model
-- First, drop the old columns that don't match the model
ALTER TABLE admin_notes DROP COLUMN IF EXISTS case_id;
ALTER TABLE admin_notes DROP COLUMN IF EXISTS user_id;
ALTER TABLE admin_notes DROP COLUMN IF EXISTS content;
ALTER TABLE admin_notes DROP COLUMN IF EXISTS is_private;

-- Add the correct columns for AdminNote model
ALTER TABLE admin_notes 
ADD COLUMN IF NOT EXISTS body_text TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS start_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS end_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS visible_roles TEXT[],
ADD COLUMN IF NOT EXISTS visible_departments TEXT[],
ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id);

-- Add indexes for admin_notes new columns
CREATE INDEX IF NOT EXISTS idx_admin_notes_start_at ON admin_notes(start_at);
CREATE INDEX IF NOT EXISTS idx_admin_notes_end_at ON admin_notes(end_at);
CREATE INDEX IF NOT EXISTS idx_admin_notes_pinned ON admin_notes(pinned);
CREATE INDEX IF NOT EXISTS idx_admin_notes_created_by ON admin_notes(created_by);
CREATE INDEX IF NOT EXISTS idx_admin_notes_visible_roles ON admin_notes USING GIN(visible_roles);
CREATE INDEX IF NOT EXISTS idx_admin_notes_visible_departments ON admin_notes USING GIN(visible_departments);

-- Add comment explaining the schema alignment
COMMENT ON TABLE admin_notes IS 'Admin notes table - synchronized with GORM AdminNote model';
COMMENT ON COLUMN admin_notes.body_text IS 'Text content of the admin note';
COMMENT ON COLUMN admin_notes.image_url IS 'Optional image URL';
COMMENT ON COLUMN admin_notes.pinned IS 'Whether this note is pinned to the top';
COMMENT ON COLUMN admin_notes.start_at IS 'When the note becomes active';
COMMENT ON COLUMN admin_notes.end_at IS 'When the note expires';
COMMENT ON COLUMN admin_notes.visible_roles IS 'Array of roles that can see this note';
COMMENT ON COLUMN admin_notes.visible_departments IS 'Array of departments that can see this note';
COMMENT ON COLUMN admin_notes.created_by IS 'User who created this note';
COMMENT ON COLUMN admin_notes.updated_by IS 'User who last updated this note';
