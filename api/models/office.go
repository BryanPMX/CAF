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
	CreatedAt time.Time      `json:"createdAt" gorm:"type:timestamp"`
	UpdatedAt time.Time      `json:"updatedAt" gorm:"type:timestamp"`
	DeletedAt gorm.DeletedAt `gorm:"index;type:timestamp" json:"-"`
	Code      string         `gorm:"size:50;index" json:"code"`
}
