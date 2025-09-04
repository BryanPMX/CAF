package models

import (
	"time"

	"gorm.io/gorm"
)

// User represents a user in the system (client, staff, admin).
type User struct {
	ID        uint   `gorm:"primaryKey" json:"id"`
	FirstName string `gorm:"size:255;not null" json:"firstName"`
	LastName  string `gorm:"size:255;not null" json:"lastName"`
	Email     string `gorm:"size:255;not null;unique" json:"email"`
	Password  string `gorm:"size:255;not null" json:"-"`
	Role      string `gorm:"size:50;not null" json:"role"`

	OfficeID *uint   `json:"officeId,omitempty"`
	Office   *Office `gorm:"foreignKey:OfficeID" json:"office,omitempty"`

	// NEW: Department/Specialty for staff members
	Department *string `gorm:"size:100" json:"department,omitempty"` // e.g., "Legal", "Psychology", "Administration"
	Specialty  *string `gorm:"size:100" json:"specialty,omitempty"`  // e.g., "Criminal Law", "Family Therapy", "HR"

	// NEW: Case assignments for staff members
	AssignedCases []Case `gorm:"many2many:user_case_assignments;" json:"assignedCases,omitempty"`

	// Account status
	IsActive  bool       `gorm:"default:true" json:"isActive"` // Whether the user account is active
	LastLogin *time.Time `json:"lastLogin" gorm:"index;type:timestamp"`
	CreatedAt time.Time  `json:"createdAt"`
	UpdatedAt time.Time  `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index;type:timestamp" json:"-"`
}

// UserCaseAssignment represents the many-to-many relationship between users and cases
type UserCaseAssignment struct {
	ID         uint           `gorm:"primaryKey" json:"id"`
	UserID     uint           `gorm:"not null;index" json:"userId"`
	CaseID     uint           `gorm:"not null;index" json:"caseId"`
	Role       string         `gorm:"size:50;not null" json:"role"` // "primary", "secondary", "consultant"
	AssignedAt time.Time      `gorm:"not null;default:now();type:timestamp" json:"assignedAt"`
	CreatedAt  time.Time      `json:"createdAt"`
	UpdatedAt  time.Time      `json:"updatedAt"`
	DeletedAt  gorm.DeletedAt `gorm:"index;type:timestamp" json:"-"`
}
