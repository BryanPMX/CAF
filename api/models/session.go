package models

import (
	"time"

	"gorm.io/gorm"
)

// Session represents an active user session
type Session struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	UserID       uint           `gorm:"not null;index" json:"userId"`
	User         User           `gorm:"foreignKey:UserID" json:"user"`
	TokenHash    string         `gorm:"size:255;not null;unique" json:"-"` // Hash of the JWT token
	DeviceInfo   string         `gorm:"size:500" json:"deviceInfo"`             // Browser/device information
	IPAddress    string         `gorm:"size:45" json:"ipAddress"`               // IPv4 or IPv6 address
	UserAgent    string         `gorm:"size:500" json:"userAgent"`              // User agent string
	LastActivity time.Time      `gorm:"not null;type:timestamp" json:"lastActivity"`           // Last request timestamp
	ExpiresAt    time.Time      `gorm:"not null;index;type:timestamp" json:"expiresAt"`        // Session expiration
	IsActive     bool           `gorm:"default:true;index" json:"isActive"`     // Whether session is active
	CreatedAt   time.Time      `json:"createdAt" gorm:"type:timestamp"`
	UpdatedAt   time.Time      `json:"updatedAt" gorm:"type:timestamp"`
	DeletedAt   gorm.DeletedAt `gorm:"index;type:timestamp" json:"-"`
}

// SessionConfig holds configuration for session management
type SessionConfig struct {
	MaxConcurrentSessions int           `json:"maxConcurrentSessions"` // Maximum sessions per user
	SessionTimeout        time.Duration `json:"sessionTimeout"`        // How long sessions last
	InactivityTimeout    time.Duration `json:"inactivityTimeout"`     // How long before session expires due to inactivity
}

// Default session configuration
var DefaultSessionConfig = SessionConfig{
	MaxConcurrentSessions: 3,           // Allow 3 concurrent sessions
	SessionTimeout:        24 * time.Hour, // 24 hours total
	InactivityTimeout:     2 * time.Hour,  // 2 hours of inactivity
}
