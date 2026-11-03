-- Migration: 0061_create_employee_calendar.sql
-- Description: Internal employee calendar events and attendee responses.

CREATE TABLE IF NOT EXISTS calendar_events (
    id BIGSERIAL PRIMARY KEY,
    organizer_id BIGINT NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    location VARCHAR(255) NOT NULL DEFAULT '',
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_calendar_events_time_range CHECK (end_time > start_time)
);

CREATE TABLE IF NOT EXISTS calendar_event_attendees (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES calendar_events(id) ON UPDATE CASCADE ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    response_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_calendar_event_attendee UNIQUE (event_id, user_id),
    CONSTRAINT chk_calendar_attendee_response CHECK (response_status IN ('pending', 'accepted', 'tentative', 'declined'))
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_organizer ON calendar_events(organizer_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_time_range ON calendar_events(start_time, end_time) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_events_deleted_at ON calendar_events(deleted_at);
CREATE INDEX IF NOT EXISTS idx_calendar_event_attendees_user ON calendar_event_attendees(user_id, event_id);

COMMENT ON TABLE calendar_events IS 'Internal employee meetings, separate from case/client appointments';
COMMENT ON TABLE calendar_event_attendees IS 'Employee invitations and response status for internal calendar events';
