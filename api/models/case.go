// api/models/case.go
package models

import (
	"time"

	"gorm.io/gorm"
)

// Case represents a legal or assistance case
type Case struct {
	ID             uint    `json:"id" gorm:"primaryKey"`
	ClientID       *uint   `json:"clientId"`
	OfficeID       uint    `json:"officeId"`
	Court          string  `json:"court" gorm:"size:50;index"`
	DocketNumber   string  `json:"docketNumber" gorm:"size:100;index"`
	Fee            float64 `json:"fee" gorm:"type:numeric(10,2);default:0"`
	Title          string  `json:"title" gorm:"not null"`
	Description    string  `json:"description"`
	Status         string  `json:"status" gorm:"default:'open'"`
	CurrentStage   string  `json:"currentStage" gorm:"default:'intake'"`
	Category       string  `json:"category"`
	Priority       string  `json:"priority" gorm:"default:'medium'"`
	PrimaryStaffID *uint   `json:"primaryStaffId"`

	// Completion and Archiving Fields
	IsCompleted    bool       `json:"isCompleted" gorm:"default:false"`
	CompletedAt    *time.Time `json:"completedAt" gorm:"type:timestamp"`
	CompletedBy    *uint      `json:"completedBy"`
	CompletionNote string     `json:"completionNote"`

	// Soft Delete Fields
	DeletedAt      *time.Time `json:"deletedAt" gorm:"index;type:timestamp"`
	DeletedBy      *uint      `json:"deletedBy"`
	DeletionReason string     `json:"deletionReason"`
	IsArchived     bool       `json:"isArchived" gorm:"default:false"`
	ArchivedAt     *time.Time `json:"archivedAt" gorm:"type:timestamp"`
	ArchivedBy     *uint      `json:"archivedBy"`
	ArchiveReason  string     `json:"archiveReason"` // "completed" or "manual_deletion"

	// Audit Fields
	CreatedAt time.Time `json:"createdAt" gorm:"type:timestamp"`
	UpdatedAt time.Time `json:"updatedAt" gorm:"type:timestamp"`
	CreatedBy uint      `json:"createdBy"`
	UpdatedBy *uint     `json:"updatedBy"`

	// Relationships
	Client        *User         `json:"client" gorm:"foreignKey:ClientID"`
	Office        *Office       `json:"office" gorm:"foreignKey:OfficeID"`
	PrimaryStaff  *User         `json:"primaryStaff" gorm:"foreignKey:PrimaryStaffID"`
	Appointments  []Appointment `json:"appointments" gorm:"foreignKey:CaseID"`
	Tasks         []Task        `json:"tasks" gorm:"foreignKey:CaseID"`
	CaseEvents    []CaseEvent   `json:"caseEvents" gorm:"foreignKey:CaseID"`
	AssignedStaff []User        `json:"assignedStaff" gorm:"many2many:user_case_assignments;"`
}

// BeforeDelete hook for audit logging
func (c *Case) BeforeDelete(tx *gorm.DB) error {
	// This will be called for soft deletes
	return nil
}

// AfterDelete hook for audit logging
func (c *Case) AfterDelete(tx *gorm.DB) error {
	// This will be called after soft delete
	return nil
}

// Complete marks a case as completed and triggers auto-archiving
func (c *Case) Complete(userID uint, note string) {
	now := time.Now()
	c.IsCompleted = true
	c.CompletedAt = &now
	c.CompletedBy = &userID
	c.CompletionNote = note
	c.Status = "completed"
}

// Archive marks a case as archived with a reason
func (c *Case) Archive(userID uint, reason string) {
	now := time.Now()
	c.IsArchived = true
	c.ArchivedAt = &now
	c.ArchivedBy = &userID
	c.ArchiveReason = reason
}

// IsAutoArchivable checks if a case should be automatically archived
func (c *Case) IsAutoArchivable() bool {
	return c.IsCompleted && !c.IsArchived
}

// IsManuallyDeleted checks if a case was manually deleted (not auto-archived)
func (c *Case) IsManuallyDeleted() bool {
	return c.DeletedAt != nil && c.ArchiveReason == "manual_deletion"
}

// IsCompletedAndArchived checks if a case was completed and auto-archived
func (c *Case) IsCompletedAndArchived() bool {
	return c.IsCompleted && c.IsArchived && c.ArchiveReason == "completed"
}

// TableName specifies the table name
func (Case) TableName() string {
	return "cases"
}
