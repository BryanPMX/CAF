package models

import (
	"time"

	"gorm.io/gorm"
)

const (
	OrganizationMaquila    = "maquila"
	OrganizationContractor = "constructora"
	ClientPerson           = "person"
	ClientOrganization     = "organization"
)

// Organization is a shared factory or construction company.
// A constructor has a canonical client account; its contacts are regular clients.
type Organization struct {
	ID                  uint           `gorm:"primaryKey" json:"id"`
	Kind                string         `gorm:"size:20;not null;index" json:"kind"`
	OfficeID            *uint          `gorm:"index" json:"officeId"`
	Office              *Office        `gorm:"foreignKey:OfficeID" json:"office,omitempty"`
	LegalName           string         `gorm:"size:255" json:"legalName"`
	TradeName           string         `gorm:"size:255" json:"tradeName"`
	Name                string         `gorm:"size:255;not null" json:"name"`
	LegalRepresentative string         `gorm:"size:255" json:"legalRepresentative"`
	LegalAddress        string         `gorm:"size:1000" json:"legalAddress"`
	BoardPresident      string         `gorm:"size:255" json:"boardPresident"`
	Neighborhood        string         `gorm:"size:255" json:"neighborhood"`
	AccountClientID     *uint          `gorm:"uniqueIndex" json:"accountClientId"`
	CreatedAt           time.Time      `json:"createdAt"`
	UpdatedAt           time.Time      `json:"updatedAt"`
	DeletedAt           gorm.DeletedAt `gorm:"index" json:"-"`
}

// EmploymentDetails is used for the current client membership and case snapshots.
// Optional hours may cross midnight; they describe work shifts, not CAF availability.
type EmploymentDetails struct {
	EmployeeNumber string `gorm:"size:100" json:"employeeNumber"`
	ShiftName      string `gorm:"size:100" json:"shiftName"`
	ShiftStart     string `gorm:"size:5" json:"shiftStart"`
	ShiftEnd       string `gorm:"size:5" json:"shiftEnd"`
}

type OrganizationClient struct {
	ID                uint          `gorm:"primaryKey" json:"id"`
	OrganizationID    uint          `gorm:"not null;uniqueIndex:idx_organization_client;index" json:"organizationId"`
	Organization      *Organization `gorm:"foreignKey:OrganizationID" json:"organization,omitempty"`
	ClientID          uint          `gorm:"not null;uniqueIndex:idx_organization_client;index" json:"clientId"`
	EmploymentDetails `gorm:"embedded"`
	RelationshipRoles []string  `gorm:"serializer:json;type:text;not null;default:'[]'" json:"relationshipRoles"`
	RelationshipNotes string    `gorm:"size:2000" json:"relationshipNotes"`
	CreatedAt         time.Time `json:"createdAt"`
	UpdatedAt         time.Time `json:"updatedAt"`
}

type CalendarEventClient struct {
	ID       uint  `gorm:"primaryKey" json:"id"`
	EventID  uint  `gorm:"not null;uniqueIndex:idx_calendar_event_client" json:"eventId"`
	ClientID uint  `gorm:"not null;uniqueIndex:idx_calendar_event_client;index" json:"clientId"`
	Client   *User `gorm:"foreignKey:ClientID" json:"client,omitempty"`
}
