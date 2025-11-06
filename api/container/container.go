// api/container/container.go
package container

import (
	"github.com/BryanPMX/CAF/api/interfaces"
	"github.com/BryanPMX/CAF/api/repositories"
	"github.com/BryanPMX/CAF/api/services"
	"gorm.io/gorm"
)

// Container holds all dependencies for dependency injection
type Container struct {
	// Repositories
	caseRepo       interfaces.CaseRepository
	appointmentRepo interfaces.AppointmentRepository
	userRepo       interfaces.UserRepository
	officeRepo     interfaces.OfficeRepository

	// Services
	caseService       interfaces.CaseService
	appointmentService interfaces.AppointmentService
	userService       interfaces.UserService
	dashboardService  interfaces.DashboardService
}

// NewContainer creates a new dependency injection container
func NewContainer(db *gorm.DB) *Container {
	// Initialize repositories
	caseRepo := repositories.NewCaseRepository(db)
	appointmentRepo := repositories.NewAppointmentRepository(db)
	userRepo := repositories.NewUserRepository(db)
	officeRepo := repositories.NewOfficeRepository(db)

	// Initialize services with their dependencies
	caseService := services.NewCaseService(caseRepo, appointmentRepo, userRepo)
	appointmentService := services.NewAppointmentService(appointmentRepo, caseRepo, userRepo)
	userService := services.NewUserService(userRepo)
	dashboardService := services.NewDashboardService(db)

	return &Container{
		caseRepo:           caseRepo,
		appointmentRepo:     appointmentRepo,
		userRepo:           userRepo,
		officeRepo:         officeRepo,
		caseService:        caseService,
		appointmentService: appointmentService,
		userService:        userService,
		dashboardService:   dashboardService,
	}
}

// Getters for repositories
func (c *Container) GetCaseRepository() interfaces.CaseRepository {
	return c.caseRepo
}

func (c *Container) GetAppointmentRepository() interfaces.AppointmentRepository {
	return c.appointmentRepo
}

func (c *Container) GetUserRepository() interfaces.UserRepository {
	return c.userRepo
}

func (c *Container) GetOfficeRepository() interfaces.OfficeRepository {
	return c.officeRepo
}

// Getters for services
func (c *Container) GetCaseService() interfaces.CaseService {
	return c.caseService
}

func (c *Container) GetAppointmentService() interfaces.AppointmentService {
	return c.appointmentService
}

func (c *Container) GetUserService() interfaces.UserService {
	return c.userService
}

func (c *Container) GetDashboardService() interfaces.DashboardService {
	return c.dashboardService
}
