// This package centralizes application configuration.
package config

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
)

// Config holds all configuration for the application.
type Config struct {
	DatabaseURL string
	Port        string
	JWTSecret   string
}

// New creates a new Config instance populated from environment variables.
func New() (*Config, error) {
	// Load the .env file from the root of the 'api' directory.
	if err := godotenv.Load(); err != nil {
		// This is not a fatal error, as env vars can be set by the system.
		fmt.Println("Warning: Could not load .env file. Using system environment variables.")
	}

	dbUser := os.Getenv("DB_USER")
	dbPassword := os.Getenv("DB_PASSWORD")
	dbHost := os.Getenv("DB_HOST")
	dbName := os.Getenv("DB_NAME")
	dbPort := os.Getenv("DB_PORT")
	dbSSLMode := os.Getenv("DB_SSLMODE")
	
	// Default to 'require' for production, 'disable' for development
	if dbSSLMode == "" {
		if os.Getenv("NODE_ENV") == "production" {
			dbSSLMode = "require"
		} else {
			dbSSLMode = "disable"
		}
	}

	// Construct the database URL from individual parts.
	databaseURL := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=%s",
		dbUser, dbPassword, dbHost, dbPort, dbName, dbSSLMode)

	return &Config{
		DatabaseURL: databaseURL,
		Port:        os.Getenv("PORT"),
		JWTSecret:   os.Getenv("JWT_SECRET"),
	}, nil
}
