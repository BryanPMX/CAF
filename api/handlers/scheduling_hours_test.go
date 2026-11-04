package handlers

import (
	"testing"
	"time"
)

func TestInternalMeetingWorkingHours(t *testing.T) {
	for _, tt := range []struct {
		name, start, end, zone string
		valid                  bool
	}{
		{"weekday opens at 7", "2026-11-05T13:00:00Z", "2026-11-05T14:00:00Z", "America/Mexico_City", true},
		{"weekday closes at 20", "2026-11-06T01:00:00Z", "2026-11-06T02:00:00Z", "America/Mexico_City", true},
		{"weekday before opening", "2026-11-05T12:59:00Z", "2026-11-05T14:00:00Z", "America/Mexico_City", false},
		{"weekday after closing", "2026-11-06T01:00:00Z", "2026-11-06T02:00:01Z", "America/Mexico_City", false},
		{"Saturday full window", "2026-11-07T14:00:00Z", "2026-11-07T21:00:00Z", "America/Mexico_City", true},
		{"Saturday before opening", "2026-11-07T13:00:00Z", "2026-11-07T15:00:00Z", "America/Mexico_City", false},
		{"Saturday after closing", "2026-11-07T20:00:00Z", "2026-11-07T21:01:00Z", "America/Mexico_City", false},
		{"Sunday", "2026-11-08T16:00:00Z", "2026-11-08T17:00:00Z", "America/Mexico_City", false},
		{"overnight", "2026-11-05T19:00:00Z", "2026-11-06T14:00:00Z", "America/Mexico_City", false},
		{"invalid timezone", "2026-11-05T19:00:00Z", "2026-11-05T20:00:00Z", "bad/timezone", false},
		{"offset fallback", "2026-11-05T07:00:00-07:00", "2026-11-05T08:00:00-07:00", "", true},
		{"DST local morning", "2026-07-06T13:00:00Z", "2026-07-06T14:00:00Z", "America/Denver", true},
		{"winter local morning", "2026-11-05T14:00:00Z", "2026-11-05T15:00:00Z", "America/Denver", true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			start, _ := time.Parse(time.RFC3339, tt.start)
			end, _ := time.Parse(time.RFC3339, tt.end)
			if err := validateWorkingHours(start, end, tt.zone, internalSchedule); (err == nil) != tt.valid {
				t.Fatalf("valid=%v, got %v", tt.valid, err)
			}
		})
	}
}
