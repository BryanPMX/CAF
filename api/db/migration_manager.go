package db

import (
	"crypto/sha256"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"gorm.io/gorm"
)

// Migration represents a database migration
type Migration struct {
	Version     string `gorm:"primaryKey"`
	Description string
	AppliedAt   int64
	Checksum    string
}

// MigrationFile represents a migration file
type MigrationFile struct {
	Version     string
	Description string
	Path        string
	Content     string
	Checksum    string
}

// MigrationManager handles database migrations
type MigrationManager struct {
	db *gorm.DB
}

// NewMigrationManager creates a new migration manager
func NewMigrationManager(db *gorm.DB) *MigrationManager {
	return &MigrationManager{db: db}
}

// RunMigrations runs all pending migrations
func (mm *MigrationManager) RunMigrations() error {
	log.Println("INFO: Starting database migrations...")

	// Ensure migrations table exists
	if err := mm.ensureMigrationsTable(); err != nil {
		return fmt.Errorf("failed to ensure migrations table: %v", err)
	}

	// Get all migration files
	migrationFiles, err := mm.getMigrationFiles()
	if err != nil {
		return fmt.Errorf("failed to get migration files: %v", err)
	}

	// Get applied migrations
	appliedMigrations, err := mm.getAppliedMigrations()
	if err != nil {
		return fmt.Errorf("failed to get applied migrations: %v", err)
	}

	// Find pending migrations
	pendingMigrations := mm.findPendingMigrations(migrationFiles, appliedMigrations)

	if len(pendingMigrations) == 0 {
		log.Println("INFO: No pending migrations found")
		return nil
	}

	log.Printf("INFO: Found %d pending migrations", len(pendingMigrations))

	// Run pending migrations
	for _, migration := range pendingMigrations {
		if err := mm.runMigration(migration); err != nil {
			return fmt.Errorf("failed to run migration %s: %v", migration.Version, err)
		}
	}

	log.Println("INFO: All migrations completed successfully")
	return nil
}

// ensureMigrationsTable ensures the migrations table exists
func (mm *MigrationManager) ensureMigrationsTable() error {
	return mm.db.AutoMigrate(&Migration{})
}

// getMigrationFiles reads all migration files from the migrations directory
func (mm *MigrationManager) getMigrationFiles() ([]MigrationFile, error) {
	migrationsDir := "db/migrations"
	
	// Check if migrations directory exists
	if _, err := os.Stat(migrationsDir); os.IsNotExist(err) {
		log.Printf("WARN: Migrations directory %s does not exist, skipping migrations", migrationsDir)
		return []MigrationFile{}, nil
	}

	files, err := os.ReadDir(migrationsDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read migrations directory: %v", err)
	}

	var migrationFiles []MigrationFile

	for _, file := range files {
		if file.IsDir() || !strings.HasSuffix(file.Name(), ".sql") {
			continue
		}

		// Parse version from filename (e.g., "001_initial_schema.sql" -> "001")
		parts := strings.Split(file.Name(), "_")
		if len(parts) < 2 {
			log.Printf("WARN: Skipping migration file with invalid name: %s", file.Name())
			continue
		}

		version := parts[0]
		description := strings.TrimSuffix(strings.Join(parts[1:], "_"), ".sql")

		// Read file content
		filePath := filepath.Join(migrationsDir, file.Name())
		content, err := os.ReadFile(filePath)
		if err != nil {
			return nil, fmt.Errorf("failed to read migration file %s: %v", filePath, err)
		}

		// Calculate checksum
		checksum := mm.calculateChecksum(content)

		migrationFiles = append(migrationFiles, MigrationFile{
			Version:     version,
			Description: description,
			Path:        filePath,
			Content:     string(content),
			Checksum:    checksum,
		})
	}

	// Sort migrations by version
	sort.Slice(migrationFiles, func(i, j int) bool {
		return migrationFiles[i].Version < migrationFiles[j].Version
	})

	return migrationFiles, nil
}

// getAppliedMigrations gets all applied migrations from the database
func (mm *MigrationManager) getAppliedMigrations() ([]Migration, error) {
	var migrations []Migration
	err := mm.db.Find(&migrations).Error
	return migrations, err
}

// findPendingMigrations finds migrations that haven't been applied yet
func (mm *MigrationManager) findPendingMigrations(files []MigrationFile, applied []Migration) []MigrationFile {
	appliedMap := make(map[string]bool)
	for _, migration := range applied {
		appliedMap[migration.Version] = true
	}

	var pending []MigrationFile
	for _, file := range files {
		if !appliedMap[file.Version] {
			pending = append(pending, file)
		}
	}

	return pending
}

// runMigration runs a single migration
func (mm *MigrationManager) runMigration(migration MigrationFile) error {
	log.Printf("INFO: Running migration %s: %s", migration.Version, migration.Description)

	// Start transaction
	tx := mm.db.Begin()
	if tx.Error != nil {
		return fmt.Errorf("failed to begin transaction: %v", tx.Error)
	}

	// Execute migration SQL
	if err := tx.Exec(migration.Content).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to execute migration SQL: %v", err)
	}

	// Record migration in database
	migrationRecord := Migration{
		Version:     migration.Version,
		Description: migration.Description,
		AppliedAt:   time.Now().Unix(),
		Checksum:    migration.Checksum,
	}

	if err := tx.Create(&migrationRecord).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to record migration: %v", err)
	}

	// Commit transaction
	if err := tx.Commit().Error; err != nil {
		return fmt.Errorf("failed to commit migration: %v", err)
	}

	log.Printf("INFO: Successfully applied migration %s", migration.Version)
	return nil
}

// calculateChecksum calculates SHA256 checksum of migration content
func (mm *MigrationManager) calculateChecksum(content []byte) string {
	hash := sha256.New()
	hash.Write(content)
	return fmt.Sprintf("%x", hash.Sum(nil))
}

// GetMigrationStatus returns the status of all migrations
func (mm *MigrationManager) GetMigrationStatus() ([]map[string]interface{}, error) {
	files, err := mm.getMigrationFiles()
	if err != nil {
		return nil, err
	}

	applied, err := mm.getAppliedMigrations()
	if err != nil {
		return nil, err
	}

	appliedMap := make(map[string]Migration)
	for _, migration := range applied {
		appliedMap[migration.Version] = migration
	}

	var status []map[string]interface{}
	for _, file := range files {
		statusItem := map[string]interface{}{
			"version":     file.Version,
			"description": file.Description,
			"status":      "pending",
		}

		if applied, exists := appliedMap[file.Version]; exists {
			statusItem["status"] = "applied"
			statusItem["applied_at"] = time.Unix(applied.AppliedAt, 0).Format(time.RFC3339)
			statusItem["checksum"] = applied.Checksum
		}

		status = append(status, statusItem)
	}

	return status, nil
}
