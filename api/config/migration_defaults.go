package config

// MigrationDefaults provides configurable default values for database migrations
type MigrationDefaults struct {
	// Environment-specific configurations
	Development *MigrationConfig
	Production  *MigrationConfig
	Testing     *MigrationConfig

	// Custom configurations for different organization types
	LegalServices         *MigrationConfig
	PsychologicalServices *MigrationConfig
	SocialServices        *MigrationConfig
	GeneralPractice       *MigrationConfig
}

// MigrationConfig holds the actual default values
type MigrationConfig struct {
	// Case defaults
	DefaultCaseCategory string
	DefaultCaseStage    string

	// Appointment defaults
	DefaultAppointmentCategory   string
	DefaultAppointmentDepartment string

	// User defaults
	DefaultUserDepartment string
	DefaultUserSpecialty  string

	// Description for this configuration
	Description string
}

// NewMigrationDefaults creates a new MigrationDefaults instance with predefined configurations
func NewMigrationDefaults() *MigrationDefaults {
	return &MigrationDefaults{
		Development: &MigrationConfig{
			DefaultCaseCategory:          "development",
			DefaultCaseStage:             "intake",
			DefaultAppointmentCategory:   "development",
			DefaultAppointmentDepartment: "development",
			DefaultUserDepartment:        "development",
			DefaultUserSpecialty:         "development",
			Description:                  "Development environment defaults",
		},

		Production: &MigrationConfig{
			DefaultCaseCategory:          "legal",
			DefaultCaseStage:             "intake",
			DefaultAppointmentCategory:   "consultation",
			DefaultAppointmentDepartment: "legal",
			DefaultUserDepartment:        "legal",
			DefaultUserSpecialty:         "general_practice",
			Description:                  "Production environment defaults",
		},

		Testing: &MigrationConfig{
			DefaultCaseCategory:          "test",
			DefaultCaseStage:             "intake",
			DefaultAppointmentCategory:   "test",
			DefaultAppointmentDepartment: "test",
			DefaultUserDepartment:        "test",
			DefaultUserSpecialty:         "test",
			Description:                  "Testing environment defaults",
		},

		LegalServices: &MigrationConfig{
			DefaultCaseCategory:          "legal",
			DefaultCaseStage:             "intake",
			DefaultAppointmentCategory:   "legal_consultation",
			DefaultAppointmentDepartment: "legal",
			DefaultUserDepartment:        "legal",
			DefaultUserSpecialty:         "general_practice",
			Description:                  "Legal services organization defaults",
		},

		PsychologicalServices: &MigrationConfig{
			DefaultCaseCategory:          "psychological",
			DefaultCaseStage:             "intake",
			DefaultAppointmentCategory:   "therapy_session",
			DefaultAppointmentDepartment: "psychology",
			DefaultUserDepartment:        "psychology",
			DefaultUserSpecialty:         "general_therapy",
			Description:                  "Psychological services organization defaults",
		},

		SocialServices: &MigrationConfig{
			DefaultCaseCategory:          "social",
			DefaultCaseStage:             "intake",
			DefaultAppointmentCategory:   "social_work",
			DefaultAppointmentDepartment: "social_work",
			DefaultUserDepartment:        "social_work",
			DefaultUserSpecialty:         "general_social_work",
			Description:                  "Social services organization defaults",
		},

		GeneralPractice: &MigrationConfig{
			DefaultCaseCategory:          "general",
			DefaultCaseStage:             "intake",
			DefaultAppointmentCategory:   "consultation",
			DefaultAppointmentDepartment: "general",
			DefaultUserDepartment:        "general",
			DefaultUserSpecialty:         "general_practice",
			Description:                  "General practice organization defaults",
		},
	}
}

// GetConfigByEnvironment returns the appropriate configuration based on environment
func (md *MigrationDefaults) GetConfigByEnvironment(env string) *MigrationConfig {
	switch env {
	case "development", "dev":
		return md.Development
	case "production", "prod":
		return md.Production
	case "testing", "test":
		return md.Testing
	default:
		return md.Production // Default to production for safety
	}
}

// GetConfigByOrganizationType returns the appropriate configuration based on organization type
func (md *MigrationDefaults) GetConfigByOrganizationType(orgType string) *MigrationConfig {
	switch orgType {
	case "legal", "legal_services":
		return md.LegalServices
	case "psychological", "psychology", "psychological_services":
		return md.PsychologicalServices
	case "social", "social_services", "social_work":
		return md.SocialServices
	case "general", "general_practice":
		return md.GeneralPractice
	default:
		return md.GeneralPractice // Default to general practice
	}
}

// GetCustomConfig creates a custom configuration with user-specified values
func (md *MigrationDefaults) GetCustomConfig(
	caseCategory, caseStage, appointmentCategory, appointmentDepartment, userDepartment, userSpecialty string,
) *MigrationConfig {
	return &MigrationConfig{
		DefaultCaseCategory:          caseCategory,
		DefaultCaseStage:             caseStage,
		DefaultAppointmentCategory:   appointmentCategory,
		DefaultAppointmentDepartment: appointmentDepartment,
		DefaultUserDepartment:        userDepartment,
		DefaultUserSpecialty:         userSpecialty,
		Description:                  "Custom configuration",
	}
}

// ValidateConfig validates that all required fields are set
func (mc *MigrationConfig) ValidateConfig() error {
	if mc.DefaultCaseCategory == "" {
		return &ConfigError{Field: "DefaultCaseCategory", Message: "Case category cannot be empty"}
	}
	if mc.DefaultCaseStage == "" {
		return &ConfigError{Field: "DefaultCaseStage", Message: "Case stage cannot be empty"}
	}
	if mc.DefaultAppointmentCategory == "" {
		return &ConfigError{Field: "DefaultAppointmentCategory", Message: "Appointment category cannot be empty"}
	}
	if mc.DefaultAppointmentDepartment == "" {
		return &ConfigError{Field: "DefaultAppointmentDepartment", Message: "Appointment department cannot be empty"}
	}
	if mc.DefaultUserDepartment == "" {
		return &ConfigError{Field: "DefaultUserDepartment", Message: "User department cannot be empty"}
	}
	if mc.DefaultUserSpecialty == "" {
		return &ConfigError{Field: "DefaultUserSpecialty", Message: "User specialty cannot be empty"}
	}
	return nil
}

// ConfigError represents a configuration validation error
type ConfigError struct {
	Field   string
	Message string
}

func (ce *ConfigError) Error() string {
	return ce.Message
}

// PrintConfig prints the current configuration to stdout (useful for debugging)
func (mc *MigrationConfig) PrintConfig() {
	println("=== Migration Configuration ===")
	println("Description:", mc.Description)
	println("Case Category:", mc.DefaultCaseCategory)
	println("Case Stage:", mc.DefaultCaseStage)
	println("Appointment Category:", mc.DefaultAppointmentCategory)
	println("Appointment Department:", mc.DefaultAppointmentDepartment)
	println("User Department:", mc.DefaultUserDepartment)
	println("User Specialty:", mc.DefaultUserSpecialty)
	println("================================")
}
