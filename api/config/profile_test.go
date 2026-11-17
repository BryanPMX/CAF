package config

import "testing"

func TestProfileOrganizationUsesReadableRoleAppropriateValues(t *testing.T) {
	department, specialty := "legal", "general_practice"
	for _, role := range VALID_ROLES {
		info := ProfileOrganizationFor(role, &department, &specialty)
		if role == "client" {
			if info.Department != nil || info.Specialty != nil {
				t.Fatal("clients inherited staff migration defaults")
			}
			continue
		}
		want := "Legal"
		if role == RoleTechnicalSupport {
			want = "Tecnologías de la Información (IT)"
		}
		if info.Department == nil || *info.Department != want {
			t.Fatalf("%s department: %#v", role, info)
		}
		if SupportsProfessionalSpecialty(role) {
			if info.Specialty == nil || *info.Specialty != "Práctica general" {
				t.Fatal("practitioner specialty is not localized")
			}
		} else if info.Specialty != nil {
			t.Fatalf("%s has an irrelevant specialty", role)
		}
	}
	for raw, want := range map[string]string{"Legal": "Legal", "psychology": "Psicología", "Management": "Dirección", "IT": "Tecnologías de la Información (IT)", "Recursos": "Recursos"} {
		if got := GetDepartmentLabel(raw); got != want {
			t.Fatalf("%s: %s != %s", raw, got, want)
		}
	}
	custom := "derecho_aduanero"
	if got := ProfileOrganizationFor(RoleLawyer, nil, &custom); got.Specialty == nil || *got.Specialty != "Derecho aduanero" {
		t.Fatal("custom specialty still exposes an identifier")
	}
	placeholder := "undefined"
	if got := ProfileOrganizationFor(RolePsychologist, nil, &placeholder); got.Specialty != nil || got.Department == nil || *got.Department != "Psicología" {
		t.Fatal("missing professional metadata has no safe fallback")
	}
}

func TestSpecialtyFollowsProfessionalRole(t *testing.T) {
	for _, value := range []string{"family_law", "Derecho familiar"} {
		if !SpecialtyFitsRole(RoleLawyer, value) || SpecialtyFitsRole(RolePsychologist, value) {
			t.Fatal("legal specialty accepted for unrelated role")
		}
	}
	for _, value := range []string{"clinical_psychology", "Psicología clínica"} {
		if !SpecialtyFitsRole(RolePsychologist, value) || SpecialtyFitsRole(RoleLawyer, value) {
			t.Fatal("psychological specialty accepted for unrelated role")
		}
	}
	department, specialty := "psychology", "family_law"
	if got := ProfileOrganizationFor(RolePsychologist, &department, &specialty); got.Specialty != nil {
		t.Fatal("legacy unrelated specialty was displayed")
	}
}
