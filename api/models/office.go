// api/models/office.go
package models

import (
	"time"
)

// Office represents a physical CAF location.
// Offices use hard delete only (no soft delete).
type Office struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	Name       string    `gorm:"size:255;not null;unique" json:"name"`
	Address    string    `gorm:"type:text" json:"address"`
	PhoneOffice string   `gorm:"column:phone_office;size:50" json:"phoneOffice,omitempty"`
	PhoneCell   string   `gorm:"column:phone_cell;size:50" json:"phoneCell,omitempty"`
	Latitude   *float64  `gorm:"type:decimal(10,8)" json:"latitude,omitempty"`
	Longitude  *float64  `gorm:"type:decimal(11,8)" json:"longitude,omitempty"`
	CreatedAt  time.Time `json:"createdAt" gorm:"type:timestamp"`
	UpdatedAt  time.Time `json:"updatedAt" gorm:"type:timestamp"`
	Code       string    `gorm:"size:50;index" json:"code"`
}
