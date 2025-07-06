// api/db/postgres.go
// This file handles the database connection and initial migration.
package db

import (
	"log"
	"os"
	"time"

	// Import your models package
	"github.com/BryanPMX/CAF/api/models"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Init initializes the database connection and runs auto-migrations.
func Init(url string) (*gorm.DB, error) {
	// GORM's logger configuration
	newLogger := logger.New(
		log.New(os.Stdout, "\r\n", log.LstdFlags), // io writer
		logger.Config{
			SlowThreshold:             time.Second, // Slow SQL threshold
			LogLevel:                  logger.Info, // Log level
			IgnoreRecordNotFoundError: true,        // Don't log 'record not found' errors
			Colorful:                  true,        // Disable color
		},
	)

	db, err := gorm.Open(postgres.Open(url), &gorm.Config{
		Logger: newLogger,
	})

	if err != nil {
		return nil, err
	}

	log.Println("Database connection successful. Running migrations...")

	// Auto-migrate the schema for the User model.
	// GORM will create the 'users' table if it doesn't exist.
	err = db.AutoMigrate(&models.User{})
	if err != nil {
		log.Printf("Failed to auto-migrate database: %v", err)
		return nil, err
	}

	log.Println("Database migrated successfully.")
	return db, nil
}
