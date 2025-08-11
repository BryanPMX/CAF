package models

import (
	"time"

	"gorm.io/gorm"
)

// User represents a user in the system (client, staff, admin).
type User struct {
	ID        uint   `gorm:"primaryKey" json:"id"`
	FirstName string `gorm:"size:255;not null" json:"firstName"`
	LastName  string `gorm:"size:255;not null" json:"lastName"`
	Email     string `gorm:"size:255;not null" json:"email"`
	Password  string `gorm:"size:255;not null" json:"-"`
	Role      string `gorm:"size:50;not null" json:"role"`

	OfficeID *uint   `json:"officeId,omitempty"`
	Office   *Office `gorm:"foreignKey:OfficeID" json:"office,omitempty"`

	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}
