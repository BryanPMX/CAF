package config

import "testing"

func TestExecutiveAndOfficeAdministratorPermissions(t *testing.T) {
	for _, role := range VALID_ROLES {
		if CanAccessAllOffices(role) != (role == RoleExecutiveDirector) {
			t.Errorf("unexpected office access for %s", role)
		}
		if CanManageWebContent(role) != (role == RoleExecutiveDirector) {
			t.Errorf("unexpected website access for %s", role)
		}
	}
	if !RequiresOffice(RoleAdmin) || RequiresOffice(RoleExecutiveDirector) {
		t.Fatal("incorrect office requirement")
	}
	if !IsManagementRole(RoleExecutiveDirector) || !IsManagementRole(RoleAdmin) {
		t.Fatal("management capability missing")
	}
	if !IsValidRole(RoleExecutiveDirector) || CanAccessAllOffices("unknown") {
		t.Fatal("invalid role handling")
	}
	if STAFF_ROLES[RoleExecutiveDirector].SpanishName != "Director Ejecutivo" {
		t.Fatal("incorrect executive label")
	}
}
