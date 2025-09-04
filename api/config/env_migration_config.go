package config

import (
	"log"
	"os"
)

// EnvMigrationConfig provides environment variable-based configuration for migrations
type EnvMigrationConfig struct {
	// Environment variables for migration defaults
	EnvCaseCategory          string
	EnvCaseStage             string
	EnvAppointmentCategory   string
	EnvAppointmentDepartment string
	EnvUserDepartment        string
	EnvUserSpecialty         string
	EnvEnvironment           string
	EnvOrganizationType      string
}

// NewEnvMigrationConfig creates a new environment-based migration configuration
func NewEnvMigrationConfig() *EnvMigrationConfig {
	return &EnvMigrationConfig{
		EnvCaseCategory:          "MIGRATION_CASE_CATEGORY",
		EnvCaseStage:             "MIGRATION_CASE_STAGE",
		EnvAppointmentCategory:   "MIGRATION_APPOINTMENT_CATEGORY",
		EnvAppointmentDepartment: "MIGRATION_APPOINTMENT_DEPARTMENT",
		EnvUserDepartment:        "MIGRATION_USER_DEPARTMENT",
		EnvUserSpecialty:         "MIGRATION_USER_SPECIALTY",
		EnvEnvironment:           "MIGRATION_ENVIRONMENT",
		EnvOrganizationType:      "MIGRATION_ORGANIZATION_TYPE",
	}
}

// GetMigrationConfigFromEnv reads migration configuration from environment variables
func (emc *EnvMigrationConfig) GetMigrationConfigFromEnv() *MigrationConfig {
	migrationDefaults := NewMigrationDefaults()

	// Check if organization type is specified
	if orgType := os.Getenv(emc.EnvOrganizationType); orgType != "" {
		log.Printf("INFO: Using organization type configuration: %s", orgType)
		return migrationDefaults.GetConfigByOrganizationType(orgType)
	}

	// Check if environment is specified
	if env := os.Getenv(emc.EnvEnvironment); env != "" {
		log.Printf("INFO: Using environment configuration: %s", env)
		return migrationDefaults.GetConfigByEnvironment(env)
	}

	// Check if custom values are specified
	if emc.hasCustomEnvValues() {
		log.Println("INFO: Using custom environment variable configuration")
		return emc.getCustomEnvConfig()
	}

	// Default to production configuration
	log.Println("INFO: No environment configuration found, using production defaults")
	return migrationDefaults.GetConfigByEnvironment("production")
}

// hasCustomEnvValues checks if any custom environment variables are set
func (emc *EnvMigrationConfig) hasCustomEnvValues() bool {
	return os.Getenv(emc.EnvCaseCategory) != "" ||
		os.Getenv(emc.EnvCaseStage) != "" ||
		os.Getenv(emc.EnvAppointmentCategory) != "" ||
		os.Getenv(emc.EnvAppointmentDepartment) != "" ||
		os.Getenv(emc.EnvUserDepartment) != "" ||
		os.Getenv(emc.EnvUserSpecialty) != ""
}

// getCustomEnvConfig creates a configuration from environment variables
func (emc *EnvMigrationConfig) getCustomEnvConfig() *MigrationConfig {
	// Get values from environment variables with fallbacks
	caseCategory := emc.getEnvWithFallback(emc.EnvCaseCategory, "general")
	caseStage := emc.getEnvWithFallback(emc.EnvCaseStage, "intake")
	appointmentCategory := emc.getEnvWithFallback(emc.EnvAppointmentCategory, "consultation")
	appointmentDepartment := emc.getEnvWithFallback(emc.EnvAppointmentDepartment, "general")
	userDepartment := emc.getEnvWithFallback(emc.EnvUserDepartment, "general")
	userSpecialty := emc.getEnvWithFallback(emc.EnvUserSpecialty, "general_practice")

	return &MigrationConfig{
		DefaultCaseCategory:          caseCategory,
		DefaultCaseStage:             caseStage,
		DefaultAppointmentCategory:   appointmentCategory,
		DefaultAppointmentDepartment: appointmentDepartment,
		DefaultUserDepartment:        userDepartment,
		DefaultUserSpecialty:         userSpecialty,
		Description:                  "Custom environment-based configuration",
	}
}

// getEnvWithFallback gets an environment variable value or returns the fallback
func (emc *EnvMigrationConfig) getEnvWithFallback(envVar, fallback string) string {
	if value := os.Getenv(envVar); value != "" {
		return value
	}
	return fallback
}

// PrintEnvironmentInfo prints information about the current environment configuration
func (emc *EnvMigrationConfig) PrintEnvironmentInfo() {
	println("=== Environment Migration Configuration ===")
	println("Environment Variables:")
	println("  MIGRATION_ENVIRONMENT:", os.Getenv(emc.EnvEnvironment))
	println("  MIGRATION_ORGANIZATION_TYPE:", os.Getenv(emc.EnvOrganizationType))
	println("  MIGRATION_CASE_CATEGORY:", os.Getenv(emc.EnvCaseCategory))
	println("  MIGRATION_CASE_STAGE:", os.Getenv(emc.EnvCaseStage))
	println("  MIGRATION_APPOINTMENT_CATEGORY:", os.Getenv(emc.EnvAppointmentCategory))
	println("  MIGRATION_APPOINTMENT_DEPARTMENT:", os.Getenv(emc.EnvAppointmentDepartment))
	println("  MIGRATION_USER_DEPARTMENT:", os.Getenv(emc.EnvUserDepartment))
	println("  MIGRATION_USER_SPECIALTY:", os.Getenv(emc.EnvUserSpecialty))
	println("=============================================")
}

// GetEnvironmentExamples returns example environment variable configurations
func (emc *EnvMigrationConfig) GetEnvironmentExamples() map[string]string {
	return map[string]string{
		"Legal Services Organization": `
# Legal Services Organization
export MIGRATION_ORGANIZATION_TYPE=legal_services
export MIGRATION_CASE_CATEGORY=legal
export MIGRATION_APPOINTMENT_CATEGORY=legal_consultation
export MIGRATION_APPOINTMENT_DEPARTMENT=legal
export MIGRATION_USER_DEPARTMENT=legal
export MIGRATION_USER_SPECIALTY=general_practice
`,

		"Psychological Services Organization": `
# Psychological Services Organization
export MIGRATION_ORGANIZATION_TYPE=psychological_services
export MIGRATION_CASE_CATEGORY=psychological
export MIGRATION_APPOINTMENT_CATEGORY=therapy_session
export MIGRATION_APPOINTMENT_DEPARTMENT=psychology
export MIGRATION_USER_DEPARTMENT=psychology
export MIGRATION_USER_SPECIALTY=general_therapy
`,

		"Social Services Organization": `
# Social Services Organization
export MIGRATION_ORGANIZATION_TYPE=social_services
export MIGRATION_CASE_CATEGORY=social
export MIGRATION_APPOINTMENT_CATEGORY=social_work
export MIGRATION_APPOINTMENT_DEPARTMENT=social_work
export MIGRATION_USER_DEPARTMENT=social_work
export MIGRATION_USER_SPECIALTY=general_social_work
`,

		"Development Environment": `
# Development Environment
export MIGRATION_ENVIRONMENT=development
export MIGRATION_CASE_CATEGORY=development
export MIGRATION_APPOINTMENT_CATEGORY=development
export MIGRATION_APPOINTMENT_DEPARTMENT=development
export MIGRATION_USER_DEPARTMENT=development
export MIGRATION_USER_SPECIALTY=development
`,

		"Custom Configuration": `
# Custom Configuration
export MIGRATION_CASE_CATEGORY=custom_category
export MIGRATION_CASE_STAGE=custom_stage
export MIGRATION_APPOINTMENT_CATEGORY=custom_appointment
export MIGRATION_APPOINTMENT_DEPARTMENT=custom_department
export MIGRATION_USER_DEPARTMENT=custom_user_dept
export MIGRATION_USER_SPECIALTY=custom_specialty
`,
	}
}

// CreateDotEnvTemplate creates a .env template file for easy configuration
func (emc *EnvMigrationConfig) CreateDotEnvTemplate() string {
	return `# Migration Configuration Template
# Copy this file to .env and customize the values

# Organization Type (optional - will use predefined configurations)
# Options: legal_services, psychological_services, social_services, general_practice
MIGRATION_ORGANIZATION_TYPE=

# Environment (optional - will use predefined configurations)
# Options: development, production, testing
MIGRATION_ENVIRONMENT=

# Custom Case Configuration
MIGRATION_CASE_CATEGORY=general
MIGRATION_CASE_STAGE=intake

# Custom Appointment Configuration
MIGRATION_APPOINTMENT_CATEGORY=consultation
MIGRATION_APPOINTMENT_DEPARTMENT=general

# Custom User Configuration
MIGRATION_USER_DEPARTMENT=general
MIGRATION_USER_SPECIALTY=general_practice

# Examples:
# MIGRATION_ORGANIZATION_TYPE=legal_services
# MIGRATION_ENVIRONMENT=production
# MIGRATION_CASE_CATEGORY=legal
# MIGRATION_APPOINTMENT_CATEGORY=legal_consultation
# MIGRATION_APPOINTMENT_DEPARTMENT=legal
# MIGRATION_USER_DEPARTMENT=legal
# MIGRATION_USER_SPECIALTY=general_practice
`
}
