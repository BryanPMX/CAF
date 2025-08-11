-- CAF System Database Initialization Script
-- Run this script to set up the basic database structure and sample data

-- Create database (run this as superuser)
-- CREATE DATABASE caf_db;

-- Create user (run this as superuser)
-- CREATE USER caf_user WITH PASSWORD 'caf_password';
-- GRANT ALL PRIVILEGES ON DATABASE caf_db TO caf_user;

-- Connect to caf_db and run the following:

-- Create offices table
CREATE TABLE IF NOT EXISTS offices (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'client',
    office_id INTEGER REFERENCES offices(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Create cases table
CREATE TABLE IF NOT EXISTS cases (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES users(id),
    office_id INTEGER NOT NULL REFERENCES offices(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'open',
    current_stage VARCHAR(50) DEFAULT 'intake',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Create appointments table
CREATE TABLE IF NOT EXISTS appointments (
    id SERIAL PRIMARY KEY,
    case_id INTEGER NOT NULL REFERENCES cases(id),
    staff_id INTEGER NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    status VARCHAR(50) DEFAULT 'confirmed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Insert sample data

-- Insert sample offices
INSERT INTO offices (name, address, phone) VALUES
('Oficina Principal', '123 Calle Principal, Ciudad', '+1-555-0123'),
('Oficina Norte', '456 Avenida Norte, Ciudad', '+1-555-0456')
ON CONFLICT DO NOTHING;

-- Insert admin user with proper credentials
INSERT INTO users (first_name, last_name, email, password, role, office_id) VALUES
('Admin', 'User', 'admin@caf.org', '$2a$10$dNztX6nujx9lVfnYzh9Z3en7Z./Jgg.5nJOyrlm3xL5f69bTz0O5q', 'admin', 1)
ON CONFLICT (email) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    password = EXCLUDED.password,
    role = EXCLUDED.role,
    updated_at = CURRENT_TIMESTAMP;

-- Insert sample staff users
INSERT INTO users (first_name, last_name, email, password, role, office_id) VALUES
('Juan', 'Pérez', 'juan.perez@caf.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'lawyer', 1),
('María', 'García', 'maria.garcia@caf.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'psychologist', 1)
ON CONFLICT (email) DO NOTHING;

-- Insert sample client
INSERT INTO users (first_name, last_name, email, password, role) VALUES
('Carlos', 'López', 'carlos.lopez@email.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'client')
ON CONFLICT (email) DO NOTHING;

-- Insert sample case
INSERT INTO cases (client_id, office_id, title, description, status, current_stage) VALUES
(4, 1, 'Consulta Legal - Familiar', 'Asesoramiento legal para problemas familiares', 'open', 'intake')
ON CONFLICT DO NOTHING;

-- Insert sample appointment
INSERT INTO appointments (case_id, staff_id, title, start_time, end_time, status) VALUES
(1, 2, 'Consulta Inicial', '2024-01-15 10:00:00', '2024-01-15 11:00:00', 'confirmed')
ON CONFLICT DO NOTHING;

-- Create indexes for better performance
-- Partial unique index for email that excludes soft-deleted records
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_cases_client_id ON cases(client_id);
CREATE INDEX IF NOT EXISTS idx_cases_office_id ON cases(office_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_appointments_case_id ON appointments(case_id);
CREATE INDEX IF NOT EXISTS idx_appointments_staff_id ON appointments(staff_id);
CREATE INDEX IF NOT EXISTS idx_appointments_start_time ON appointments(start_time);
CREATE INDEX IF NOT EXISTS idx_tasks_case_id ON tasks(case_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to_id ON tasks(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_case_events_case_id ON case_events(case_id);

-- Grant permissions to caf_user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO caf_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO caf_user;

-- Grant permissions on indexes
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO caf_user;

-- Optimize table statistics for query planner
ANALYZE users;
ANALYZE offices;
ANALYZE cases;
ANALYZE appointments;
ANALYZE tasks;
ANALYZE task_comments;
ANALYZE case_events; 