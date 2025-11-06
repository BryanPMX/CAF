// api/repositories/appointment_repository.go
package repositories

import (
	"context"
	"github.com/BryanPMX/CAF/api/interfaces"
	"github.com/BryanPMX/CAF/api/models"
	"gorm.io/gorm"
)

// AppointmentRepositoryImpl implements the AppointmentRepository interface
type AppointmentRepositoryImpl struct {
	db *gorm.DB
}

// NewAppointmentRepository creates a new appointment repository
func NewAppointmentRepository(db *gorm.DB) interfaces.AppointmentRepository {
	return &AppointmentRepositoryImpl{db: db}
}

// Create creates a new appointment
func (r *AppointmentRepositoryImpl) Create(ctx context.Context, appointment *models.Appointment) error {
	return r.db.WithContext(ctx).Create(appointment).Error
}

// GetByID retrieves an appointment by ID
func (r *AppointmentRepositoryImpl) GetByID(ctx context.Context, id uint) (*models.Appointment, error) {
	var appointment models.Appointment
	err := r.db.WithContext(ctx).
		Preload("Case").
		Preload("AssignedStaff").
		First(&appointment, id).Error
	if err != nil {
		return nil, err
	}
	return &appointment, nil
}

// Update updates an appointment
func (r *AppointmentRepositoryImpl) Update(ctx context.Context, appointment *models.Appointment) error {
	return r.db.WithContext(ctx).Save(appointment).Error
}

// Delete deletes an appointment
func (r *AppointmentRepositoryImpl) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&models.Appointment{}, id).Error
}

// List retrieves appointments based on filter
func (r *AppointmentRepositoryImpl) List(ctx context.Context, filter interfaces.AppointmentFilter) ([]models.Appointment, int64, error) {
	var appointments []models.Appointment
	var total int64

	query := r.db.WithContext(ctx).Model(&models.Appointment{}).
		Preload("Case").
		Preload("AssignedStaff")

	// Apply filters
	if filter.Status != nil {
		query = query.Where("status = ?", *filter.Status)
	}
	if filter.CaseID != nil {
		query = query.Where("case_id = ?", *filter.CaseID)
	}
	if filter.UserID != nil {
		query = query.Where("assigned_to = ?", *filter.UserID)
	}
	if filter.DateFrom != nil && filter.DateTo != nil {
		query = query.Where("start_time >= ? AND start_time <= ?", *filter.DateFrom, *filter.DateTo)
	}

	// Count total
	query.Count(&total)

	// Apply pagination
	if filter.Limit > 0 {
		query = query.Limit(filter.Limit)
	}
	if filter.Offset > 0 {
		query = query.Offset(filter.Offset)
	}

	// Execute query
	err := query.Find(&appointments).Error
	return appointments, total, err
}

// GetByCaseID gets appointments for a specific case
func (r *AppointmentRepositoryImpl) GetByCaseID(ctx context.Context, caseID uint) ([]models.Appointment, error) {
	var appointments []models.Appointment
	err := r.db.WithContext(ctx).
		Where("case_id = ?", caseID).
		Preload("AssignedStaff").
		Order("start_time ASC").
		Find(&appointments).Error
	return appointments, err
}

// GetAssignedToUser gets appointments assigned to a specific user
func (r *AppointmentRepositoryImpl) GetAssignedToUser(ctx context.Context, userID string) ([]models.Appointment, error) {
	var appointments []models.Appointment
	err := r.db.WithContext(ctx).
		Where("assigned_to = ?", userID).
		Preload("Case").
		Order("start_time ASC").
		Find(&appointments).Error
	return appointments, err
}
