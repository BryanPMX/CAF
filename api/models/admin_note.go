package models

import (
	"time"

	"gorm.io/gorm"
)

// AdminNote are short-form org notes created by admins (broadcast)
type AdminNote struct {
	ID       uint       `json:"id" gorm:"primaryKey"`
	BodyText string     `json:"bodyText" gorm:"type:text;not null"`
	ImageURL *string    `json:"imageUrl"`
	Pinned   bool       `json:"pinned" gorm:"default:false"`
	StartAt  *time.Time `json:"startAt" gorm:"type:timestamp"`
	EndAt    *time.Time `json:"endAt" gorm:"type:timestamp"`

	// Visibility scoping
	VisibleRoles       []string `json:"visibleRoles" gorm:"type:text[]"`
	VisibleDepartments []string `json:"visibleDepartments" gorm:"type:text[]"`

	CreatedBy uint           `json:"createdBy"`
	UpdatedBy *uint          `json:"updatedBy"`
	CreatedAt time.Time      `json:"createdAt" gorm:"type:timestamp"`
	UpdatedAt time.Time      `json:"updatedAt" gorm:"type:timestamp"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index;type:timestamp"`
}

func (AdminNote) TableName() string {
	return "admin_notes"
}
