// api/repositories/office_repository.go
package repositories

import (
	"context"
	"regexp"
	"strconv"
	"strings"

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

// Create persists a new office (Code must be set by caller using GenerateUniqueCode).
func (r *OfficeRepositoryImpl) Create(ctx context.Context, office *models.Office) error {
	return r.db.WithContext(ctx).Create(office).Error
}

// Update persists changes to an existing office
func (r *OfficeRepositoryImpl) Update(ctx context.Context, office *models.Office) error {
	return r.db.WithContext(ctx).Save(office).Error
}

// Delete permanently removes an office (hard delete)
func (r *OfficeRepositoryImpl) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&models.Office{}, id).Error
}

// ExistsByName returns true if an office with the given name exists (optionally excluding an ID)
func (r *OfficeRepositoryImpl) ExistsByName(ctx context.Context, name string, excludeID uint) (bool, error) {
	var count int64
	q := r.db.WithContext(ctx).Model(&models.Office{}).Where("name = ?", name)
	if excludeID != 0 {
		q = q.Where("id != ?", excludeID)
	}
	if err := q.Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

// GenerateUniqueCode returns a URL-style unique code for the given name
func (r *OfficeRepositoryImpl) GenerateUniqueCode(ctx context.Context, name string, excludeID uint) string {
	base := strings.ToLower(name)
	base = regexp.MustCompile(`[^a-z0-9]+`).ReplaceAllString(base, "-")
	base = strings.Trim(base, "-")
	if base == "" {
		base = "office"
	}
	code := base
	suffix := 1
	for {
		var count int64
		q := r.db.WithContext(ctx).Model(&models.Office{}).Where("code = ?", code)
		if excludeID != 0 {
			q = q.Where("id != ?", excludeID)
		}
		q.Count(&count)
		if count == 0 {
			break
		}
		suffix++
		code = base + "-" + strconv.Itoa(suffix)
	}
	return code
}
