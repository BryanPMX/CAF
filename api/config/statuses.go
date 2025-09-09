// api/config/statuses.go
// Centralized status definitions for the CAF system
// This file serves as the single source of truth for all status values

package config

// AppointmentStatus represents the valid states of an appointment
type AppointmentStatus string

// Appointment status constants - single source of truth
const (
	StatusPending   AppointmentStatus = "pending"
	StatusConfirmed AppointmentStatus = "confirmed"
	StatusCompleted AppointmentStatus = "completed"
	StatusCancelled AppointmentStatus = "cancelled"
	StatusNoShow    AppointmentStatus = "no_show"
)

// GetValidAppointmentStatuses returns all valid appointment statuses
func GetValidAppointmentStatuses() []AppointmentStatus {
	return []AppointmentStatus{
		StatusPending,
		StatusConfirmed,
		StatusCompleted,
		StatusCancelled,
		StatusNoShow,
	}
}

// IsValidAppointmentStatus checks if a status is valid
func IsValidAppointmentStatus(status string) bool {
	validStatuses := GetValidAppointmentStatuses()
	for _, validStatus := range validStatuses {
		if string(validStatus) == status {
			return true
		}
	}
	return false
}

// GetAppointmentStatusDisplayName returns the Spanish display name for a status
func GetAppointmentStatusDisplayName(status AppointmentStatus) string {
	switch status {
	case StatusPending:
		return "Pendiente"
	case StatusConfirmed:
		return "Confirmada"
	case StatusCompleted:
		return "Completada"
	case StatusCancelled:
		return "Cancelada"
	case StatusNoShow:
		return "No se presentó"
	default:
		return "Desconocido"
	}
}

// CaseStatus represents the valid states of a case
type CaseStatus string

// Case status constants
const (
	CaseStatusOpen       CaseStatus = "open"
	CaseStatusInProgress CaseStatus = "in_progress"
	CaseStatusClosed     CaseStatus = "closed"
	CaseStatusPending    CaseStatus = "pending"
	CaseStatusArchived   CaseStatus = "archived"
)

// GetValidCaseStatuses returns all valid case statuses
func GetValidCaseStatuses() []CaseStatus {
	return []CaseStatus{
		CaseStatusOpen,
		CaseStatusInProgress,
		CaseStatusClosed,
		CaseStatusPending,
		CaseStatusArchived,
	}
}

// IsValidCaseStatus checks if a case status is valid
func IsValidCaseStatus(status string) bool {
	validStatuses := GetValidCaseStatuses()
	for _, validStatus := range validStatuses {
		if string(validStatus) == status {
			return true
		}
	}
	return false
}

// TaskStatus represents the valid states of a task
type TaskStatus string

// Task status constants
const (
	TaskStatusPending    TaskStatus = "pending"
	TaskStatusInProgress TaskStatus = "in_progress"
	TaskStatusCompleted  TaskStatus = "completed"
	TaskStatusCancelled  TaskStatus = "cancelled"
)

// GetValidTaskStatuses returns all valid task statuses
func GetValidTaskStatuses() []TaskStatus {
	return []TaskStatus{
		TaskStatusPending,
		TaskStatusInProgress,
		TaskStatusCompleted,
		TaskStatusCancelled,
	}
}

// IsValidTaskStatus checks if a task status is valid
func IsValidTaskStatus(status string) bool {
	validStatuses := GetValidTaskStatuses()
	for _, validStatus := range validStatuses {
		if string(validStatus) == status {
			return true
		}
	}
	return false
}
