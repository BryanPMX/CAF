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
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}
