// api/models/appointment.go (Updated)
package models

import (
	"time"

	"gorm.io/gorm"
)

// Appointment represents a scheduled event for a specific case.
type Appointment struct {
	ID uint `gorm:"primaryKey" json:"id"`

	// UPDATED: An appointment now belongs to a Case, not directly to a User.
	CaseID uint `gorm:"not null;index" json:"caseId"`
	Case   Case `gorm:"foreignKey:CaseID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"case"`
	// Staff member assigned to the appointment (e.g., the lawyer or psychologist).
	StaffID uint `gorm:"not null;index" json:"staffId"`
	Staff   User `gorm:"foreignKey:StaffID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"staff"`

	Title     string         `gorm:"size:255;not null;index" json:"title"`
	StartTime time.Time      `gorm:"not null;index" json:"startTime"`
	EndTime   time.Time      `gorm:"not null" json:"endTime"`
	Status    string         `gorm:"size:50;default:'confirmed';index" json:"status"` // "confirmed", "completed", "cancelled"
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}
