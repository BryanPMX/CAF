// api/repositories/office_repository.go
package repositories

import (
	"context"
	"fmt"
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

// openCaseStatuses are statuses that block office delete; closed/completed cases live in Records and do not block.
var openCaseStatuses = []string{"open", "in_progress", "pending", "archived"}

// GetDeleteBlockReason returns a non-empty message if the office has users, open cases, appointments, or therapist capacities; empty if delete is allowed.
func (r *OfficeRepositoryImpl) GetDeleteBlockReason(ctx context.Context, officeID uint) (string, error) {
	db := r.db.WithContext(ctx)
	var users, openCases, appointments, capacities int64
	if err := db.Model(&models.User{}).Where("office_id = ?", officeID).Count(&users).Error; err != nil {
		return "", err
	}
	if err := db.Model(&models.Case{}).Where("office_id = ? AND status IN ?", officeID, openCaseStatuses).Count(&openCases).Error; err != nil {
		return "", err
	}
	if err := db.Model(&models.Appointment{}).Where("office_id = ?", officeID).Count(&appointments).Error; err != nil {
		return "", err
	}
	if err := db.Table("therapist_office_capacities").Where("office_id = ?", officeID).Count(&capacities).Error; err != nil {
		return "", err
	}
	if users == 0 && openCases == 0 && appointments == 0 && capacities == 0 {
		return "", nil
	}
	parts := []string{}
	if users > 0 {
		parts = append(parts, fmt.Sprintf("%d usuario(s)", users))
	}
	if openCases > 0 {
		parts = append(parts, fmt.Sprintf("%d caso(s) abierto(s)", openCases))
	}
	if appointments > 0 {
		parts = append(parts, fmt.Sprintf("%d cita(s)", appointments))
	}
	if capacities > 0 {
		parts = append(parts, fmt.Sprintf("capacidades de terapeutas configuradas (%d)", capacities))
	}
	return "No se puede eliminar la oficina: tiene " + strings.Join(parts, ", ") + ". Reasigne o elimine antes de eliminar la oficina.", nil
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
