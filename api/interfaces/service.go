// api/interfaces/service.go
package interfaces

import (
	"context"
	"github.com/BryanPMX/CAF/api/models"
)

// Service interfaces for business logic operations

// CaseService defines the interface for case business operations
type CaseService interface {
	CreateCase(ctx context.Context, caseData CreateCaseRequest) (*models.Case, error)
	GetCase(ctx context.Context, id uint, userContext UserContext) (*models.Case, error)
	UpdateCase(ctx context.Context, id uint, caseData UpdateCaseRequest, userContext UserContext) (*models.Case, error)
	DeleteCase(ctx context.Context, id uint, userContext UserContext) error
	ListCases(ctx context.Context, filter CaseListFilter, userContext UserContext) ([]models.Case, int64, error)
	GetCasesAssignedToUser(ctx context.Context, userID string) ([]models.Case, error)
	ArchiveCase(ctx context.Context, id uint, userContext UserContext) error
}

// AppointmentService defines the interface for appointment business operations
type AppointmentService interface {
	CreateAppointment(ctx context.Context, appointmentData CreateAppointmentRequest) (*models.Appointment, error)
	GetAppointment(ctx context.Context, id uint, userContext UserContext) (*models.Appointment, error)
	UpdateAppointment(ctx context.Context, id uint, appointmentData UpdateAppointmentRequest, userContext UserContext) (*models.Appointment, error)
	DeleteAppointment(ctx context.Context, id uint, userContext UserContext) error
	ListAppointments(ctx context.Context, filter AppointmentListFilter, userContext UserContext) ([]models.Appointment, int64, error)
	GetAppointmentsByCase(ctx context.Context, caseID uint, userContext UserContext) ([]models.Appointment, error)
}

// UserService defines the interface for user business operations
type UserService interface {
	Authenticate(ctx context.Context, email, password string) (*models.User, error)
	GetUserProfile(ctx context.Context, userID string) (*models.User, error)
	UpdateUserProfile(ctx context.Context, userID string, updates UserProfileUpdate) (*models.User, error)
	ListUsers(ctx context.Context, filter UserListFilter, requestingUser UserContext) ([]models.User, int64, error)
	CreateUser(ctx context.Context, userData CreateUserRequest, requestingUser UserContext) (*models.User, error)
}

// DashboardService defines the interface for dashboard operations
type DashboardService interface {
	GetAdminDashboard(ctx context.Context, filter DashboardFilter) (*DashboardSummary, error)
	GetStaffDashboard(ctx context.Context, userID string) (*StaffDashboardSummary, error)
	GetOfficeManagerDashboard(ctx context.Context, officeID uint, filter DashboardFilter) (*DashboardSummary, error)
}

// Request/Response structs for service operations
type CreateCaseRequest struct {
	Title       string `json:"title" binding:"required"`
	Description string `json:"description"`
	ClientID    uint   `json:"client_id" binding:"required"`
	OfficeID    uint   `json:"office_id" binding:"required"`
	Category    string `json:"category" binding:"required"`
	Priority    string `json:"priority" binding:"required"`
}

type UpdateCaseRequest struct {
	Title       *string `json:"title"`
	Description *string `json:"description"`
	Status      *string `json:"status"`
	Priority    *string `json:"priority"`
	AssigneeID  *string `json:"assignee_id"`
}

type CreateAppointmentRequest struct {
	Title       string `json:"title" binding:"required"`
	Description string `json:"description"`
	CaseID      uint   `json:"case_id" binding:"required"`
	StartTime   string `json:"start_time" binding:"required"`
	EndTime     string `json:"end_time" binding:"required"`
	Status      string `json:"status"`
	AssignedTo  string `json:"assigned_to"`
}

type UpdateAppointmentRequest struct {
	Title       *string `json:"title"`
	Description *string `json:"description"`
	StartTime   *string `json:"start_time"`
	EndTime     *string `json:"end_time"`
	Status      *string `json:"status"`
	AssignedTo  *string `json:"assigned_to"`
}

type CreateUserRequest struct {
	Email     string `json:"email" binding:"required,email"`
	FirstName string `json:"first_name" binding:"required"`
	LastName  string `json:"last_name" binding:"required"`
	Role      string `json:"role" binding:"required"`
	OfficeID  uint   `json:"office_id" binding:"required"`
}

type UserProfileUpdate struct {
	FirstName *string `json:"first_name"`
	LastName  *string `json:"last_name"`
	Phone     *string `json:"phone"`
}

type CaseListFilter struct {
	Status        *string
	OfficeID      *uint
	AssignedTo    *string
	Category      *string
	IncludeClosed bool
	Page          int
	PageSize      int
	Search        *string
}

type AppointmentListFilter struct {
	Status    *string
	CaseID    *uint
	AssignedTo *string
	DateFrom  *string
	DateTo    *string
	Page      int
	PageSize  int
}

type UserListFilter struct {
	Role     *string
	OfficeID *uint
	Status   *string
	Page     int
	PageSize int
	Search   *string
}

type DashboardFilter struct {
	OfficeID *uint
	DateFrom *string
	DateTo   *string
}

type UserContext struct {
	UserID     string
	Role       string
	Department *string
	OfficeID   *uint
}

// Response structs
type DashboardSummary struct {
	TotalCases            int64 `json:"total_cases"`
	OpenCases             int64 `json:"open_cases"`
	CompletedCases        int64 `json:"completed_cases"`
	CasesThisMonth        int64 `json:"cases_this_month"`
	TotalAppointments     int64 `json:"total_appointments"`
	PendingAppointments   int64 `json:"pending_appointments"`
	CompletedAppointments int64 `json:"completed_appointments"`
	AppointmentsToday     int64 `json:"appointments_today"`
	Offices               []models.Office `json:"offices,omitempty"`
}

type StaffDashboardSummary struct {
	MyCases                int64 `json:"my_cases"`
	MyOpenCases            int64 `json:"my_open_cases"`
	MyAppointments         int64 `json:"my_appointments"`
	MyPendingAppointments  int64 `json:"my_pending_appointments"`
}
