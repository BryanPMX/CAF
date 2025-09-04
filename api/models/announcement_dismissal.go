package models

import (
	"time"
)

// AnnouncementDismissal tracks when a user dismisses an announcement
type AnnouncementDismissal struct {
	ID             uint      `json:"id" gorm:"primaryKey"`
	UserID         uint      `json:"userId" gorm:"index;not null"`
	AnnouncementID uint      `json:"announcementId" gorm:"index;not null"`
	DismissedAt    time.Time `json:"dismissedAt" gorm:"type:timestamp"`
}

func (AnnouncementDismissal) TableName() string {
	return "announcement_dismissals"
}
