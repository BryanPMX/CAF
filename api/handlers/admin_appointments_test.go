package handlers

import (
	"testing"
	"time"
)

func validSmartAppointmentInput() SmartAppointmentInput {
	clientID := uint(4)
	caseID := uint(8)
	start := time.Date(2026, time.November, 5, 16, 0, 0, 0, time.UTC)
	return SmartAppointmentInput{
		ClientID:   &clientID,
		CaseID:     &caseID,
		StaffID:    12,
		Title:      "  Seguimiento  ",
		StartTime:  start,
		EndTime:    start.Add(time.Hour),
		Status:     "confirmed",
		Department: "Psicologia",
		Category:   "Psicologia",
	}
}

func TestValidateSmartAppointmentInputAcceptsExistingClientAndCase(t *testing.T) {
	input := validSmartAppointmentInput()
	if err := validateSmartAppointmentInput(&input); err != nil {
		t.Fatalf("valid input failed: %v", err)
	}
	if input.Title != "Seguimiento" {
		t.Fatalf("title was not normalized: %q", input.Title)
	}
}

func TestValidateSmartAppointmentInputRejectsInvalidTimeRange(t *testing.T) {
	input := validSmartAppointmentInput()
	input.EndTime = input.StartTime
	if err := validateSmartAppointmentInput(&input); err == nil {
		t.Fatal("expected invalid time range to fail")
	}
}

func TestValidateSmartAppointmentInputRequiresExactlyOneClient(t *testing.T) {
	input := validSmartAppointmentInput()
	input.ClientID = nil
	if err := validateSmartAppointmentInput(&input); err == nil {
		t.Fatal("expected missing client choice to fail")
	}
}
