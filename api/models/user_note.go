package models

import (
	"time"

	"gorm.io/gorm"
)

// UserNote is a personal note visible only to its owner
type UserNote struct {
	ID        uint           `json:"id" gorm:"primaryKey"`
	UserID    uint           `json:"userId" gorm:"index;not null"`
	BodyText  string         `json:"bodyText" gorm:"type:text;not null"`
	Pinned    bool           `json:"pinned" gorm:"default:false"`
	CreatedAt time.Time      `json:"createdAt" gorm:"type:timestamp"`
	UpdatedAt time.Time      `json:"updatedAt" gorm:"type:timestamp"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index;type:timestamp"`
}

func (UserNote) TableName() string {
	return "user_notes"
}
