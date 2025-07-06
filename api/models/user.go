// This file defines the GORM model for a User.
package models

import (
	"time"

	"gorm.io/gorm"
)

// User represents a user in the system (client, staff, admin).
type User struct {
	ID        uint   `gorm:"primaryKey"`
	FirstName string `gorm:"size:255;not null"`
	LastName  string `gorm:"size:255;not null"`
	Email     string `gorm:"size:255;not null;unique"`
	Password  string `gorm:"size:255;not null"` // Will be a bcrypt hash
	Role      string `gorm:"size:50;default:'client'"`
	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt gorm.DeletedAt `gorm:"index"`
}
