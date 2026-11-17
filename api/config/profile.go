package config

import (
	"strings"
	"unicode"
)

const DepartmentIT = "IT"

// ProfileOrganization contains display values, separate from department keys
// used by assignment and access-control queries.
type ProfileOrganization struct {
	Department *string `json:"department"`
	Specialty  *string `json:"specialty"`
}

func SupportsProfessionalSpecialty(role string) bool {
	return role == RoleLawyer || role == RolePsychologist
}

var specialtyLabels = map[string]string{
	"general_practice":       "Práctica general",
	"family_law":             "Derecho familiar",
	"civil_law":              "Derecho civil",
	"criminal_law":           "Derecho penal",
	"labor_law":              "Derecho laboral",
	"legal_services":         "Servicios legales",
	"general_therapy":        "Psicoterapia general",
	"clinical_psychology":    "Psicología clínica",
	"psychological_services": "Servicios psicológicos",
}

// HumanProfileText keeps custom human-written names and formats legacy identifier keys.
// Migration placeholders are not meaningful profile information.
func HumanProfileText(value string) string {
	value = strings.TrimSpace(value)
	switch strings.ToLower(value) {
	case "", "undefined", "null", "unknown", "n/a", "development", "test":
		return ""
	}
	if strings.ContainsAny(value, "_-") {
		words := strings.Fields(strings.NewReplacer("_", " ", "-", " ").Replace(value))
		if len(words) == 0 {
			return ""
		}
		runes := []rune(strings.Join(words, " "))
		runes[0] = unicode.ToUpper(runes[0])
		return string(runes)
	}
	return value
}

func ProfileOrganizationFor(role string, department, specialty *string) ProfileOrganization {
	result := ProfileOrganization{}
	if role == "client" {
		return result
	}
	rawDepartment := ""
	if department != nil {
		rawDepartment = HumanProfileText(*department)
	}
	if role == RoleTechnicalSupport {
		rawDepartment = DepartmentIT
	} else if rawDepartment == "" {
		rawDepartment = STAFF_ROLES[role].Department
	}
	if rawDepartment != "" {
		label := GetDepartmentLabel(rawDepartment)
		result.Department = &label
	}
	if SupportsProfessionalSpecialty(role) && specialty != nil && SpecialtyFitsRole(role, *specialty) {
		label, exists := specialtyLabels[strings.ToLower(strings.TrimSpace(*specialty))]
		if !exists {
			label = HumanProfileText(*specialty)
		}
		if label != "" {
			result.Specialty = &label
		}
	}
	return result
}

// Known professional codes and their translated labels must match the role.
// Custom human-written areas remain valid within either practitioner role.
func SpecialtyFitsRole(role, value string) bool {
	value = strings.ToLower(strings.TrimSpace(value))
	for key, label := range specialtyLabels {
		if value != key && value != strings.ToLower(label) {
			continue
		}
		switch key {
		case "family_law", "civil_law", "criminal_law", "labor_law", "legal_services":
			return role == RoleLawyer
		case "clinical_psychology", "general_therapy", "psychological_services":
			return role == RolePsychologist
		default:
			return SupportsProfessionalSpecialty(role)
		}
	}
	return SupportsProfessionalSpecialty(role)
}
