-- Migration: 0041_advanced_performance_optimization.sql
-- Description: Advanced Performance Optimization - Comprehensive indexes and performance enhancements
-- Date: 2025-01-27
-- Author: CAF System Team
-- Version: 1.0 - Migrated from legacy migrations directory

-- 1. Advanced Composite Indexes for Common Query Patterns
CREATE INDEX IF NOT EXISTS idx_cases_performance_main ON cases(office_id, category, status, is_archived, deleted_at) 
WHERE deleted_at IS NULL AND is_archived = false;

CREATE INDEX IF NOT EXISTS idx_cases_search ON cases USING gin(to_tsvector('spanish', title || ' ' || COALESCE(docket_number, '') || ' ' || COALESCE(court, '')));

CREATE INDEX IF NOT EXISTS idx_appointments_performance_main ON appointments(office_id, department, status, deleted_at, start_time) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_performance_main ON users(role, department, office_id, is_active, deleted_at) 
WHERE deleted_at IS NULL;

-- 2. Partial Indexes for Better Performance
CREATE INDEX IF NOT EXISTS idx_cases_active ON cases(id, title, category, current_stage) 
WHERE deleted_at IS NULL AND is_archived = false AND status != 'deleted';

CREATE INDEX IF NOT EXISTS idx_appointments_upcoming ON appointments(id, title, start_time, staff_id) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_staff ON users(id, first_name, last_name, role, department) 
WHERE deleted_at IS NULL AND role IN ('staff', 'office_manager', 'admin');

-- 3. Covering Indexes for Common Queries
CREATE INDEX IF NOT EXISTS idx_cases_covering_list ON cases(id, title, category, current_stage, created_at, office_id, client_id) 
INCLUDE (docket_number, court, status);

CREATE INDEX IF NOT EXISTS idx_appointments_covering_list ON appointments(id, title, start_time, end_time, status, staff_id, case_id) 
INCLUDE (department, category);

-- 4. Indexes for Foreign Key Relationships
CREATE INDEX IF NOT EXISTS idx_case_events_case_user ON case_events(case_id, user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_task_comments_task_user ON task_comments(task_id, user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_user_case_assignments_composite ON user_case_assignments(user_id, case_id);

-- 5. Indexes for Date Range Queries
CREATE INDEX IF NOT EXISTS idx_cases_created_date ON cases(created_at DESC) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_start_date ON appointments(start_time DESC) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_case_events_date ON case_events(created_at DESC);

-- 6. Indexes for Full-Text Search
CREATE INDEX IF NOT EXISTS idx_cases_fts ON cases USING gin(to_tsvector('spanish', 
  COALESCE(title, '') || ' ' || 
  COALESCE(description, '') || ' ' || 
  COALESCE(docket_number, '') || ' ' || 
  COALESCE(court, '')
));

CREATE INDEX IF NOT EXISTS idx_users_fts ON users USING gin(to_tsvector('spanish', 
  COALESCE(first_name, '') || ' ' || 
  COALESCE(last_name, '') || ' ' || 
  COALESCE(email, '')
));

-- 7. Indexes for Aggregation Queries
CREATE INDEX IF NOT EXISTS idx_cases_stats ON cases(category, status, created_at) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_stats ON appointments(department, status, start_time) 
WHERE deleted_at IS NULL;

-- 8. Optimize Table Statistics
ANALYZE cases;
ANALYZE appointments;
ANALYZE users;
ANALYZE case_events;
ANALYZE tasks;
ANALYZE task_comments;
ANALYZE user_case_assignments;

-- 9. Create Materialized Views for Complex Queries
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_case_summary AS
SELECT 
  c.id,
  c.title,
  c.category,
  c.status,
  c.current_stage,
  c.created_at,
  c.office_id,
  o.name as office_name,
  cl.first_name as client_first_name,
  cl.last_name as client_last_name,
  COUNT(ce.id) as event_count,
  COUNT(t.id) as task_count,
  COUNT(a.id) as appointment_count
FROM cases c
LEFT JOIN offices o ON c.office_id = o.id
LEFT JOIN users cl ON c.client_id = cl.id
LEFT JOIN case_events ce ON c.id = ce.case_id
LEFT JOIN tasks t ON c.id = t.case_id
LEFT JOIN appointments a ON c.id = a.case_id
WHERE c.deleted_at IS NULL AND c.is_archived = false
GROUP BY c.id, c.title, c.category, c.status, c.current_stage, c.created_at, c.office_id, o.name, cl.first_name, cl.last_name;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_case_summary_id ON mv_case_summary(id);
CREATE INDEX IF NOT EXISTS idx_mv_case_summary_category ON mv_case_summary(category);
CREATE INDEX IF NOT EXISTS idx_mv_case_summary_status ON mv_case_summary(status);

-- 10. Create Function for Case Statistics
CREATE OR REPLACE FUNCTION get_case_statistics(
  p_office_id INTEGER DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL
) RETURNS TABLE(
  total_cases BIGINT,
  open_cases BIGINT,
  completed_cases BIGINT,
  cases_by_category JSON,
  cases_by_stage JSON,
  avg_resolution_time INTERVAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_cases,
    COUNT(*) FILTER (WHERE status = 'open')::BIGINT as open_cases,
    COUNT(*) FILTER (WHERE status = 'completed')::BIGINT as completed_cases,
    json_object_agg(category, count) FILTER (WHERE category IS NOT NULL) as cases_by_category,
    json_object_agg(current_stage, count) FILTER (WHERE current_stage IS NOT NULL) as cases_by_stage,
    AVG(updated_at - created_at) FILTER (WHERE status = 'completed') as avg_resolution_time
  FROM cases
  WHERE deleted_at IS NULL 
    AND is_archived = false
    AND (p_office_id IS NULL OR office_id = p_office_id)
    AND (p_category IS NULL OR category = p_category)
    AND (p_date_from IS NULL OR created_at >= p_date_from)
    AND (p_date_to IS NULL OR created_at <= p_date_to);
END;
$$ LANGUAGE plpgsql;

-- 11. Create Function for Appointment Statistics
CREATE OR REPLACE FUNCTION get_appointment_statistics(
  p_office_id INTEGER DEFAULT NULL,
  p_department TEXT DEFAULT NULL,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL
) RETURNS TABLE(
  total_appointments BIGINT,
  confirmed_appointments BIGINT,
  completed_appointments BIGINT,
  appointments_by_department JSON,
  avg_duration INTERVAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_appointments,
    COUNT(*) FILTER (WHERE status = 'confirmed')::BIGINT as confirmed_appointments,
    COUNT(*) FILTER (WHERE status = 'completed')::BIGINT as completed_appointments,
    json_object_agg(department, count) FILTER (WHERE department IS NOT NULL) as appointments_by_department,
    AVG(end_time - start_time) as avg_duration
  FROM appointments a
  JOIN cases c ON a.case_id = c.id
  WHERE a.deleted_at IS NULL 
    AND (p_office_id IS NULL OR c.office_id = p_office_id)
    AND (p_department IS NULL OR a.department = p_department)
    AND (p_date_from IS NULL OR a.start_time >= p_date_from)
    AND (p_date_to IS NULL OR a.start_time <= p_date_to);
END;
$$ LANGUAGE plpgsql;

-- 12. Create Trigger for Materialized View Refresh
CREATE OR REPLACE FUNCTION refresh_case_summary()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_case_summary;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_refresh_case_summary
  AFTER INSERT OR UPDATE OR DELETE ON cases
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_case_summary();

-- 13. Create Performance Monitoring Views
CREATE OR REPLACE VIEW v_table_performance AS
SELECT 
  schemaname,
  relname as tablename,
  seq_scan,
  seq_tup_read,
  idx_scan,
  idx_tup_fetch,
  n_tup_ins,
  n_tup_upd,
  n_tup_del,
  n_live_tup,
  n_dead_tup,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;

-- 14. Add Comments for Documentation
COMMENT ON INDEX idx_cases_performance_main IS 'Composite index for main case queries with office, category, and status filtering';
COMMENT ON INDEX idx_cases_search IS 'Full-text search index for case title, docket number, and court';
COMMENT ON INDEX idx_appointments_performance_main IS 'Composite index for appointment queries with office and department filtering';
COMMENT ON INDEX idx_users_performance_main IS 'Composite index for user queries with role and department filtering';
COMMENT ON MATERIALIZED VIEW mv_case_summary IS 'Materialized view for fast case summary queries with related counts';
COMMENT ON FUNCTION get_case_statistics IS 'Function to get comprehensive case statistics with filtering options';
COMMENT ON FUNCTION get_appointment_statistics IS 'Function to get comprehensive appointment statistics with filtering options';

-- Insert audit log entry for this migration
INSERT INTO audit_logs (
    entity_type, entity_id, action, user_id, user_role,
    reason, tags, severity, created_at
) VALUES (
    'system', 0, 'migration', 1, 'admin',
    'Migrated legacy migration: Advanced performance optimization with comprehensive indexes and functions',
    ARRAY['migration', 'legacy_consolidation', 'performance', 'indexes', 'optimization'], 'info', CURRENT_TIMESTAMP
);

-- Final Statistics Update
ANALYZE;

-- Success notification (must be in DO block)
DO $$
BEGIN
    RAISE NOTICE '✓ Migration 0041_advanced_performance_optimization completed successfully';
END $$;
