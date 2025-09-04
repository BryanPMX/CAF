package models

import (
	"time"
	
	"gorm.io/gorm"
)

// Notification represents a user notification in the system
// Notifications are used to inform users about important events and updates
type Notification struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	UserID    uint      `json:"user_id" gorm:"not null;index:idx_notifications_user_id"` // Indexed for efficient queries
	Message   string    `json:"message" gorm:"not null;type:text"`                        // The notification message in Spanish
	IsRead    bool      `json:"is_read" gorm:"default:false;index:idx_notifications_is_read"` // Indexed for unread count queries
	Link      *string   `json:"link,omitempty" gorm:"type:varchar(500)"`                 // Optional URL for navigation
	Type      string    `json:"type" gorm:"type:varchar(50);default:'info'"`             // Type: info, warning, error, success
	CreatedAt time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt time.Time `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt *time.Time `json:"deleted_at,omitempty" gorm:"index"`

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
	ID        uint      `json:"id"`
	Message   string    `json:"message"`
	IsRead    bool      `json:"is_read"`
	Link      *string   `json:"link,omitempty"`
	Type      string    `json:"type"`
	CreatedAt time.Time `json:"created_at"`
}

// MarkNotificationsRequest represents the request to mark notifications as read
type MarkNotificationsRequest struct {
	NotificationIDs []uint `json:"notification_ids" binding:"required,min=1"`
}

// CreateNotificationRequest represents the request to create a new notification
type CreateNotificationRequest struct {
	UserID  uint    `json:"user_id" binding:"required"`
	Message string  `json:"message" binding:"required"`
	Link    *string `json:"link,omitempty"`
	Type    string  `json:"type,omitempty"`
}
