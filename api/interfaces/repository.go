// api/interfaces/repository.go
package interfaces

import (
	"context"
	"github.com/BryanPMX/CAF/api/models"
)

// Repository interfaces for Dependency Inversion Principle

// CaseRepository defines the interface for case data operations
type CaseRepository interface {
	Create(ctx context.Context, caseModel *models.Case) error
	GetByID(ctx context.Context, id uint) (*models.Case, error)
	Update(ctx context.Context, caseModel *models.Case) error
	Delete(ctx context.Context, id uint) error
	List(ctx context.Context, filter CaseFilter) ([]models.Case, int64, error)
	GetAssignedToUser(ctx context.Context, userID string) ([]models.Case, error)
}

// AppointmentRepository defines the interface for appointment data operations
type AppointmentRepository interface {
	Create(ctx context.Context, appointment *models.Appointment) error
	GetByID(ctx context.Context, id uint) (*models.Appointment, error)
	Update(ctx context.Context, appointment *models.Appointment) error
	Delete(ctx context.Context, id uint) error
	List(ctx context.Context, filter AppointmentFilter) ([]models.Appointment, int64, error)
	GetByCaseID(ctx context.Context, caseID uint) ([]models.Appointment, error)
	GetAssignedToUser(ctx context.Context, userID string) ([]models.Appointment, error)
}

// UserRepository defines the interface for user data operations
type UserRepository interface {
	GetByID(ctx context.Context, id string) (*models.User, error)
	GetByEmail(ctx context.Context, email string) (*models.User, error)
	List(ctx context.Context, filter UserFilter) ([]models.User, int64, error)
	Create(ctx context.Context, user *models.User) error
	Update(ctx context.Context, user *models.User) error
}

// OfficeRepository defines the interface for office data operations (CRUD with hard delete only).
type OfficeRepository interface {
	List(ctx context.Context) ([]models.Office, error)
	GetByID(ctx context.Context, id uint) (*models.Office, error)
	Create(ctx context.Context, office *models.Office) error
	Update(ctx context.Context, office *models.Office) error
	Delete(ctx context.Context, id uint) error
	ExistsByName(ctx context.Context, name string, excludeID uint) (bool, error)
	GenerateUniqueCode(ctx context.Context, name string, excludeID uint) string
	// GetDeleteBlockReason returns a non-empty message if the office cannot be deleted (e.g. has users, cases, appointments). Empty means delete is allowed.
	GetDeleteBlockReason(ctx context.Context, officeID uint) (string, error)
}

// Filter structs for query parameters
type CaseFilter struct {
	Status        *string
	OfficeID      *uint
	UserID        *string
	Department    *string
	Limit         int
	Offset        int
	IncludeClosed bool
}

type AppointmentFilter struct {
	Status   *string
	CaseID   *uint
	UserID   *string
	DateFrom *string
	DateTo   *string
	Limit    int
	Offset   int
}

type UserFilter struct {
	Role     *string
	OfficeID *uint
	Status   *string
	Limit    int
	Offset   int
}
