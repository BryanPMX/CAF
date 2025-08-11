// api/models/task.go (New File)
package models

import (
	"time"

	"gorm.io/gorm"
)

// Task represents an internal, actionable item for a case.
type Task struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	CaseID       uint           `gorm:"not null" json:"caseId"`       // Belongs to a Case
	AssignedToID uint           `gorm:"not null" json:"assignedToId"` // Assigned to a specific staff member
	AssignedTo   User           `gorm:"foreignKey:AssignedToID" json:"assignedTo"`
	Title        string         `gorm:"size:255;not null" json:"title"`
	DueDate      *time.Time     `json:"dueDate"`                                 // Pointer to allow for null dates
	Status       string         `gorm:"size:50;default:'pending'" json:"status"` // "pending", "in_progress", "completed"
	CreatedAt    time.Time      `json:"createdAt"`
	UpdatedAt    time.Time      `json:"updatedAt"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`

	// A task can have many comments
	Comments []TaskComment `json:"comments,omitempty"`
}

// TaskComment represents a comment or update on a specific task.
type TaskComment struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	TaskID    uint           `gorm:"not null" json:"taskId"`
	UserID    uint           `gorm:"not null" json:"userId"` // Who made the comment
	User      User           `gorm:"foreignKey:UserID" json:"user"`
	Comment   string         `gorm:"type:text;not null" json:"comment"`
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}
