-- Database Schema Verification Script
-- This script verifies that the database schema matches the Go GORM models
-- Run this after applying migrations to ensure everything is synchronized

-- Function to check if a column exists
CREATE OR REPLACE FUNCTION column_exists(p_table_name text, p_column_name text)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = p_table_name AND column_name = p_column_name
    );
END;
$$ LANGUAGE plpgsql;

-- Function to check if a table exists
CREATE OR REPLACE FUNCTION table_exists(p_table_name text)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = p_table_name
    );
END;
$$ LANGUAGE plpgsql;

-- Verification results
DO $$
DECLARE
    missing_columns text[] := ARRAY[]::text[];
    missing_tables text[] := ARRAY[]::text[];
    column_info record;
BEGIN
    RAISE NOTICE '=== DATABASE SCHEMA VERIFICATION ===';
    RAISE NOTICE 'Checking tables and columns against Go GORM models...';
    
    -- Check if all required tables exist
    IF NOT table_exists('offices') THEN
        missing_tables := array_append(missing_tables, 'offices');
    END IF;
    
    IF NOT table_exists('users') THEN
        missing_tables := array_append(missing_tables, 'users');
    END IF;
    
    IF NOT table_exists('cases') THEN
        missing_tables := array_append(missing_tables, 'cases');
    END IF;
    
    IF NOT table_exists('appointments') THEN
        missing_tables := array_append(missing_tables, 'appointments');
    END IF;
    
    IF NOT table_exists('sessions') THEN
        missing_tables := array_append(missing_tables, 'sessions');
    END IF;
    
    IF NOT table_exists('user_case_assignments') THEN
        missing_tables := array_append(missing_tables, 'user_case_assignments');
    END IF;
    
    IF NOT table_exists('tasks') THEN
        missing_tables := array_append(missing_tables, 'tasks');
    END IF;
    
    IF NOT table_exists('task_comments') THEN
        missing_tables := array_append(missing_tables, 'task_comments');
    END IF;
    
    IF NOT table_exists('case_events') THEN
        missing_tables := array_append(missing_tables, 'case_events');
    END IF;
    
    IF NOT table_exists('audit_logs') THEN
        missing_tables := array_append(missing_tables, 'audit_logs');
    END IF;
    
    IF NOT table_exists('notifications') THEN
        missing_tables := array_append(missing_tables, 'notifications');
    END IF;
    
    IF NOT table_exists('announcements') THEN
        missing_tables := array_append(missing_tables, 'announcements');
    END IF;
    
    IF NOT table_exists('announcement_dismissals') THEN
        missing_tables := array_append(missing_tables, 'announcement_dismissals');
    END IF;
    
    IF NOT table_exists('admin_notes') THEN
        missing_tables := array_append(missing_tables, 'admin_notes');
    END IF;
    
    IF NOT table_exists('user_notes') THEN
        missing_tables := array_append(missing_tables, 'user_notes');
    END IF;
    
    IF NOT table_exists('therapist_capacity') THEN
        missing_tables := array_append(missing_tables, 'therapist_capacity');
    END IF;
    
    -- Report missing tables
    IF array_length(missing_tables, 1) > 0 THEN
        RAISE NOTICE '✗ MISSING TABLES: %', array_to_string(missing_tables, ', ');
    ELSE
        RAISE NOTICE '✓ All required tables exist';
    END IF;
    
    -- Check critical columns that were causing errors
    IF NOT column_exists('users', 'last_login') THEN
        missing_columns := array_append(missing_columns, 'users.last_login');
    END IF;
    
    IF NOT column_exists('offices', 'code') THEN
        missing_columns := array_append(missing_columns, 'offices.code');
    END IF;
    
    -- Check other important columns
    IF NOT column_exists('users', 'department') THEN
        missing_columns := array_append(missing_columns, 'users.department');
    END IF;
    
    IF NOT column_exists('users', 'specialty') THEN
        missing_columns := array_append(missing_columns, 'users.specialty');
    END IF;
    
    IF NOT column_exists('users', 'is_active') THEN
        missing_columns := array_append(missing_columns, 'users.is_active');
    END IF;
    
    IF NOT column_exists('users', 'office_id') THEN
        missing_columns := array_append(missing_columns, 'users.office_id');
    END IF;
    
    -- Report missing columns
    IF array_length(missing_columns, 1) > 0 THEN
        RAISE NOTICE '✗ MISSING COLUMNS: %', array_to_string(missing_columns, ', ');
    ELSE
        RAISE NOTICE '✓ All critical columns exist';
    END IF;
    
    -- Check indexes
    RAISE NOTICE '=== INDEX VERIFICATION ===';
    
    -- Check critical indexes
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'users' AND indexname = 'idx_users_last_login'
    ) THEN
        RAISE NOTICE '✓ idx_users_last_login index exists';
    ELSE
        RAISE NOTICE '✗ idx_users_last_login index missing';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'offices' AND indexname = 'idx_offices_code'
    ) THEN
        RAISE NOTICE '✓ idx_offices_code index exists';
    ELSE
        RAISE NOTICE '✗ idx_offices_code index missing';
    END IF;
    
    -- Check foreign key constraints
    RAISE NOTICE '=== FOREIGN KEY VERIFICATION ===';
    
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'users' 
        AND constraint_type = 'FOREIGN KEY' 
        AND constraint_name LIKE '%office_id%'
    ) THEN
        RAISE NOTICE '✓ users.office_id foreign key exists';
    ELSE
        RAISE NOTICE '✗ users.office_id foreign key missing';
    END IF;
    
    -- Final summary
    RAISE NOTICE '=== VERIFICATION SUMMARY ===';
    
    IF array_length(missing_tables, 1) > 0 OR array_length(missing_columns, 1) > 0 THEN
        RAISE NOTICE '❌ SCHEMA VERIFICATION FAILED';
        RAISE NOTICE 'Please run the migration scripts to fix the missing schema elements.';
    ELSE
        RAISE NOTICE '✅ SCHEMA VERIFICATION PASSED';
        RAISE NOTICE 'Database schema is synchronized with Go GORM models.';
    END IF;
    
END $$;

-- Clean up functions
DROP FUNCTION IF EXISTS column_exists(text, text);
DROP FUNCTION IF EXISTS table_exists(text);
