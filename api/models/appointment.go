// api/models/appointment.go (Updated)
package models

import (
	"time"

	"github.com/BryanPMX/CAF/api/config"
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

	// Office where the appointment takes place
	OfficeID uint    `gorm:"not null" json:"officeId"`
	Office   *Office `gorm:"foreignKey:OfficeID" json:"office"`

	Title     string                   `gorm:"size:255;not null;index" json:"title"`
	StartTime time.Time                `gorm:"not null;index" json:"startTime"`
	EndTime   time.Time                `gorm:"not null" json:"endTime"`
	Status    config.AppointmentStatus `gorm:"size:50;default:'pending';index" json:"status"` // Uses centralized status definitions

	// NEW: Appointment category for department-based filtering
	Category string `gorm:"size:100;default:'General';index" json:"category"` // e.g., "Legal Consultation", "Therapy Session", "Administrative"

	// NEW: Department for access control
	Department string `gorm:"size:100;default:'General';index" json:"department"` // e.g., "Legal", "Psychology", "Administration"

	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index;type:timestamp" json:"-"`
}
