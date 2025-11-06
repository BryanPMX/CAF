// api/repositories/office_repository.go
package repositories

import (
	"context"
	"github.com/BryanPMX/CAF/api/interfaces"
	"github.com/BryanPMX/CAF/api/models"
	"gorm.io/gorm"
)

// OfficeRepositoryImpl implements the OfficeRepository interface
type OfficeRepositoryImpl struct {
	db *gorm.DB
}

// NewOfficeRepository creates a new office repository
func NewOfficeRepository(db *gorm.DB) interfaces.OfficeRepository {
	return &OfficeRepositoryImpl{db: db}
}

// List retrieves all offices
func (r *OfficeRepositoryImpl) List(ctx context.Context) ([]models.Office, error) {
	var offices []models.Office
	err := r.db.WithContext(ctx).Find(&offices).Error
	return offices, err
}

// GetByID retrieves an office by ID
func (r *OfficeRepositoryImpl) GetByID(ctx context.Context, id uint) (*models.Office, error) {
	var office models.Office
	err := r.db.WithContext(ctx).First(&office, id).Error
	if err != nil {
		return nil, err
	}
	return &office, nil
}
