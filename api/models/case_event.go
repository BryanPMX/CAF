// api/models/case_event.go
package models

import (
	"time"

	"gorm.io/gorm"
)

// CaseEvent represents a single event on a case's timeline, like a comment or a file upload.
type CaseEvent struct {
	ID     uint `gorm:"primaryKey" json:"id"`
	CaseID uint `gorm:"not null" json:"caseId"`
	Case   Case `gorm:"foreignKey:CaseID" json:"case"`
	UserID uint `gorm:"not null" json:"userId"` // User who created the event (staff or client)
	User   User `gorm:"foreignKey:UserID" json:"user"`

	EventType  string `gorm:"size:100;not null" json:"eventType"`            // "comment", "file_upload", "status_change"
	Visibility string `gorm:"size:50;default:'internal'" json:"visibility"` // "internal" or "client_visible"

	// For comments
	CommentText string `gorm:"type:text" json:"commentText,omitempty"`
	Description string `gorm:"type:text" json:"description,omitempty"` // General description of the event

	// For file uploads
	FileName string `gorm:"size:255" json:"fileName,omitempty"`
	FileUrl  string `gorm:"size:512" json:"fileUrl,omitempty"`
	FileType string `gorm:"size:100" json:"fileType,omitempty"`

	// Additional metadata in JSON format
	Metadata map[string]interface{} `gorm:"type:jsonb" json:"metadata,omitempty"`

	CreatedAt time.Time      `json:"createdAt" gorm:"type:timestamp"`
	UpdatedAt time.Time      `json:"updatedAt" gorm:"type:timestamp"`
	DeletedAt gorm.DeletedAt `gorm:"index;type:timestamp" json:"-"`
}
