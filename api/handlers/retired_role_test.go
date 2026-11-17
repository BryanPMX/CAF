package handlers

import (
	"fmt"
	"github.com/BryanPMX/CAF/api/config"
	"github.com/BryanPMX/CAF/api/models"
	"github.com/BryanPMX/CAF/api/security"
	"testing"
)

func TestRetiredOfficeRoleCannotAuthenticateOrBeAssigned(t *testing.T) {
	f := authorizationSetup(t)
	if config.IsValidRole("office_manager") || config.IsManagementRole("office_manager") || config.CanManageAccount("office_manager", "client") {
		t.Fatal("retired role remains supported")
	}
	hash, _ := security.HashPassword("Synthetic-E2E-Password123!")
	retired := models.User{FirstName: "Retired", LastName: "Role", Email: "retired-role@example.test", Role: "office_manager", OfficeID: f.admin.OfficeID, IsActive: true, Password: hash}
	f.db.Create(&retired)
	if response := f.request(t, retired, "GET", "/api/v1/organizations?kind=maquila", ""); response.Code != 403 {
		t.Fatalf("retired JWT accessed protected data: %d", response.Code)
	}
	if response := f.request(t, retired, "POST", "/api/v1/login", `{"email":"retired-role@example.test","password":"Synthetic-E2E-Password123!"}`); response.Code != 403 {
		t.Fatalf("retired role authenticated: %d", response.Code)
	}
	payload := fmt.Sprintf(`{"firstName":"Invalid","lastName":"Role","email":"invalid-role@example.test","role":"office_manager","officeId":1,"phone":"6561234567","password":"Synthetic-E2E-Password123!"}`)
	if response := f.request(t, f.admin, "POST", "/api/v1/admin/users", payload); response.Code != 400 {
		t.Fatalf("retired role assigned: %d %s", response.Code, response.Body.String())
	}
}
