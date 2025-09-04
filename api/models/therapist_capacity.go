package models

// TherapistOfficeCapacity defines daily capacity per therapist and office
// DayOfWeek: 1=Monday ... 7=Sunday
type TherapistOfficeCapacity struct {
	ID        uint `gorm:"primaryKey" json:"id"`
	StaffID   uint `gorm:"not null;index" json:"staffId"`
	OfficeID  uint `gorm:"not null;index" json:"officeId"`
	DayOfWeek int  `gorm:"not null;index" json:"dayOfWeek"`
	Capacity  int  `gorm:"not null;default:0" json:"capacity"`
}
