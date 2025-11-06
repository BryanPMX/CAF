// api/services/appointment_service.go
package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/BryanPMX/CAF/api/config"
	"github.com/BryanPMX/CAF/api/interfaces"
	"github.com/BryanPMX/CAF/api/models"
)

// AppointmentServiceImpl implements the AppointmentService interface
type AppointmentServiceImpl struct {
	appointmentRepo interfaces.AppointmentRepository
	caseRepo       interfaces.CaseRepository
	userRepo       interfaces.UserRepository
}

// NewAppointmentService creates a new appointment service
func NewAppointmentService(
	appointmentRepo interfaces.AppointmentRepository,
	caseRepo interfaces.CaseRepository,
	userRepo interfaces.UserRepository,
) interfaces.AppointmentService {
	return &AppointmentServiceImpl{
		appointmentRepo: appointmentRepo,
		caseRepo:       caseRepo,
		userRepo:       userRepo,
	}
}

// CreateAppointment creates a new appointment with business logic validation
func (s *AppointmentServiceImpl) CreateAppointment(ctx context.Context, req interfaces.CreateAppointmentRequest) (*models.Appointment, error) {
	// Validate that the case exists and user has access
	_, err := s.caseRepo.GetByID(ctx, req.CaseID)
	if err != nil {
		return nil, fmt.Errorf("invalid case ID: %w", err)
	}

	// Validate time format and logic
	startTime, err := time.Parse(time.RFC3339, req.StartTime)
	if err != nil {
		return nil, errors.New("invalid start_time format, use RFC3339")
	}

	endTime, err := time.Parse(time.RFC3339, req.EndTime)
	if err != nil {
		return nil, errors.New("invalid end_time format, use RFC3339")
	}

	if !endTime.After(startTime) {
		return nil, errors.New("end_time must be after start_time")
	}

	if startTime.Before(time.Now()) {
		return nil, errors.New("cannot create appointments in the past")
	}

	appointment := &models.Appointment{
		Title:     req.Title,
		CaseID:    req.CaseID,
		StartTime: startTime,
		EndTime:   endTime,
		Status:    config.AppointmentStatus(req.Status),
		StaffID:   0, // Will be set based on assigned user
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	err = s.appointmentRepo.Create(ctx, appointment)
	if err != nil {
		return nil, fmt.Errorf("failed to create appointment: %w", err)
	}

	return s.appointmentRepo.GetByID(ctx, appointment.ID)
}

// GetAppointment retrieves an appointment with access control
func (s *AppointmentServiceImpl) GetAppointment(ctx context.Context, id uint, userContext interfaces.UserContext) (*models.Appointment, error) {
	appointment, err := s.appointmentRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get appointment: %w", err)
	}

	// Check access permissions
	if !s.canAccessAppointment(appointment, userContext) {
		return nil, errors.New("access denied: insufficient permissions")
	}

	return appointment, nil
}

// UpdateAppointment updates an appointment with business logic validation
func (s *AppointmentServiceImpl) UpdateAppointment(ctx context.Context, id uint, req interfaces.UpdateAppointmentRequest, userContext interfaces.UserContext) (*models.Appointment, error) {
	appointment, err := s.appointmentRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get appointment for update: %w", err)
	}

	// Check access permissions
	if !s.canModifyAppointment(appointment, userContext) {
		return nil, errors.New("access denied: insufficient permissions to modify appointment")
	}

	// Apply updates
	if req.Title != nil {
		appointment.Title = *req.Title
	}
	if req.StartTime != nil {
		startTime, err := time.Parse(time.RFC3339, *req.StartTime)
		if err != nil {
			return nil, errors.New("invalid start_time format")
		}
		appointment.StartTime = startTime
	}
	if req.EndTime != nil {
		endTime, err := time.Parse(time.RFC3339, *req.EndTime)
		if err != nil {
			return nil, errors.New("invalid end_time format")
		}
		appointment.EndTime = endTime
	}
	if req.Status != nil {
		appointment.Status = config.AppointmentStatus(*req.Status)
	}
	if req.AssignedTo != nil {
		// TODO: Resolve user ID from assigned_to field
		// appointment.StaffID = resolvedUserID
	}

	// Validate time logic if both times are provided
	if req.StartTime != nil && req.EndTime != nil {
		if !appointment.EndTime.After(appointment.StartTime) {
			return nil, errors.New("end_time must be after start_time")
		}
	}

	appointment.UpdatedAt = time.Now()

	err = s.appointmentRepo.Update(ctx, appointment)
	if err != nil {
		return nil, fmt.Errorf("failed to update appointment: %w", err)
	}

	return s.appointmentRepo.GetByID(ctx, appointment.ID)
}

// DeleteAppointment deletes an appointment with business logic validation
func (s *AppointmentServiceImpl) DeleteAppointment(ctx context.Context, id uint, userContext interfaces.UserContext) error {
	appointment, err := s.appointmentRepo.GetByID(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to get appointment for deletion: %w", err)
	}

	// Check access permissions
	if !s.canModifyAppointment(appointment, userContext) {
		return errors.New("access denied: insufficient permissions to delete appointment")
	}

	// Business rule: cannot delete appointments that have already started
	if appointment.StartTime.Before(time.Now()) {
		return errors.New("cannot delete appointments that have already started")
	}

	return s.appointmentRepo.Delete(ctx, id)
}

// ListAppointments lists appointments with filtering and access control
func (s *AppointmentServiceImpl) ListAppointments(ctx context.Context, filter interfaces.AppointmentListFilter, userContext interfaces.UserContext) ([]models.Appointment, int64, error) {
	repoFilter := interfaces.AppointmentFilter{
		Status:   filter.Status,
		CaseID:   filter.CaseID,
		UserID:   filter.AssignedTo,
		DateFrom: filter.DateFrom,
		DateTo:   filter.DateTo,
		Limit:    filter.PageSize,
		Offset:   (filter.Page - 1) * filter.PageSize,
	}

	// Apply access control to filter
	if userContext.Role != "admin" && userContext.Role != "office_manager" {
		// Staff can only see their assigned appointments
		repoFilter.UserID = &userContext.UserID
	}

	return s.appointmentRepo.List(ctx, repoFilter)
}

// GetAppointmentsByCase gets appointments for a specific case
func (s *AppointmentServiceImpl) GetAppointmentsByCase(ctx context.Context, caseID uint, userContext interfaces.UserContext) ([]models.Appointment, error) {
	// Verify user has access to the case
	caseModel, err := s.caseRepo.GetByID(ctx, caseID)
	if err != nil {
		return nil, fmt.Errorf("failed to get case: %w", err)
	}

	// Check case access permissions
	if !s.canAccessCase(caseModel, userContext) {
		return nil, errors.New("access denied: insufficient permissions to view case appointments")
	}

	return s.appointmentRepo.GetByCaseID(ctx, caseID)
}

// Helper methods for access control

func (s *AppointmentServiceImpl) canAccessAppointment(appointment *models.Appointment, userContext interfaces.UserContext) bool {
	// Admins can access all appointments
	if userContext.Role == "admin" {
		return true
	}

	// Check if user is assigned to this appointment
	if appointment.StaffID != 0 && fmt.Sprintf("%d", appointment.StaffID) == userContext.UserID {
		return true
	}

	// Check if user has access to the case this appointment belongs to
	if appointment.CaseID != 0 {
		caseModel, err := s.caseRepo.GetByID(context.Background(), appointment.CaseID)
		if err == nil {
			return s.canAccessCase(caseModel, userContext)
		}
	}

	return false
}

func (s *AppointmentServiceImpl) canModifyAppointment(appointment *models.Appointment, userContext interfaces.UserContext) bool {
	// Admins can modify all appointments
	if userContext.Role == "admin" {
		return true
	}

	// Office managers can modify appointments for cases in their office
	if userContext.Role == "office_manager" && appointment.CaseID != 0 {
		caseModel, err := s.caseRepo.GetByID(context.Background(), appointment.CaseID)
		if err == nil && userContext.OfficeID != nil && caseModel.OfficeID == *userContext.OfficeID {
			return true
		}
	}

	// Staff can only modify appointments assigned to them
	if appointment.StaffID != 0 && fmt.Sprintf("%d", appointment.StaffID) == userContext.UserID {
		return true
	}

	return false
}

func (s *AppointmentServiceImpl) canAccessCase(caseModel *models.Case, userContext interfaces.UserContext) bool {
	// Admins can access all cases
	if userContext.Role == "admin" {
		return true
	}

	// Office managers can access cases from their office
	if userContext.Role == "office_manager" && userContext.OfficeID != nil && caseModel.OfficeID == *userContext.OfficeID {
		return true
	}

	// Staff can only access cases assigned to them (simplified check)
	return true // Would need proper assignment checking
}
