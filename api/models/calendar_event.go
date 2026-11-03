package models

import (
	"time"

	"gorm.io/gorm"
)

// CalendarEvent is an internal employee meeting. Client appointments remain in
// the appointments table because they have different authorization and case
// lifecycle rules.
type CalendarEvent struct {
	ID          uint   `gorm:"primaryKey" json:"id"`
	OrganizerID uint   `gorm:"not null;index" json:"organizerId"`
	Organizer   User   `gorm:"foreignKey:OrganizerID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"organizer"`
	Title       string `gorm:"size:200;not null" json:"title"`
	Description string `gorm:"type:text" json:"description"`
	Location    string `gorm:"size:255" json:"location"`

	StartTime time.Time `gorm:"not null;index" json:"startTime"`
	EndTime   time.Time `gorm:"not null;index" json:"endTime"`

	Attendees []CalendarEventAttendee `gorm:"foreignKey:EventID" json:"attendees"`
	CreatedAt time.Time               `json:"createdAt"`
	UpdatedAt time.Time               `json:"updatedAt"`
	DeletedAt gorm.DeletedAt          `gorm:"index" json:"-"`
}

// CalendarEventAttendee stores an employee invitation and their response.
type CalendarEventAttendee struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	EventID        uint      `gorm:"not null;uniqueIndex:idx_calendar_event_attendee" json:"eventId"`
	UserID         uint      `gorm:"not null;uniqueIndex:idx_calendar_event_attendee;index" json:"userId"`
	ResponseStatus string    `gorm:"size:20;not null;default:'pending'" json:"responseStatus"`
	User           User      `gorm:"foreignKey:UserID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"user"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}
