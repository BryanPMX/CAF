package db

import (
	"fmt"
	"net/mail"
	"strings"

	"github.com/BryanPMX/CAF/api/config"
	"github.com/BryanPMX/CAF/api/models"
	securityutil "github.com/BryanPMX/CAF/api/security"
	"gorm.io/gorm"
)

// BootstrapAdmin creates the first administrator only when both bootstrap
// environment values are explicitly supplied and no active administrator
// exists. It never resets or updates an existing account.
func BootstrapAdmin(database *gorm.DB, rawEmail, password string) (bool, error) {
	email := strings.ToLower(strings.TrimSpace(rawEmail))
	password = strings.TrimSpace(password)
	if email == "" && password == "" {
		return false, nil
	}
	if email == "" || password == "" {
		return false, fmt.Errorf("BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD must be provided together")
	}

	parsed, err := mail.ParseAddress(email)
	if err != nil || parsed.Address != email {
		return false, fmt.Errorf("BOOTSTRAP_ADMIN_EMAIL must be a valid bare email address")
	}
	if err := securityutil.ValidatePassword(password); err != nil {
		return false, fmt.Errorf("invalid bootstrap administrator password: %w", err)
	}

	var activeAdmins int64
	if err := database.Model(&models.User{}).
		Where("role = ? AND is_active = ? AND deleted_at IS NULL", config.RoleAdmin, true).
		Count(&activeAdmins).Error; err != nil {
		return false, fmt.Errorf("check active administrators: %w", err)
	}
	if activeAdmins > 0 {
		return false, nil
	}

	var existing models.User
	if err := database.Unscoped().Where("LOWER(email) = ?", email).First(&existing).Error; err == nil {
		return false, fmt.Errorf("bootstrap email already belongs to an existing account; choose a different email or restore it manually")
	} else if err != gorm.ErrRecordNotFound {
		return false, fmt.Errorf("check bootstrap email: %w", err)
	}

	hash, err := securityutil.HashPassword(password)
	if err != nil {
		return false, err
	}
	admin := models.User{
		FirstName: "System",
		LastName:  "Administrator",
		Email:     email,
		Password:  hash,
		Role:      config.RoleAdmin,
		IsActive:  true,
	}
	if err := database.Create(&admin).Error; err != nil {
		return false, fmt.Errorf("create bootstrap administrator: %w", err)
	}
	return true, nil
}
