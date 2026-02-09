// api/models/office.go (New File)
package models

import (
	"time"

	"gorm.io/gorm"
)

// Office represents a physical CAF location.
type Office struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	Name      string         `gorm:"size:255;not null;unique" json:"name"`
	Address   string         `gorm:"type:text" json:"address"`
	Latitude  *float64       `gorm:"type:decimal(10,8)" json:"latitude,omitempty"`
	Longitude *float64       `gorm:"type:decimal(11,8)" json:"longitude,omitempty"`
	CreatedAt time.Time      `json:"createdAt" gorm:"type:timestamp"`
	UpdatedAt time.Time      `json:"updatedAt" gorm:"type:timestamp"`
	DeletedAt gorm.DeletedAt `gorm:"index;type:timestamp" json:"-"`
	Code      string         `gorm:"size:50;index" json:"code"`
}
