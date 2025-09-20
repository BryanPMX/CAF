package config

import (
	"fmt"
	"strings"
)

// StaffRole represents a staff role in the CAF system
type StaffRole struct {
	Key         string `json:"key"`
	SpanishName string `json:"spanish_name"`
	EnglishName string `json:"english_name"`
	Department  string `json:"department"`
	Description string `json:"description"`
}

// Role constants - Single source of truth for all role keys
const (
	RoleAdmin            = "admin"
	RoleOfficeManager    = "office_manager"
	RoleLawyer           = "lawyer"
	RolePsychologist     = "psychologist"
	RoleReceptionist     = "receptionist"
	RoleEventCoordinator = "event_coordinator"
)

// STAFF_ROLES is the authoritative list of all valid staff roles
// This is the single source of truth for role definitions
var STAFF_ROLES = map[string]StaffRole{
	RoleAdmin: {
		Key:         RoleAdmin,
		SpanishName: "Administrador",
		EnglishName: "Administrator",
		Department:  "Administration",
		Description: "Full system access and management",
	},
	RoleOfficeManager: {
		Key:         RoleOfficeManager,
		SpanishName: "Gerente de Oficina",
		EnglishName: "Office Manager",
		Department:  "Management",
		Description: "Office-level management and oversight",
	},
	RoleLawyer: {
		Key:         RoleLawyer,
		SpanishName: "Abogado/a",
		EnglishName: "Lawyer",
		Department:  "Legal",
		Description: "Legal case management and documentation",
	},
	RolePsychologist: {
		Key:         RolePsychologist,
		SpanishName: "Psicólogo/a",
		EnglishName: "Psychologist",
		Department:  "Psychology",
		Description: "Psychological assessment and counseling",
	},
	RoleReceptionist: {
		Key:         RoleReceptionist,
		SpanishName: "Recepcionista",
		EnglishName: "Receptionist",
		Department:  "Administration",
		Description: "Front desk and appointment management",
	},
	RoleEventCoordinator: {
		Key:         RoleEventCoordinator,
		SpanishName: "Coordinador/a de Eventos",
		EnglishName: "Event Coordinator",
		Department:  "Events",
		Description: "Event planning and coordination",
	},
}

// VALID_ROLES contains all valid role keys for validation
var VALID_ROLES = []string{
	RoleAdmin,
	RoleOfficeManager,
	RoleLawyer,
	RolePsychologist,
	RoleReceptionist,
	RoleEventCoordinator,
}

// Role validation functions

// IsValidRole checks if a role key is valid
func IsValidRole(role string) bool {
	_, exists := STAFF_ROLES[role]
	return exists
}

// ValidateRole validates a role and returns an error if invalid
func ValidateRole(role string) error {
	if !IsValidRole(role) {
		return fmt.Errorf("invalid role '%s'. Valid roles are: %s", role, strings.Join(VALID_ROLES, ", "))
	}
	return nil
}

// GetRoleInfo returns role information for a given role key
func GetRoleInfo(role string) (StaffRole, error) {
	roleInfo, exists := STAFF_ROLES[role]
	if !exists {
		return StaffRole{}, fmt.Errorf("role '%s' not found", role)
	}
	return roleInfo, nil
}

// GetAllRoles returns all available roles
func GetAllRoles() map[string]StaffRole {
	return STAFF_ROLES
}

// GetRolesByDepartment returns all roles in a specific department
func GetRolesByDepartment(department string) map[string]StaffRole {
	roles := make(map[string]StaffRole)
	for key, role := range STAFF_ROLES {
		if role.Department == department {
			roles[key] = role
		}
	}
	return roles
}

// Permission checking functions

// CanAccessAllOffices checks if a role can access data from all offices
func CanAccessAllOffices(role string) bool {
	return role == RoleAdmin
}

// CanManageUsers checks if a role can manage users
func CanManageUsers(role string) bool {
	return role == RoleAdmin
}

// CanManageOffices checks if a role can manage offices
func CanManageOffices(role string) bool {
	return role == RoleAdmin
}

// CanManageFiles checks if a role can manage files
func CanManageFiles(role string) bool {
	return role == RoleAdmin
}

// CanManageWebContent checks if a role can manage web content
func CanManageWebContent(role string) bool {
	return role == RoleAdmin || role == RoleOfficeManager || role == RoleEventCoordinator
}

// CanViewLegalDocuments checks if a role can view legal documents
func CanViewLegalDocuments(role string) bool {
	return role == RoleAdmin || role == RoleLawyer
}

// CanViewPsychologicalDocuments checks if a role can view psychological documents
func CanViewPsychologicalDocuments(role string) bool {
	return role == RoleAdmin || role == RolePsychologist
}

// CanViewCases checks if a role can view cases
func CanViewCases(role string) bool {
	return role == RoleAdmin || role == RoleOfficeManager || role == RoleLawyer || role == RolePsychologist || role == RoleReceptionist
}

// CanViewAppointments checks if a role can view appointments
func CanViewAppointments(role string) bool {
	return role == RoleAdmin || role == RoleOfficeManager || role == RoleLawyer || role == RolePsychologist || role == RoleReceptionist
}

// CanViewEvents checks if a role can view events
func CanViewEvents(role string) bool {
	return role == RoleAdmin || role == RoleEventCoordinator
}

// IsProfessionalRole checks if a role is a professional service role
func IsProfessionalRole(role string) bool {
	return role == RoleLawyer || role == RolePsychologist
}

// IsAdministrativeRole checks if a role is an administrative role
func IsAdministrativeRole(role string) bool {
	return role == RoleAdmin || role == RoleOfficeManager || role == RoleReceptionist
}

// IsManagementRole checks if a role is a management role
func IsManagementRole(role string) bool {
	return role == RoleAdmin || role == RoleOfficeManager
}

// GetRoleHierarchyLevel returns the hierarchy level of a role (lower number = higher access)
func GetRoleHierarchyLevel(role string) int {
	switch role {
	case RoleAdmin:
		return 1
	case RoleOfficeManager:
		return 2
	case RoleLawyer, RolePsychologist:
		return 3
	case RoleReceptionist:
		return 4
	case RoleEventCoordinator:
		return 5
	default:
		return 999 // Unknown role
	}
}

// HasHigherOrEqualAccess checks if role1 has higher or equal access than role2
func HasHigherOrEqualAccess(role1, role2 string) bool {
	return GetRoleHierarchyLevel(role1) <= GetRoleHierarchyLevel(role2)
}

// Role validation middleware helper
func ValidateRoleMiddleware(role string) (bool, string) {
	if !IsValidRole(role) {
		return false, fmt.Sprintf("Invalid role '%s'. Valid roles: %s", role, strings.Join(VALID_ROLES, ", "))
	}
	return true, ""
}
