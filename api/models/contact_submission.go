package models

import "time"

// ContactSubmission represents a contact/interest form submission from the marketing site.
// When present, UserID links to the client user (created or matched by email) for the contact form.
type ContactSubmission struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Name      string    `json:"name" gorm:"size:255;not null"`
	Email     string    `json:"email" gorm:"size:255;not null"`
	Phone     string    `json:"phone,omitempty" gorm:"size:50"`
	Message   string    `json:"message" gorm:"type:text;not null"`
	Source    string    `json:"source" gorm:"size:50;default:contacto"`
	OfficeID  *uint     `json:"officeId,omitempty" gorm:"column:office_id"`
	UserID    *uint     `json:"userId,omitempty" gorm:"column:user_id"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`
}

// TableName specifies the table name for ContactSubmission.
func (ContactSubmission) TableName() string {
	return "contact_submissions"
}
