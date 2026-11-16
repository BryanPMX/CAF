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

// BootstrapAdmin creates the protected technical support account only when both bootstrap
// environment values are explicitly supplied and no technical support account
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

	var supportCount int64
	if err := database.Unscoped().Model(&models.User{}).
		Where("role = ?", config.RoleTechnicalSupport).
		Count(&supportCount).Error; err != nil {
		return false, fmt.Errorf("check technical support accounts: %w", err)
	}
	if supportCount > 0 {
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
	support := models.User{
		FirstName: "System",
		LastName:  "Support",
		Email:     email,
		Password:  hash,
		Role:      config.RoleTechnicalSupport,
		IsActive:  true,
	}
	if err := database.Create(&support).Error; err != nil {
		return false, fmt.Errorf("create bootstrap administrator: %w", err)
	}
	return true, nil
}
