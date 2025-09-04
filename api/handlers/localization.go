// api/handlers/localization.go
package handlers

import (
	"github.com/BryanPMX/CAF/api/config"
)

// LocalizationHelper provides centralized Spanish (Mexico) localization functions
type LocalizationHelper struct{}

// NewLocalizationHelper creates a new localization helper instance
func NewLocalizationHelper() *LocalizationHelper {
	return &LocalizationHelper{}
}

// GetLocalizedResponse returns a localized response structure
func (lh *LocalizationHelper) GetLocalizedResponse() map[string]interface{} {
	return map[string]interface{}{
		"messages": map[string]interface{}{
			"success": map[string]string{
				"case_created":          "Caso creado exitosamente",
				"case_updated":          "Caso actualizado exitosamente",
				"case_deleted":          "Caso eliminado exitosamente",
				"appointment_created":   "Cita creada exitosamente",
				"appointment_updated":   "Cita actualizada exitosamente",
				"appointment_cancelled": "Cita cancelada exitosamente",
				"task_created":          "Tarea creada exitosamente",
				"task_updated":          "Tarea actualizada exitosamente",
				"task_deleted":          "Tarea eliminada exitosamente",
				"user_created":          "Usuario creado exitosamente",
				"user_updated":          "Usuario actualizado exitosamente",
				"user_deleted":          "Usuario eliminado exitosamente",
			},
			"errors": map[string]string{
				"not_found":         "Registro no encontrado",
				"access_denied":     "Acceso denegado",
				"validation_failed": "Error de validación",
				"internal_error":    "Error interno del servidor",
				"database_error":    "Error de base de datos",
				"unauthorized":      "No autorizado",
				"forbidden":         "Prohibido",
				"bad_request":       "Solicitud incorrecta",
			},
			"confirmations": map[string]string{
				"delete_case":        "¿Está seguro de que desea eliminar este caso?",
				"delete_appointment": "¿Está seguro de que desea cancelar esta cita?",
				"delete_task":        "¿Está seguro de que desea eliminar esta tarea?",
				"delete_user":        "¿Está seguro de que desea eliminar este usuario?",
				"force_delete":       "¿Está seguro de que desea forzar la eliminación?",
			},
		},
		"labels": map[string]interface{}{
			"statuses": map[string]string{
				"open":      "Abierto",
				"active":    "Activo",
				"resolved":  "Resuelto",
				"closed":    "Cerrado",
				"pending":   "Pendiente",
				"cancelled": "Cancelado",
				"completed": "Completado",
				"confirmed": "Confirmado",
			},
			"stages": map[string]string{
				"intake":               "Recepción",
				"initial_consultation": "Consulta Inicial",
				"document_review":      "Revisión de Documentos",
				"action_plan":          "Plan de Acción",
				"resolution":           "Resolución",
				"closed":               "Cerrado",
			},
			"roles": map[string]string{
				"admin":         "Administrador",
				"staff":         "Personal",
				"client":        "Cliente",
				"receptionist":  "Recepcionista",
				"lawyer":        "Abogado",
				"psychologist":  "Psicólogo",
				"social_worker": "Trabajador Social",
			},
			"departments": map[string]string{
				"legal":          "Legal",
				"psychology":     "Psicología",
				"social":         "Asistencia Social",
				"administration": "Administración",
				"general":        "General",
			},
			"priorities": map[string]string{
				"low":      "Baja",
				"medium":   "Media",
				"high":     "Alta",
				"urgent":   "Urgente",
				"critical": "Crítica",
			},
		},
		"placeholders": map[string]string{
			"search":           "Buscar...",
			"select_option":    "Seleccione una opción",
			"enter_text":       "Ingrese texto...",
			"select_date":      "Seleccione fecha",
			"select_time":      "Seleccione hora",
			"enter_email":      "Ingrese correo electrónico",
			"enter_password":   "Ingrese contraseña",
			"confirm_password": "Confirme contraseña",
		},
		"validation": map[string]string{
			"required":        "Este campo es obligatorio",
			"invalid_email":   "Correo electrónico inválido",
			"password_length": "La contraseña debe tener al menos 6 caracteres",
			"password_match":  "Las contraseñas no coinciden",
			"invalid_date":    "Fecha inválida",
			"invalid_time":    "Hora inválida",
			"future_date":     "La fecha debe ser futura",
			"past_date":       "La fecha no puede ser pasada",
		},
	}
}

// GetLocalizedMessage returns a localized message by key
func (lh *LocalizationHelper) GetLocalizedMessage(messageType, key string) string {
	response := lh.GetLocalizedResponse()

	if messages, exists := response["messages"].(map[string]interface{}); exists {
		if typeMessages, exists := messages[messageType].(map[string]string); exists {
			if message, exists := typeMessages[key]; exists {
				return message
			}
		}
	}

	// Return fallback message
	return key
}

// GetLocalizedLabel returns a localized label by category and key
func (lh *LocalizationHelper) GetLocalizedLabel(category, key string) string {
	response := lh.GetLocalizedResponse()

	if labels, exists := response["labels"].(map[string]interface{}); exists {
		if categoryLabels, exists := labels[category].(map[string]string); exists {
			if label, exists := categoryLabels[key]; exists {
				return label
			}
		}
	}

	// Return fallback label
	return key
}

// GetLocalizedPlaceholder returns a localized placeholder by key
func (lh *LocalizationHelper) GetLocalizedPlaceholder(key string) string {
	response := lh.GetLocalizedResponse()

	if placeholders, exists := response["placeholders"].(map[string]string); exists {
		if placeholder, exists := placeholders[key]; exists {
			return placeholder
		}
	}

	// Return fallback placeholder
	return key
}

// GetLocalizedValidation returns a localized validation message by key
func (lh *LocalizationHelper) GetLocalizedValidation(key string) string {
	response := lh.GetLocalizedResponse()

	if validation, exists := response["validation"].(map[string]string); exists {
		if message, exists := validation[key]; exists {
			return message
		}
	}

	// Return fallback validation message
	return key
}

// GetLocalizedStatus returns a localized status label
func (lh *LocalizationHelper) GetLocalizedStatus(status string) string {
	return config.GetStatusLabel(status)
}

// GetLocalizedStage returns a localized stage label
func (lh *LocalizationHelper) GetLocalizedStage(stage string) string {
	return config.GetStageLabel(stage)
}

// GetLocalizedAppointmentStatus returns a localized appointment status label
func (lh *LocalizationHelper) GetLocalizedAppointmentStatus(status string) string {
	return config.GetAppointmentStatusLabel(status)
}

// GetLocalizedUserRole returns a localized user role label
func (lh *LocalizationHelper) GetLocalizedUserRole(role string) string {
	return config.GetUserRoleLabel(role)
}

// GetLocalizedDepartment returns a localized department label
func (lh *LocalizationHelper) GetLocalizedDepartment(department string) string {
	return config.GetDepartmentLabel(department)
}

// GetLocalizedTaskStatus returns a localized task status label
func (lh *LocalizationHelper) GetLocalizedTaskStatus(status string) string {
	return config.GetTaskStatusLabel(status)
}

// GetLocalizedPriority returns a localized priority label
func (lh *LocalizationHelper) GetLocalizedPriority(priority string) string {
	return config.GetPriorityLabel(priority)
}
