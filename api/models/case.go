// api/models/case.go
package models

import (
	"time"

	"gorm.io/gorm"
)

// Case represents a digital folder for a client's specific issue.
type Case struct {
	ID          uint   `gorm:"primaryKey" json:"id"`
	ClientID    uint   `gorm:"not null" json:"clientId"`
	Client      User   `gorm:"foreignKey:ClientID" json:"client"`
	OfficeID    uint   `gorm:"not null" json:"officeId"`
	Office      Office `gorm:"foreignKey:OfficeID" json:"office"`
	Title       string `gorm:"size:255;not null" json:"title"`
	Description string `gorm:"type:text" json:"description"`
	Status      string `gorm:"size:50;default:'open'" json:"status"`

	// ADDED: This field tracks the case's progress through the workflow.
	CurrentStage string `gorm:"size:50;default:'intake'" json:"currentStage"`

	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Appointments []Appointment `json:"appointments,omitempty"`
	Tasks        []Task        `json:"tasks,omitempty"`
	CaseEvents   []CaseEvent   `json:"caseEvents,omitempty"`
}
