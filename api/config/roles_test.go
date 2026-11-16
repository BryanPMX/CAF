package config

import "testing"

func TestExecutiveAndOfficeAdministratorPermissions(t *testing.T) {
	for _, role := range VALID_ROLES {
		if CanAccessAllOffices(role) != (role == RoleExecutiveDirector || role == RoleTechnicalSupport) {
			t.Errorf("unexpected office access for %s", role)
		}
		if CanManageWebContent(role) != (role == RoleExecutiveDirector || role == RoleTechnicalSupport) {
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

func TestSupportRolePolicy(t *testing.T) {
	for _, role := range VALID_ROLES {
		if CanResetPasswords(role) != (role == RoleTechnicalSupport) {
			t.Errorf("password permission for %s", role)
		}
		if CanManageAccount(role, RoleTechnicalSupport) != (role == RoleTechnicalSupport) {
			t.Errorf("support edit permission for %s", role)
		}
	}
	if RequiresOffice(RoleTechnicalSupport) || !CanManageAccount(RoleTechnicalSupport, RoleExecutiveDirector) {
		t.Fatal("support scope incorrect")
	}
	if STAFF_ROLES[RoleTechnicalSupport].SpanishName != "Soporte Tecnico" {
		t.Fatal("support label mismatch")
	}
}
