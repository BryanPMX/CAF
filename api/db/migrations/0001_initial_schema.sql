-- Migration: 0001_initial_schema.sql
-- Description: Initial database schema setup for CAF System
-- Date: 2025-01-27 (Renamed for consistency)
-- Author: CAF System Team
-- Version: 3.1 - Fully Synchronized with GORM models (Renamed from 001 to 0001 for consistency)

-- Drop existing tables if they exist (for clean migration)
DROP TABLE IF EXISTS therapist_capacity CASCADE;
DROP TABLE IF EXISTS user_notes CASCADE;
DROP TABLE IF EXISTS admin_notes CASCADE;
DROP TABLE IF EXISTS announcement_dismissals CASCADE;
DROP TABLE IF EXISTS announcements CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS case_events CASCADE;
DROP TABLE IF EXISTS task_comments CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS user_case_assignments CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS cases CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS offices CASCADE;

-- Drop views if they exist
DROP VIEW IF EXISTS active_cases CASCADE;
DROP VIEW IF EXISTS deleted_cases CASCADE;

-- Create offices table (Fully Synchronized with Office model)
CREATE TABLE IF NOT EXISTS offices (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    address TEXT,
    code VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Create users table (Fully Synchronized with User model)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'client',
    office_id INTEGER REFERENCES offices(id),
    department VARCHAR(100),
    specialty VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Create cases table (Fully Synchronized with Case model)
CREATE TABLE IF NOT EXISTS cases (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES users(id),
    office_id INTEGER NOT NULL REFERENCES offices(id),
    court VARCHAR(50),
    docket_number VARCHAR(100),
    fee NUMERIC(10,2) DEFAULT 0,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'open',
    current_stage VARCHAR(50) DEFAULT 'intake',
    category VARCHAR(100) NOT NULL DEFAULT 'legal',
    priority VARCHAR(50) DEFAULT 'medium',
    primary_staff_id BIGINT REFERENCES users(id),
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    completed_by BIGINT REFERENCES users(id),
    completion_note TEXT,
    is_archived BOOLEAN DEFAULT FALSE,
    archived_at TIMESTAMP,
    archived_by BIGINT REFERENCES users(id),
    archive_reason TEXT,
    created_by BIGINT REFERENCES users(id),
    updated_by BIGINT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    deleted_by BIGINT REFERENCES users(id),
    deletion_reason TEXT
);

-- Create appointments table (Fully Synchronized with Appointment model)
CREATE TABLE IF NOT EXISTS appointments (
    id SERIAL PRIMARY KEY,
    case_id INTEGER NOT NULL REFERENCES cases(id),
    staff_id INTEGER NOT NULL REFERENCES users(id),
    office_id INTEGER NOT NULL REFERENCES offices(id),
    title VARCHAR(255) NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    status VARCHAR(50) DEFAULT 'confirmed',
    category VARCHAR(100) DEFAULT 'General',
    department VARCHAR(100) DEFAULT 'General',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Create sessions table (Fully Synchronized with Session model)
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    device_info VARCHAR(500),
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    last_activity TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Create user_case_assignments table (Fully Synchronized with UserCaseAssignment model)
CREATE TABLE IF NOT EXISTS user_case_assignments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    case_id INTEGER NOT NULL REFERENCES cases(id),
    role VARCHAR(50) NOT NULL DEFAULT 'primary',
    assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Create tasks table (Fully Synchronized with Task model)
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    case_id INTEGER NOT NULL REFERENCES cases(id),
    assigned_to_id INTEGER REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(50) DEFAULT 'medium',
    due_date TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pending',
    completed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Create task_comments table (Fully Synchronized with TaskComment model)
CREATE TABLE IF NOT EXISTS task_comments (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    comment TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Create case_events table (Fully Synchronized with CaseEvent model)
-- NOTE: This includes the missing columns that were causing runtime errors
CREATE TABLE IF NOT EXISTS case_events (
    id SERIAL PRIMARY KEY,
    case_id INTEGER NOT NULL REFERENCES cases(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    event_type VARCHAR(100) NOT NULL,
    visibility VARCHAR(50) DEFAULT 'internal',
    comment_text TEXT,
    description TEXT,
    file_name VARCHAR(255),
    file_url VARCHAR(512),
    file_type VARCHAR(100),
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Create audit_logs table (Fully Synchronized with AuditLog model)
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id BIGINT NOT NULL,
    action VARCHAR(50) NOT NULL,
    user_id BIGINT NOT NULL REFERENCES users(id),
    user_role VARCHAR(50) NOT NULL,
    user_office_id BIGINT REFERENCES offices(id),
    user_department VARCHAR(100),
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[],
    ip_address VARCHAR(45),
    user_agent TEXT,
    session_id VARCHAR(255),
    reason TEXT,
    tags TEXT[],
    severity VARCHAR(20) DEFAULT 'info',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- Create notifications table (Fully Synchronized with Notification model)
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    link VARCHAR(500),
    type VARCHAR(50) DEFAULT 'info',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Create announcements table (Fully Synchronized with Announcement model)
CREATE TABLE IF NOT EXISTS announcements (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    is_pinned BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Create announcement_dismissals table (Fully Synchronized with AnnouncementDismissal model)
CREATE TABLE IF NOT EXISTS announcement_dismissals (
    id SERIAL PRIMARY KEY,
    announcement_id INTEGER NOT NULL REFERENCES announcements(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    dismissed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(announcement_id, user_id)
);

-- Create admin_notes table (Fully Synchronized with AdminNote model)
CREATE TABLE IF NOT EXISTS admin_notes (
    id SERIAL PRIMARY KEY,
    case_id INTEGER NOT NULL REFERENCES cases(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    is_private BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Create user_notes table (Fully Synchronized with UserNote model)
CREATE TABLE IF NOT EXISTS user_notes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Create therapist_capacity table (Fully Synchronized with TherapistCapacity model)
CREATE TABLE IF NOT EXISTS therapist_capacity (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    max_cases INTEGER DEFAULT 10,
    current_cases INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create migrations table to track applied migrations
CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY,
    version VARCHAR(50) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    applied_at BIGINT NOT NULL,
    checksum VARCHAR(255) NOT NULL
);

-- Insert essential seed data

-- Insert default office (required for admin user)
INSERT INTO offices (name, address, code) VALUES
('Default Office', 'Default Address', 'DEFAULT')
ON CONFLICT DO NOTHING;

-- Insert admin user with proper credentials (ONLY admin user)
-- Default password: admin123
INSERT INTO users (first_name, last_name, email, password, role, office_id, department, specialty) VALUES
('Admin', 'User', 'admin@caf.org', '$2a$10$HRly5tidgBfZqgZIx8N5Fee.qqRfKvKSIHjcIAx1gjOrkLdxP71Wq', 'admin', 1, 'legal', 'general_practice')
ON CONFLICT (email) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    password = EXCLUDED.password,
    role = EXCLUDED.role,
    department = EXCLUDED.department,
    specialty = EXCLUDED.specialty,
    updated_at = CURRENT_TIMESTAMP;

-- Create indexes for better performance
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department);
CREATE INDEX IF NOT EXISTS idx_users_office_id ON users(office_id);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login);

CREATE INDEX IF NOT EXISTS idx_offices_code ON offices(code);

CREATE INDEX IF NOT EXISTS idx_cases_client_id ON cases(client_id);
CREATE INDEX IF NOT EXISTS idx_cases_office_id ON cases(office_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_category ON cases(category);
CREATE INDEX IF NOT EXISTS idx_cases_primary_staff_id ON cases(primary_staff_id);
CREATE INDEX IF NOT EXISTS idx_cases_deleted_at ON cases(deleted_at);
CREATE INDEX IF NOT EXISTS idx_cases_is_archived ON cases(is_archived);
CREATE INDEX IF NOT EXISTS idx_cases_priority ON cases(priority);
CREATE INDEX IF NOT EXISTS idx_cases_is_completed ON cases(is_completed);
CREATE INDEX IF NOT EXISTS idx_cases_court ON cases(court);
CREATE INDEX IF NOT EXISTS idx_cases_docket_number ON cases(docket_number);

CREATE INDEX IF NOT EXISTS idx_appointments_case_id ON appointments(case_id);
CREATE INDEX IF NOT EXISTS idx_appointments_staff_id ON appointments(staff_id);
CREATE INDEX IF NOT EXISTS idx_appointments_start_time ON appointments(start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_office_id ON appointments(office_id);
CREATE INDEX IF NOT EXISTS idx_appointments_category ON appointments(category);
CREATE INDEX IF NOT EXISTS idx_appointments_department ON appointments(department);
CREATE INDEX IF NOT EXISTS idx_appointments_title ON appointments(title);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_is_active ON sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity);
CREATE INDEX IF NOT EXISTS idx_sessions_user_active_expired ON sessions(user_id, is_active, expires_at);

CREATE INDEX IF NOT EXISTS idx_user_case_assignments_user_id ON user_case_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_case_assignments_case_id ON user_case_assignments(case_id);
CREATE INDEX IF NOT EXISTS idx_user_case_assignments_role ON user_case_assignments(role);
CREATE INDEX IF NOT EXISTS idx_user_case_assignments_user_case ON user_case_assignments(user_id, case_id);

CREATE INDEX IF NOT EXISTS idx_tasks_case_id ON tasks(case_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to_id ON tasks(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);

CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_user_id ON task_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_created_at ON task_comments(created_at);

-- Enhanced indexes for case_events with new columns
CREATE INDEX IF NOT EXISTS idx_case_events_case_id ON case_events(case_id);
CREATE INDEX IF NOT EXISTS idx_case_events_user_id ON case_events(user_id);
CREATE INDEX IF NOT EXISTS idx_case_events_event_type ON case_events(event_type);
CREATE INDEX IF NOT EXISTS idx_case_events_visibility ON case_events(visibility);
CREATE INDEX IF NOT EXISTS idx_case_events_file_type ON case_events(file_type);
CREATE INDEX IF NOT EXISTS idx_case_events_created_at ON case_events(created_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_role ON audit_logs(user_role);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tags ON audit_logs USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_lookup ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_activity ON audit_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_date_range ON audit_logs(created_at, severity);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

CREATE INDEX IF NOT EXISTS idx_announcements_is_active ON announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_announcements_is_pinned ON announcements(is_pinned);

CREATE INDEX IF NOT EXISTS idx_announcement_dismissals_announcement_user ON announcement_dismissals(announcement_id, user_id);

CREATE INDEX IF NOT EXISTS idx_admin_notes_case_id ON admin_notes(case_id);
CREATE INDEX IF NOT EXISTS idx_admin_notes_user_id ON admin_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_notes_is_private ON admin_notes(is_private);

CREATE INDEX IF NOT EXISTS idx_user_notes_user_id ON user_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notes_created_by ON user_notes(created_by);

CREATE INDEX IF NOT EXISTS idx_therapist_capacity_user_id ON therapist_capacity(user_id);

-- Create views for common queries
CREATE OR REPLACE VIEW active_cases AS
SELECT * FROM cases
WHERE deleted_at IS NULL AND is_archived = FALSE;

CREATE OR REPLACE VIEW deleted_cases AS
SELECT * FROM cases
WHERE deleted_at IS NOT NULL OR is_archived = TRUE;

-- Create functions for audit trail
CREATE OR REPLACE FUNCTION set_audit_fields()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.created_at = CURRENT_TIMESTAMP;
        NEW.updated_at = CURRENT_TIMESTAMP;
    ELSIF TG_OP = 'UPDATE' THEN
        NEW.updated_at = CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION log_case_deletion()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
        INSERT INTO audit_logs (
            entity_type, entity_id, action, user_id, user_role,
            old_values, new_values, changed_fields,
            reason, tags, severity
        ) VALUES (
            'case', OLD.id, 'delete', NEW.deleted_by,
            (SELECT role FROM users WHERE id = NEW.deleted_by),
            to_jsonb(OLD), to_jsonb(NEW), ARRAY['deleted_at', 'deleted_by', 'deletion_reason', 'is_archived'],
            NEW.deletion_reason, ARRAY['case_deletion', 'security', 'audit'], 'critical'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_set_audit_fields ON cases;
CREATE TRIGGER trigger_set_audit_fields
    BEFORE INSERT OR UPDATE ON cases
    FOR EACH ROW
    EXECUTE FUNCTION set_audit_fields();

DROP TRIGGER IF EXISTS trigger_log_case_deletion ON cases;
CREATE TRIGGER trigger_log_case_deletion
    AFTER UPDATE ON cases
    FOR EACH ROW
    EXECUTE FUNCTION log_case_deletion();

-- Grant permissions to user (created by Docker Compose)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "user";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "user";

-- Optimize table statistics for query planner
ANALYZE users;
ANALYZE offices;
ANALYZE cases;
ANALYZE appointments;
ANALYZE sessions;
ANALYZE user_case_assignments;
ANALYZE tasks;
ANALYZE task_comments;
ANALYZE case_events;
ANALYZE audit_logs;
ANALYZE notifications;
ANALYZE announcements;
ANALYZE announcement_dismissals;
ANALYZE admin_notes;
ANALYZE user_notes;
ANALYZE therapist_capacity;

-- Insert initial audit log entry
INSERT INTO audit_logs (
    entity_type, entity_id, action, user_id, user_role,
    reason, tags, severity, created_at
) VALUES (
    'system', 0, 'migration', 1, 'admin',
    'Database migration: Initial schema setup (v3.1) - Renamed for consistency, includes case_events missing columns fix',
    ARRAY['migration', 'system', 'initial_setup', 'schema_sync', 'gorm_sync', 'naming_consistency'], 'info', CURRENT_TIMESTAMP
);

-- Update existing cases to set created_by if not set
UPDATE cases
SET created_by = 1, updated_by = 1
WHERE created_by IS NULL;

-- Success notification (must be in DO block)
DO $$
BEGIN
    RAISE NOTICE '✓ Migration 0001_initial_schema completed successfully (renamed for consistency)';
END $$;
