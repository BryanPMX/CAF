// api/config/stages.go
package config

// CaseStages defines the ordered, canonical list of stages in a case's lifecycle.
// This is the default set for non-legal cases.
var CaseStages = []string{
	"intake",               // Initial data entry
	"initial_consultation", // First meeting with staff
	"document_review",      // Staff is reviewing submitted documents
	"action_plan",          // Staff is actively working on the case
	"resolution",           // A resolution has been reached
	"closed",               // The case is complete
}

// LegalCaseStages defines the specific stages for legal cases (Familiar, Civil)
var LegalCaseStages = []string{
	"etapa_inicial",        // Etapa inicial
	"notificacion",         // Notificación
	"audiencia_preliminar", // Audiencia Preliminar
	"audiencia_juicio",     // Audiencia de Juicio
	"sentencia",            // Sentencia
}

// CaseStageLabels provides Spanish (Mexico) localization for case stages
var CaseStageLabels = map[string]string{
	// Default stages
	"intake":               "Recepción",
	"initial_consultation": "Consulta Inicial",
	"document_review":      "Revisión de Documentos",
	"action_plan":          "Plan de Acción",
	"resolution":           "Resolución",
	"closed":               "Cerrado",
	
	// Legal case stages
	"etapa_inicial":        "Etapa Inicial",
	"notificacion":         "Notificación",
	"audiencia_preliminar": "Audiencia Preliminar",
	"audiencia_juicio":     "Audiencia de Juicio",
	"sentencia":            "Sentencia",
}

// CaseStatusLabels provides Spanish (Mexico) localization for case statuses
var CaseStatusLabels = map[string]string{
	"open":     "Abierto",
	"active":   "Activo",
	"resolved": "Resuelto",
	"closed":   "Cerrado",
	"pending":  "Pendiente",
	"cancelled": "Cancelado",
}

// AppointmentStatusLabels provides Spanish (Mexico) localization for appointment statuses
var AppointmentStatusLabels = map[string]string{
	"confirmed": "Confirmada",
	"pending":   "Pendiente",
	"completed": "Completada",
	"cancelled": "Cancelada",
	"no-show":   "No Presentó",
	"rescheduled": "Reprogramada",
}

// UserRoleLabels provides Spanish (Mexico) localization for user roles
var UserRoleLabels = map[string]string{
	"admin":    "Administrador",
	"staff":    "Personal",
	"client":   "Cliente",
	"receptionist": "Recepcionista",
	"lawyer":   "Abogado",
	"psychologist": "Psicólogo",
	"social_worker": "Trabajador Social",
}

// DepartmentLabels provides Spanish (Mexico) localization for departments
var DepartmentLabels = map[string]string{
	"legal":        "Legal",
	"psychology":   "Psicología",
	"social":       "Asistencia Social",
	"administration": "Administración",
	"general":      "General",
}

// TaskStatusLabels provides Spanish (Mexico) localization for task statuses
var TaskStatusLabels = map[string]string{
	"pending":   "Pendiente",
	"in_progress": "En Progreso",
	"completed": "Completada",
	"cancelled": "Cancelada",
	"overdue":   "Vencida",
}

// PriorityLabels provides Spanish (Mexico) localization for priority levels
var PriorityLabels = map[string]string{
	"low":      "Baja",
	"medium":   "Media",
	"high":     "Alta",
	"urgent":   "Urgente",
	"critical": "Crítica",
}

// GetCaseStages returns the appropriate stage set based on case category
func GetCaseStages(category string) []string {
	switch category {
	case "Familiar", "Civil":
		return LegalCaseStages
	default:
		return CaseStages
	}
}

// IsValidStage checks if a given stage is valid for a specific case category
func IsValidStage(stage string, category string) bool {
	stages := GetCaseStages(category)
	for _, s := range stages {
		if s == stage {
			return true
		}
	}
	return false
}

// IsValidStageLegacy is a helper function to check if a given stage is valid (backward compatibility)
func IsValidStageLegacy(stage string) bool {
	// Check both default and legal stages for backward compatibility
	for _, s := range CaseStages {
		if s == stage {
			return true
		}
	}
	for _, s := range LegalCaseStages {
		if s == stage {
			return true
		}
	}
	return false
}

// GetStageLabel returns the Spanish label for a given stage, or the stage itself if no label exists
func GetStageLabel(stage string) string {
	if label, exists := CaseStageLabels[stage]; exists {
		return label
	}
	return stage
}

// GetStatusLabel returns the Spanish label for a given status, or the status itself if no label exists
func GetStatusLabel(status string) string {
	if label, exists := CaseStatusLabels[status]; exists {
		return label
	}
	return status
}

// GetAppointmentStatusLabel returns the Spanish label for a given appointment status
func GetAppointmentStatusLabel(status string) string {
	if label, exists := AppointmentStatusLabels[status]; exists {
		return label
	}
	return status
}

// GetUserRoleLabel returns the Spanish label for a given user role
func GetUserRoleLabel(role string) string {
	if label, exists := UserRoleLabels[role]; exists {
		return label
	}
	return role
}

// GetDepartmentLabel returns the Spanish label for a given department
func GetDepartmentLabel(department string) string {
	if label, exists := DepartmentLabels[department]; exists {
		return label
	}
	return department
}

// GetTaskStatusLabel returns the Spanish label for a given task status
func GetTaskStatusLabel(status string) string {
	if label, exists := TaskStatusLabels[status]; exists {
		return label
	}
	return status
}

// GetPriorityLabel returns the Spanish label for a given priority level
func GetPriorityLabel(priority string) string {
	if label, exists := PriorityLabels[priority]; exists {
		return label
	}
	return priority
}
