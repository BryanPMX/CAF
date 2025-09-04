// api/db/postgres.go (Updated)
package db

import (
	"fmt"
	"log"
	"os"
	"time"

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

	// Add retry logic for database connection
	var db *gorm.DB
	var err error
	maxRetries := 30
	retryDelay := 2 * time.Second

	for i := 0; i < maxRetries; i++ {
		log.Printf("Attempting to connect to database (attempt %d/%d)...", i+1, maxRetries)

		db, err = gorm.Open(postgres.Open(url), &gorm.Config{Logger: newLogger})
		if err == nil {
			log.Println("Database connection successful!")
			break
		}

		log.Printf("Database connection failed: %v", err)
		if i < maxRetries-1 {
			log.Printf("Retrying in %v...", retryDelay)
			time.Sleep(retryDelay)
		}
	}

	if err != nil {
		return nil, fmt.Errorf("failed to connect to database after %d attempts: %v", maxRetries, err)
	}

	log.Println("Database connection successful!")

	// Note: Auto-migration is now handled by the custom migration system in main.go
	// This prevents conflicts with views and allows proper migration ordering

	return db, nil
}
