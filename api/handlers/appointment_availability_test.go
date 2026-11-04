package handlers

import (
	"github.com/BryanPMX/CAF/api/models"
	"testing"
	"time"
)

func TestSchedulingOfficeScope(t *testing.T) {
	a, b := uint(1), uint(2)
	employee := models.User{Role: "psychologist", IsActive: true, OfficeID: &a}
	for _, tt := range []struct {
		name, role   string
		office       *uint
		active, want bool
	}{
		{"admin across offices", "admin", &b, true, true},
		{"same office employee", "lawyer", &a, true, true},
		{"different office manager", "office_manager", &b, true, false},
		{"unassigned employee", "psychologist", nil, true, false},
		{"client cannot query", "client", &a, true, false},
		{"inactive employee", "admin", &a, false, false},
	} {
		t.Run(tt.name, func(t *testing.T) {
			employee.IsActive = tt.active
			if got := canScheduleEmployee(models.User{ID: 1, Role: tt.role, OfficeID: tt.office}, employee); got != tt.want {
				t.Fatalf("got %v, want %v", got, tt.want)
			}
		})
	}
}

func TestSchedulingTimeUsesLocalWorkingHours(t *testing.T) {
	now := time.Date(2026, 11, 1, 0, 0, 0, 0, time.UTC)
	for _, tt := range []struct {
		name, start, end, zone string
		valid                  bool
	}{
		{"opening in Mexico City", "2026-11-05T15:00:00Z", "2026-11-05T16:00:00Z", "America/Mexico_City", true},
		{"ends at closing", "2026-11-05T23:00:00Z", "2026-11-06T00:00:00Z", "America/Mexico_City", true},
		{"before opening", "2026-11-05T14:30:00Z", "2026-11-05T15:30:00Z", "America/Mexico_City", false},
		{"after closing", "2026-11-05T23:30:00Z", "2026-11-06T00:30:00Z", "America/Mexico_City", false},
		{"weekend", "2026-11-07T16:00:00Z", "2026-11-07T17:00:00Z", "America/Mexico_City", false},
		{"reversed range", "2026-11-05T16:00:00Z", "2026-11-05T15:00:00Z", "UTC", false},
		{"past", "2026-10-30T10:00:00Z", "2026-10-30T11:00:00Z", "UTC", false},
		{"invalid timezone", "2026-11-05T16:00:00Z", "2026-11-05T17:00:00Z", "invalid", false},
		{"legacy offset", "2026-11-05T09:00:00-07:00", "2026-11-05T10:00:00-07:00", "", true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			start, _ := time.Parse(time.RFC3339, tt.start)
			end, _ := time.Parse(time.RFC3339, tt.end)
			if err := validateSchedulingTime(start, end, now, tt.zone); (err == nil) != tt.valid {
				t.Fatalf("valid=%v, got %v", tt.valid, err)
			}
		})
	}
}
