// This package centralizes application configuration.
package config

import (
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

// Config holds all configuration for the application.
type Config struct {
	DatabaseURL              string
	Port                     string
	JWTSecret                string
	RateLimitRequests        int
	RateLimitDurationMinutes int
	ContactAPISharedSecret   string
}

// New creates a new Config instance populated from environment variables.
func New() (*Config, error) {
	// Load the .env file from the root of the 'api' directory.
	if err := godotenv.Load(); err != nil {
		// This is not a fatal error, as env vars can be set by the system.
		fmt.Println("Warning: Could not load .env file. Using system environment variables.")
	}

	dbUser := strings.TrimSpace(os.Getenv("DB_USER"))
	dbPassword, err := secretEnv("DB_PASSWORD")
	if err != nil {
		return nil, err
	}
	dbHost := os.Getenv("DB_HOST")
	dbName := os.Getenv("DB_NAME")
	dbPort := os.Getenv("DB_PORT")
	dbSSLMode := os.Getenv("DB_SSLMODE")
	jwtSecret, err := secretEnv("JWT_SECRET")
	if err != nil {
		return nil, err
	}
	nodeEnv := strings.ToLower(strings.TrimSpace(os.Getenv("NODE_ENV")))
	contactAPISharedSecret, err := secretEnv("CONTACT_API_SHARED_SECRET")
	if err != nil {
		return nil, err
	}

	// Default to 'require' for production, 'disable' for development
	if dbSSLMode == "" {
		if nodeEnv == "production" {
			dbSSLMode = "require"
		} else {
			dbSSLMode = "disable"
		}
	}

	if nodeEnv == "production" {
		required := map[string]string{
			"DB_USER": dbUser, "DB_PASSWORD": dbPassword, "DB_HOST": dbHost,
			"DB_NAME": dbName, "DB_PORT": dbPort, "JWT_SECRET": jwtSecret,
		}
		for name, value := range required {
			if strings.TrimSpace(value) == "" {
				return nil, fmt.Errorf("%s is required in production", name)
			}
		}
		if len(dbPassword) < 16 || isPlaceholderSecret(dbPassword) {
			return nil, fmt.Errorf("DB_PASSWORD must be at least 16 characters and must not be a placeholder")
		}
		if len(jwtSecret) < 32 || isPlaceholderSecret(jwtSecret) {
			return nil, fmt.Errorf("JWT_SECRET must be at least 32 characters and must not be a placeholder")
		}
		if len(contactAPISharedSecret) < 32 || isPlaceholderSecret(contactAPISharedSecret) {
			return nil, fmt.Errorf("CONTACT_API_SHARED_SECRET must be at least 32 characters and must not be a placeholder")
		}
	}

	// url.UserPassword correctly escapes special characters in credentials.
	database := &url.URL{
		Scheme: "postgres",
		User:   url.UserPassword(dbUser, dbPassword),
		Host:   dbHost + ":" + dbPort,
		Path:   dbName,
	}
	query := database.Query()
	query.Set("sslmode", dbSSLMode)
	database.RawQuery = query.Encode()
	databaseURL := database.String()

	// Rate limiting configuration with sensible defaults
	rateLimitRequests := 100
	if rl := os.Getenv("RATE_LIMIT_REQUESTS"); rl != "" {
		if parsed, err := strconv.Atoi(rl); err == nil && parsed >= 20 && parsed <= 10000 {
			rateLimitRequests = parsed
		}
	}

	rateLimitDurationMinutes := 1
	if rld := os.Getenv("RATE_LIMIT_DURATION_MINUTES"); rld != "" {
		if parsed, err := strconv.Atoi(rld); err == nil && parsed >= 1 && parsed <= 60 {
			rateLimitDurationMinutes = parsed
		}
	}

	return &Config{
		DatabaseURL:              databaseURL,
		Port:                     envWithDefault("PORT", "8080"),
		JWTSecret:                jwtSecret,
		RateLimitRequests:        rateLimitRequests,
		RateLimitDurationMinutes: rateLimitDurationMinutes,
		ContactAPISharedSecret:   contactAPISharedSecret,
	}, nil
}

func isPlaceholderSecret(value string) bool {
	lower := strings.ToLower(strings.TrimSpace(value))
	for _, marker := range []string{"change", "replace", "your_", "example", "placeholder"} {
		if strings.Contains(lower, marker) {
			return true
		}
	}
	return false
}

// secretEnv supports Docker/Portainer secrets without breaking existing
// environment-based deployments. NAME and NAME_FILE are mutually exclusive.
func secretEnv(name string) (string, error) {
	direct := strings.TrimSpace(os.Getenv(name))
	filePath := strings.TrimSpace(os.Getenv(name + "_FILE"))
	if direct != "" && filePath != "" {
		return "", fmt.Errorf("set only one of %s or %s_FILE", name, name)
	}
	if filePath == "" {
		return direct, nil
	}
	contents, err := os.ReadFile(filePath)
	if err != nil {
		return "", fmt.Errorf("read %s_FILE: %w", name, err)
	}
	return strings.TrimSpace(string(contents)), nil
}

func envWithDefault(name, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(name)); value != "" {
		return value
	}
	return fallback
}
