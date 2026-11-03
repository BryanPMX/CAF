package handlers

import (
	"testing"
	"time"
)

func TestNormalizeCalendarEventInputAddsOrganizerAndDeduplicates(t *testing.T) {
	start := time.Date(2026, time.November, 10, 15, 0, 0, 0, time.UTC)
	input := calendarEventInput{
		Title: "  Revisión semanal  ", StartTime: start, EndTime: start.Add(time.Hour),
		AttendeeIDs: []uint{8, 7, 8},
	}

	normalized, err := normalizeCalendarEventInput(input, 7)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if normalized.Title != "Revisión semanal" {
		t.Fatalf("title was not trimmed: %q", normalized.Title)
	}
	if len(normalized.AttendeeIDs) != 2 || normalized.AttendeeIDs[0] != 7 || normalized.AttendeeIDs[1] != 8 {
		t.Fatalf("unexpected attendee IDs: %#v", normalized.AttendeeIDs)
	}
}

func TestNormalizeCalendarEventInputRejectsInvalidTimeRange(t *testing.T) {
	start := time.Date(2026, time.November, 10, 15, 0, 0, 0, time.UTC)
	_, err := normalizeCalendarEventInput(calendarEventInput{
		Title: "Revisión", StartTime: start, EndTime: start,
	}, 7)
	if err == nil {
		t.Fatal("expected invalid time range to fail")
	}
}

func TestParseCalendarRangeBoundaryIncludesDateTo(t *testing.T) {
	parsed, err := parseCalendarRangeBoundary("2026-11-10", true)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	expected := time.Date(2026, time.November, 11, 0, 0, 0, 0, time.UTC)
	if !parsed.Equal(expected) {
		t.Fatalf("got %v, want %v", parsed, expected)
	}
}
