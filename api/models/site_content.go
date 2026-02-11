// api/models/site_content.go
// CMS models for the marketing website. Managed via the admin portal.
//
// Design: Each model represents a distinct content type (SRP).
// The admin portal provides CRUD operations; the marketing site
// fetches content via public (unauthenticated) API endpoints.
package models

import (
	"time"

	"gorm.io/gorm"
)

// SiteContent stores editable key-value text for marketing website sections.
// Examples: hero title, about description, footer text.
type SiteContent struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	Section      string         `gorm:"size:100;not null;index" json:"section"`      // hero, about, footer, contact
	ContentKey   string         `gorm:"size:100;not null" json:"contentKey"`          // title, subtitle, description
	ContentValue string         `gorm:"type:text;not null" json:"contentValue"`       // actual text/html
	ContentType  string         `gorm:"size:50;default:'text'" json:"contentType"`    // text, html, image_url
	SortOrder    int            `gorm:"default:0" json:"sortOrder"`
	IsActive     bool           `gorm:"default:true" json:"isActive"`
	UpdatedBy    *uint          `json:"updatedBy,omitempty"`
	CreatedAt    time.Time      `json:"createdAt" gorm:"type:timestamp"`
	UpdatedAt    time.Time      `json:"updatedAt" gorm:"type:timestamp"`
	DeletedAt    gorm.DeletedAt `json:"-" gorm:"index;type:timestamp"`
}

func (SiteContent) TableName() string { return "site_content" }

// SiteService represents a service offered by the organization.
type SiteService struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	Title       string         `gorm:"size:255;not null" json:"title"`
	Description string         `gorm:"type:text" json:"description"`
	Details     []string       `gorm:"type:text[]" json:"details"`  // bullet-point list
	Icon        string         `gorm:"size:100" json:"icon"`        // icon identifier
	ImageURL    string         `gorm:"size:512" json:"imageUrl"`
	SortOrder   int            `gorm:"default:0" json:"sortOrder"`
	IsActive    bool           `gorm:"default:true" json:"isActive"`
	CreatedBy   uint           `json:"createdBy"`
	UpdatedBy   *uint          `json:"updatedBy,omitempty"`
	CreatedAt   time.Time      `json:"createdAt" gorm:"type:timestamp"`
	UpdatedAt   time.Time      `json:"updatedAt" gorm:"type:timestamp"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index;type:timestamp"`
}

func (SiteService) TableName() string { return "site_services" }

// SiteEvent represents a public event shown on the marketing website.
type SiteEvent struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	Title       string         `gorm:"size:255;not null" json:"title"`
	Description string         `gorm:"type:text" json:"description"`
	EventDate   time.Time      `gorm:"type:timestamp;not null" json:"eventDate"`
	EndDate     *time.Time     `gorm:"type:timestamp" json:"endDate,omitempty"`
	Location    string         `gorm:"size:255" json:"location"`
	ImageURL    string         `gorm:"size:512" json:"imageUrl"`
	IsActive    bool           `gorm:"default:true" json:"isActive"`
	CreatedBy   uint           `json:"createdBy"`
	UpdatedBy   *uint          `json:"updatedBy,omitempty"`
	CreatedAt   time.Time      `json:"createdAt" gorm:"type:timestamp"`
	UpdatedAt   time.Time      `json:"updatedAt" gorm:"type:timestamp"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index;type:timestamp"`
}

func (SiteEvent) TableName() string { return "site_events" }

// SiteImage stores gallery/carousel images for the marketing website.
type SiteImage struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	Title     string         `gorm:"size:255" json:"title"`
	AltText   string         `gorm:"size:255" json:"altText"`
	ImageURL  string         `gorm:"size:512;not null" json:"imageUrl"`
	Section   string         `gorm:"size:100;default:'gallery';index" json:"section"` // hero, gallery, about
	SortOrder int            `gorm:"default:0" json:"sortOrder"`
	IsActive  bool           `gorm:"default:true" json:"isActive"`
	CreatedBy uint           `json:"createdBy"`
	UpdatedBy *uint          `json:"updatedBy,omitempty"`
	CreatedAt time.Time      `json:"createdAt" gorm:"type:timestamp"`
	UpdatedAt time.Time      `json:"updatedAt" gorm:"type:timestamp"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index;type:timestamp"`
}

func (SiteImage) TableName() string { return "site_images" }
