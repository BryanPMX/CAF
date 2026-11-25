package models

import (
	"gorm.io/gorm"
	"time"
)

// Property is an office-scoped archival record, independent of legal cases.
// Company identity and development name are deliberately separate.
type Property struct {
	ID              uint                    `gorm:"primaryKey" json:"id"`
	OfficeID        uint                    `gorm:"not null;index" json:"officeId"`
	Office          *Office                 `json:"office,omitempty"`
	OrganizationID  *uint                   `gorm:"index" json:"organizationId"`
	Organization    *Organization           `json:"organization,omitempty"`
	ParentID        *uint                   `gorm:"index" json:"parentId"`
	Name            string                  `gorm:"size:255;not null" json:"name"`
	Kind            string                  `gorm:"size:20;not null" json:"kind"`
	DevelopmentName string                  `gorm:"size:255" json:"developmentName"`
	Address         string                  `gorm:"size:1000" json:"address"`
	State           string                  `gorm:"size:100" json:"state"`
	Municipality    string                  `gorm:"size:100" json:"municipality"`
	District        string                  `gorm:"size:100" json:"district"`
	Block           string                  `gorm:"size:100" json:"block"`
	Lot             string                  `gorm:"size:100" json:"lot"`
	CadastralKey    string                  `gorm:"size:100;index" json:"cadastralKey"`
	AreaM2          *float64                `gorm:"type:numeric(18,4)" json:"areaM2"`
	Notes           string                  `gorm:"type:text" json:"notes"`
	CreatedBy       uint                    `gorm:"not null" json:"createdBy"`
	UpdatedBy       uint                    `gorm:"not null" json:"updatedBy"`
	CreatedAt       time.Time               `json:"createdAt"`
	UpdatedAt       time.Time               `json:"updatedAt"`
	DeletedAt       gorm.DeletedAt          `gorm:"index" json:"-"`
	Owners          []PropertyOwner         `json:"owners"`
	Documents       []PropertyDocument      `json:"documents"`
	RegistryEntries []PropertyRegistryEntry `json:"registryEntries"`
}

// An ownership statement has a source and an explicit verification status.
// Historical evidence is never automatically treated as current ownership.
type PropertyOwner struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	PropertyID   uint      `gorm:"not null;index" json:"propertyId"`
	ClientID     uint      `gorm:"not null;index" json:"clientId"`
	Client       *User     `json:"client,omitempty"`
	SharePercent *float64  `gorm:"type:numeric(7,4)" json:"sharePercent"`
	Status       string    `gorm:"size:20;not null" json:"status"`
	StartDate    *Date     `gorm:"type:date" json:"startDate"`
	EndDate      *Date     `gorm:"type:date" json:"endDate"`
	Source       string    `gorm:"size:2000" json:"source"`
	CreatedBy    uint      `gorm:"not null" json:"createdBy"`
	UpdatedBy    uint      `gorm:"not null" json:"updatedBy"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

type PropertyRegistryEntry struct {
	ID               uint      `gorm:"primaryKey" json:"id"`
	PropertyID       uint      `gorm:"not null;index" json:"propertyId"`
	RealFolio        string    `gorm:"size:100;index" json:"realFolio"`
	Inscription      string    `gorm:"size:100" json:"inscription"`
	Folio            string    `gorm:"size:100" json:"folio"`
	Book             string    `gorm:"size:100" json:"book"`
	Section          string    `gorm:"size:100" json:"section"`
	ActType          string    `gorm:"size:255" json:"actType"`
	InstrumentNumber string    `gorm:"size:100" json:"instrumentNumber"`
	InstrumentDate   *Date     `gorm:"type:date" json:"instrumentDate"`
	RegistrationDate *Date     `gorm:"type:date" json:"registrationDate"`
	Notary           string    `gorm:"size:255" json:"notary"`
	Source           string    `gorm:"size:2000" json:"source"`
	CreatedBy        uint      `gorm:"not null" json:"createdBy"`
	UpdatedBy        uint      `gorm:"not null" json:"updatedBy"`
	CreatedAt        time.Time `json:"createdAt"`
	UpdatedAt        time.Time `json:"updatedAt"`
}

// Storage URLs never leave the authenticated document endpoint.
type PropertyDocument struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	PropertyID uint      `gorm:"not null;index" json:"propertyId"`
	FileName   string    `gorm:"size:255;not null" json:"fileName"`
	FileURL    string    `gorm:"size:1000;not null" json:"-"`
	FileType   string    `gorm:"size:100;not null" json:"fileType"`
	CreatedBy  uint      `gorm:"not null" json:"createdBy"`
	CreatedAt  time.Time `json:"createdAt"`
}
