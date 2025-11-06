// api/repositories/case_repository.go
package repositories

import (
	"context"
	"github.com/BryanPMX/CAF/api/interfaces"
	"github.com/BryanPMX/CAF/api/models"
	"gorm.io/gorm"
)

// CaseRepositoryImpl implements the CaseRepository interface
type CaseRepositoryImpl struct {
	db *gorm.DB
}

// NewCaseRepository creates a new case repository
func NewCaseRepository(db *gorm.DB) interfaces.CaseRepository {
	return &CaseRepositoryImpl{db: db}
}

// Create creates a new case
func (r *CaseRepositoryImpl) Create(ctx context.Context, caseModel *models.Case) error {
	return r.db.WithContext(ctx).Create(caseModel).Error
}

// GetByID retrieves a case by ID
func (r *CaseRepositoryImpl) GetByID(ctx context.Context, id uint) (*models.Case, error) {
	var caseModel models.Case
	err := r.db.WithContext(ctx).
		Preload("Client").
		Preload("Office").
		Preload("PrimaryStaff").
		Preload("AssignedStaff").
		First(&caseModel, id).Error
	if err != nil {
		return nil, err
	}
	return &caseModel, nil
}

// Update updates a case
func (r *CaseRepositoryImpl) Update(ctx context.Context, caseModel *models.Case) error {
	return r.db.WithContext(ctx).Save(caseModel).Error
}

// Delete deletes a case
func (r *CaseRepositoryImpl) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&models.Case{}, id).Error
}

// List retrieves cases based on filter
func (r *CaseRepositoryImpl) List(ctx context.Context, filter interfaces.CaseFilter) ([]models.Case, int64, error) {
	var cases []models.Case
	var total int64

	query := r.db.WithContext(ctx).Model(&models.Case{}).
		Preload("Client").
		Preload("Office").
		Preload("PrimaryStaff")

	// Apply filters
	if filter.Status != nil {
		query = query.Where("status = ?", *filter.Status)
	}
	if filter.OfficeID != nil {
		query = query.Where("office_id = ?", *filter.OfficeID)
	}
	if filter.UserID != nil {
		query = query.Joins("JOIN user_case_assignments uca ON cases.id = uca.case_id").
			Where("uca.user_id = ?", *filter.UserID)
	}
	if filter.Department != nil {
		query = query.Where("category = ?", *filter.Department)
	}
	if !filter.IncludeClosed {
		query = query.Where("status NOT IN (?)", []string{"closed", "completed"})
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
	err := query.Find(&cases).Error
	return cases, total, err
}

// GetAssignedToUser gets cases assigned to a specific user
func (r *CaseRepositoryImpl) GetAssignedToUser(ctx context.Context, userID string) ([]models.Case, error) {
	var cases []models.Case
	err := r.db.WithContext(ctx).
		Joins("JOIN user_case_assignments uca ON cases.id = uca.case_id").
		Where("uca.user_id = ?", userID).
		Preload("Client").
		Preload("Office").
		Preload("PrimaryStaff").
		Find(&cases).Error
	return cases, err
}
