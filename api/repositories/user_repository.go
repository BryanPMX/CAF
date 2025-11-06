// api/repositories/user_repository.go
package repositories

import (
	"context"
	"github.com/BryanPMX/CAF/api/interfaces"
	"github.com/BryanPMX/CAF/api/models"
	"gorm.io/gorm"
)

// UserRepositoryImpl implements the UserRepository interface
type UserRepositoryImpl struct {
	db *gorm.DB
}

// NewUserRepository creates a new user repository
func NewUserRepository(db *gorm.DB) interfaces.UserRepository {
	return &UserRepositoryImpl{db: db}
}

// GetByID retrieves a user by ID
func (r *UserRepositoryImpl) GetByID(ctx context.Context, id string) (*models.User, error) {
	var user models.User
	err := r.db.WithContext(ctx).First(&user, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// GetByEmail retrieves a user by email
func (r *UserRepositoryImpl) GetByEmail(ctx context.Context, email string) (*models.User, error) {
	var user models.User
	err := r.db.WithContext(ctx).First(&user, "email = ?", email).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// List retrieves users based on filter
func (r *UserRepositoryImpl) List(ctx context.Context, filter interfaces.UserFilter) ([]models.User, int64, error) {
	var users []models.User
	var total int64

	query := r.db.WithContext(ctx).Model(&models.User{})

	// Apply filters
	if filter.Role != nil {
		query = query.Where("role = ?", *filter.Role)
	}
	if filter.OfficeID != nil {
		query = query.Where("office_id = ?", *filter.OfficeID)
	}
	if filter.Status != nil {
		query = query.Where("status = ?", *filter.Status)
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
	err := query.Find(&users).Error
	return users, total, err
}

// Create creates a new user
func (r *UserRepositoryImpl) Create(ctx context.Context, user *models.User) error {
	return r.db.WithContext(ctx).Create(user).Error
}

// Update updates a user
func (r *UserRepositoryImpl) Update(ctx context.Context, user *models.User) error {
	return r.db.WithContext(ctx).Save(user).Error
}
