package handlers

import (
	"testing"

	"github.com/BryanPMX/CAF/api/models"
)

func TestApplyCaseCreationScopeKeepsAdminOfficeChoice(t *testing.T) {
	request := map[string]interface{}{"officeId": float64(42)}
	if err := applyCaseCreationScope(request, models.User{Role: "admin"}); err != nil {
		t.Fatalf("admin scope failed: %v", err)
	}
	if got := request["officeId"]; got != float64(42) {
		t.Fatalf("admin office changed: %#v", got)
	}
}

func TestApplyCaseCreationScopeForcesAssignedOffice(t *testing.T) {
	officeID := uint(14)
	request := map[string]interface{}{}
	actor := models.User{Role: "psychologist", OfficeID: &officeID}
	if err := applyCaseCreationScope(request, actor); err != nil {
		t.Fatalf("staff scope failed: %v", err)
	}
	if got := request["officeId"]; got != float64(officeID) {
		t.Fatalf("got office %#v, want %d", got, officeID)
	}
}

func TestApplyCaseCreationScopeRejectsDifferentOffice(t *testing.T) {
	officeID := uint(14)
	request := map[string]interface{}{"officeId": float64(22)}
	actor := models.User{Role: "psychologist", OfficeID: &officeID}
	if err := applyCaseCreationScope(request, actor); err == nil {
		t.Fatal("expected cross-office case creation to fail")
	}
}
