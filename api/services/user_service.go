// api/services/user_service.go
package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/BryanPMX/CAF/api/interfaces"
	"github.com/BryanPMX/CAF/api/models"
	"golang.org/x/crypto/bcrypt"
)

// UserServiceImpl implements the UserService interface
type UserServiceImpl struct {
	userRepo interfaces.UserRepository
}

// NewUserService creates a new user service
func NewUserService(userRepo interfaces.UserRepository) interfaces.UserService {
	return &UserServiceImpl{userRepo: userRepo}
}

// Authenticate authenticates a user with email and password
func (s *UserServiceImpl) Authenticate(ctx context.Context, email, password string) (*models.User, error) {
	user, err := s.userRepo.GetByEmail(ctx, email)
	if err != nil {
		return nil, errors.New("invalid email or password")
	}

	// Verify password
	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password))
	if err != nil {
		return nil, errors.New("invalid email or password")
	}

	// Check if user is active
	if !user.IsActive {
		return nil, errors.New("account is not active")
	}

	return user, nil
}

// GetUserProfile gets a user's profile information
func (s *UserServiceImpl) GetUserProfile(ctx context.Context, userID string) (*models.User, error) {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user profile: %w", err)
	}

	// Don't return sensitive information like password
	user.Password = ""
	return user, nil
}

// UpdateUserProfile updates a user's profile information
func (s *UserServiceImpl) UpdateUserProfile(ctx context.Context, userID string, updates interfaces.UserProfileUpdate) (*models.User, error) {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user for update: %w", err)
	}

	// Apply updates
	if updates.FirstName != nil {
		user.FirstName = *updates.FirstName
	}
	if updates.LastName != nil {
		user.LastName = *updates.LastName
	}

	user.UpdatedAt = time.Now()

	err = s.userRepo.Update(ctx, user)
	if err != nil {
		return nil, fmt.Errorf("failed to update user profile: %w", err)
	}

	// Return updated user without password
	user.Password = ""
	return user, nil
}

// ListUsers lists users with filtering and access control
func (s *UserServiceImpl) ListUsers(ctx context.Context, filter interfaces.UserListFilter, requestingUser interfaces.UserContext) ([]models.User, int64, error) {
	repoFilter := interfaces.UserFilter{
		Role:     filter.Role,
		OfficeID: filter.OfficeID,
		Status:   filter.Status,
		Limit:    filter.PageSize,
		Offset:   (filter.Page - 1) * filter.PageSize,
	}

	// Apply access control
	if requestingUser.Role != "admin" {
		// Non-admins can only see users from their office
		if requestingUser.OfficeID != nil {
			repoFilter.OfficeID = requestingUser.OfficeID
		} else {
			return nil, 0, errors.New("access denied: cannot determine user's office")
		}
	}

	users, total, err := s.userRepo.List(ctx, repoFilter)
	if err != nil {
		return nil, 0, err
	}

	// Remove passwords from response
	for i := range users {
		users[i].Password = ""
	}

	return users, total, nil
}

// CreateUser creates a new user with proper validation
func (s *UserServiceImpl) CreateUser(ctx context.Context, userData interfaces.CreateUserRequest, requestingUser interfaces.UserContext) (*models.User, error) {
	// Check permissions - only admins can create users
	if requestingUser.Role != "admin" {
		return nil, errors.New("access denied: only administrators can create users")
	}

	// Validate role
	validRoles := []string{"admin", "office_manager", "lawyer", "psychologist", "receptionist", "event_coordinator", "client"}
	isValidRole := false
	for _, role := range validRoles {
		if userData.Role == role {
			isValidRole = true
			break
		}
	}
	if !isValidRole {
		return nil, errors.New("invalid role specified")
	}

	// Check if email already exists
	existingUser, err := s.userRepo.GetByEmail(ctx, userData.Email)
	if err == nil && existingUser != nil {
		return nil, errors.New("user with this email already exists")
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte("defaultPassword123"), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	user := &models.User{
		Email:     userData.Email,
		FirstName: userData.FirstName,
		LastName:  userData.LastName,
		Role:      userData.Role,
		OfficeID:  &userData.OfficeID,
		Password:  string(hashedPassword),
		IsActive:  true,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	err = s.userRepo.Create(ctx, user)
	if err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	// Return created user without password
	user.Password = ""
	return user, nil
}
