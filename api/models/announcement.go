package models

import (
	"time"

	"gorm.io/gorm"
)

// Announcement represents organization-wide news/posts with optional images
type Announcement struct {
	ID       uint       `json:"id" gorm:"primaryKey"`
	Title    string     `json:"title" gorm:"not null"`
	BodyHTML string     `json:"bodyHtml" gorm:"type:text"`
	Images   []string   `json:"images" gorm:"type:text[]"`
	Tags     []string   `json:"tags" gorm:"type:text[]"`
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

func (Announcement) TableName() string {
	return "announcements"
}
