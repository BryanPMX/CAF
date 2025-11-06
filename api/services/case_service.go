// api/services/case_service.go
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

// CaseServiceImpl implements the CaseService interface
type CaseServiceImpl struct {
	caseRepo       interfaces.CaseRepository
	appointmentRepo interfaces.AppointmentRepository
	userRepo       interfaces.UserRepository
}

// NewCaseService creates a new case service
func NewCaseService(
	caseRepo interfaces.CaseRepository,
	appointmentRepo interfaces.AppointmentRepository,
	userRepo interfaces.UserRepository,
) interfaces.CaseService {
	return &CaseServiceImpl{
		caseRepo:       caseRepo,
		appointmentRepo: appointmentRepo,
		userRepo:       userRepo,
	}
}

// CreateCase creates a new case with business logic validation
func (s *CaseServiceImpl) CreateCase(ctx context.Context, req interfaces.CreateCaseRequest) (*models.Case, error) {
	// Validate business rules
	if req.Priority != "low" && req.Priority != "medium" && req.Priority != "high" && req.Priority != "urgent" {
		return nil, errors.New("invalid priority: must be low, medium, high, or urgent")
	}

	caseModel := &models.Case{
		Title:       req.Title,
		Description: req.Description,
		ClientID:    req.ClientID,
		OfficeID:    req.OfficeID,
		Category:    req.Category,
		Priority:    req.Priority,
		Status:      "open",
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	err := s.caseRepo.Create(ctx, caseModel)
	if err != nil {
		return nil, fmt.Errorf("failed to create case: %w", err)
	}

	// Preload related data
	return s.caseRepo.GetByID(ctx, caseModel.ID)
}

// GetCase retrieves a case with access control
func (s *CaseServiceImpl) GetCase(ctx context.Context, id uint, userContext interfaces.UserContext) (*models.Case, error) {
	caseModel, err := s.caseRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get case: %w", err)
	}

	// Check access permissions
	if !s.canAccessCase(caseModel, userContext) {
		return nil, errors.New("access denied: insufficient permissions")
	}

	return caseModel, nil
}

// UpdateCase updates a case with business logic validation
func (s *CaseServiceImpl) UpdateCase(ctx context.Context, id uint, req interfaces.UpdateCaseRequest, userContext interfaces.UserContext) (*models.Case, error) {
	caseModel, err := s.caseRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get case for update: %w", err)
	}

	// Check access permissions
	if !s.canModifyCase(caseModel, userContext) {
		return nil, errors.New("access denied: insufficient permissions to modify case")
	}

	// Apply updates
	if req.Title != nil {
		caseModel.Title = *req.Title
	}
	if req.Description != nil {
		caseModel.Description = *req.Description
	}
	if req.Status != nil {
		if !s.isValidStatusTransition(caseModel.Status, *req.Status) {
			return nil, fmt.Errorf("invalid status transition from %s to %s", caseModel.Status, *req.Status)
		}
		caseModel.Status = *req.Status
	}
	if req.Priority != nil {
		caseModel.Priority = *req.Priority
	}
	if req.AssigneeID != nil {
		caseModel.PrimaryStaffID = req.AssigneeID
	}

	caseModel.UpdatedAt = time.Now()

	err = s.caseRepo.Update(ctx, caseModel)
	if err != nil {
		return nil, fmt.Errorf("failed to update case: %w", err)
	}

	return s.caseRepo.GetByID(ctx, caseModel.ID)
}

// DeleteCase deletes a case with business logic validation
func (s *CaseServiceImpl) DeleteCase(ctx context.Context, id uint, userContext interfaces.UserContext) error {
	caseModel, err := s.caseRepo.GetByID(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to get case for deletion: %w", err)
	}

	// Check access permissions - only admins can delete cases
	if userContext.Role != "admin" {
		return errors.New("access denied: only administrators can delete cases")
	}

	return s.caseRepo.Delete(ctx, id)
}

// ListCases lists cases with filtering and access control
func (s *CaseServiceImpl) ListCases(ctx context.Context, filter interfaces.CaseListFilter, userContext interfaces.UserContext) ([]models.Case, int64, error) {
	repoFilter := interfaces.CaseFilter{
		Status:        filter.Status,
		OfficeID:      filter.OfficeID,
		UserID:        filter.AssignedTo,
		Department:    filter.Category,
		IncludeClosed: filter.IncludeClosed,
		Limit:         filter.PageSize,
		Offset:        (filter.Page - 1) * filter.PageSize,
	}

	// Apply access control to filter
	if userContext.Role != "admin" && userContext.Role != "office_manager" {
		// Staff can only see their assigned cases
		repoFilter.UserID = &userContext.UserID
	} else if userContext.Role == "office_manager" && userContext.OfficeID != nil {
		// Office managers can see cases from their office
		repoFilter.OfficeID = userContext.OfficeID
	}

	return s.caseRepo.List(ctx, repoFilter)
}

// GetCasesAssignedToUser gets cases assigned to a specific user
func (s *CaseServiceImpl) GetCasesAssignedToUser(ctx context.Context, userID string) ([]models.Case, error) {
	return s.caseRepo.GetAssignedToUser(ctx, userID)
}

// ArchiveCase archives a case
func (s *CaseServiceImpl) ArchiveCase(ctx context.Context, id uint, userContext interfaces.UserContext) (*models.Case, error) {
	caseModel, err := s.caseRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get case for archiving: %w", err)
	}

	// Check permissions
	if userContext.Role != "admin" {
		return nil, errors.New("access denied: only administrators can archive cases")
	}

	caseModel.IsArchived = true
	caseModel.UpdatedAt = time.Now()

	err = s.caseRepo.Update(ctx, caseModel)
	if err != nil {
		return nil, fmt.Errorf("failed to archive case: %w", err)
	}

	return s.caseRepo.GetByID(ctx, caseModel.ID)
}

// Helper methods for access control and validation

func (s *CaseServiceImpl) canAccessCase(caseModel *models.Case, userContext interfaces.UserContext) bool {
	// Admins can access all cases
	if userContext.Role == "admin" {
		return true
	}

	// Office managers can access cases from their office
	if userContext.Role == "office_manager" && userContext.OfficeID != nil && caseModel.OfficeID == *userContext.OfficeID {
		return true
	}

	// Staff can only access cases assigned to them
	if config.IsStaffRole(userContext.Role) {
		// Check if user is assigned to this case (this would need to be implemented)
		return true // Simplified for now
	}

	return false
}

func (s *CaseServiceImpl) canModifyCase(caseModel *models.Case, userContext interfaces.UserContext) bool {
	// Admins can modify all cases
	if userContext.Role == "admin" {
		return true
	}

	// Office managers can modify cases from their office
	if userContext.Role == "office_manager" && userContext.OfficeID != nil && caseModel.OfficeID == *userContext.OfficeID {
		return true
	}

	// Staff can only modify cases assigned to them
	if config.IsStaffRole(userContext.Role) {
		// Check if user is assigned to this case
		return true // Simplified for now
	}

	return false
}

func (s *CaseServiceImpl) isValidStatusTransition(from, to string) bool {
	validTransitions := map[string][]string{
		"open":       {"active", "in_progress", "resolved", "closed"},
		"active":     {"in_progress", "resolved", "closed"},
		"in_progress": {"resolved", "closed", "completed"},
		"resolved":   {"closed", "completed"},
		"closed":     {"reopened"},
		"completed":  {"reopened"},
	}

	validTos, exists := validTransitions[from]
	if !exists {
		return false
	}

	for _, validTo := range validTos {
		if validTo == to {
			return true
		}
	}

	return false
}
