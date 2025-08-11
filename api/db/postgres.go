// api/db/postgres.go (Updated)
package db

import (
	"log"
	"os"
	"time"

	"github.com/BryanPMX/CAF/api/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func Init(url string) (*gorm.DB, error) {
	// ... (logger config remains the same)
	newLogger := logger.New(
		log.New(os.Stdout, "\r\n", log.LstdFlags),
		logger.Config{
			SlowThreshold:             time.Second,
			LogLevel:                  logger.Info,
			IgnoreRecordNotFoundError: true,
			Colorful:                  true,
		},
	)

	db, err := gorm.Open(postgres.Open(url), &gorm.Config{Logger: newLogger})
	if err != nil {
		return nil, err
	}

	log.Println("Database connection successful. Running migrations...")

	// UPDATED: Add the new CaseEvent model to the migration.
	err = db.AutoMigrate(
		&models.User{},
		&models.Office{},
		&models.Case{},
		&models.Appointment{},
		&models.Task{},
		&models.TaskComment{},
		&models.CaseEvent{}, // New model
	)
	if err != nil {
		log.Printf("Failed to auto-migrate database: %v", err)
		return nil, err
	}

	log.Println("Database migrated successfully.")
	return db, nil
}
