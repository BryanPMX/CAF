package models

import (
	"time"
	
	"gorm.io/gorm"
)

// Notification represents a user notification in the system
// Notifications are used to inform users about important events and updates
type Notification struct {
	ID         uint      `json:"id" gorm:"primaryKey"`
	UserID     uint      `json:"userId" gorm:"not null;index:idx_notifications_user_id"`
	Message    string    `json:"message" gorm:"not null;type:text"`
	IsRead     bool      `json:"isRead" gorm:"default:false;index:idx_notifications_is_read"`
	Link       *string   `json:"link,omitempty" gorm:"type:varchar(500)"`
	Type       string    `json:"type" gorm:"type:varchar(50);default:'info'"`
	EntityType string    `json:"entityType,omitempty" gorm:"type:varchar(50)"` // case, appointment, contact_interest, etc.
	EntityID   *uint     `json:"entityId,omitempty" gorm:"type:bigint"`
	DedupKey   string    `json:"-" gorm:"type:varchar(255);index:idx_notifications_dedup_key"` // For avoiding duplicate notifications (race-safe)
	CreatedAt  time.Time `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt  time.Time `json:"updatedAt" gorm:"autoUpdateTime"`
	DeletedAt  *time.Time `json:"deletedAt,omitempty" gorm:"index"`

	// Relationships
	User User `json:"user,omitempty" gorm:"foreignKey:UserID"`
}

// TableName specifies the table name for the Notification model
func (Notification) TableName() string {
	return "notifications"
}

// BeforeCreate is a GORM hook that runs before creating a notification
func (n *Notification) BeforeCreate() error {
	// Ensure message is not empty
	if n.Message == "" {
		return gorm.ErrInvalidData
	}
	return nil
}

// MarkAsRead marks the notification as read
func (n *Notification) MarkAsRead() {
	n.IsRead = true
}

// IsUnread returns true if the notification is unread
func (n *Notification) IsUnread() bool {
	return !n.IsRead
}

// NotificationResponse represents the API response for notifications
type NotificationResponse struct {
	ID         uint      `json:"id"`
	Message    string    `json:"message"`
	IsRead     bool      `json:"isRead"`
	Link       *string   `json:"link,omitempty"`
	Type       string    `json:"type"`
	EntityType string    `json:"entityType,omitempty"`
	EntityID   *uint     `json:"entityId,omitempty"`
	CreatedAt  time.Time `json:"createdAt"`
}

// MarkNotificationsRequest represents the request to mark notifications as read
type MarkNotificationsRequest struct {
	NotificationIDs []uint `json:"notificationIds" binding:"required,min=1"`
}

// CreateNotificationRequest represents the request to create a new notification
type CreateNotificationRequest struct {
	UserID  uint    `json:"userId" binding:"required"`
	Message string  `json:"message" binding:"required"`
	Link    *string `json:"link,omitempty"`
	Type    string  `json:"type,omitempty"`
}
