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
		log.Println("INFO: No pending migrations found (all discovered migrations already applied)")
		return nil
	}

	pendingVersions := make([]string, 0, len(pendingMigrations))
	for _, m := range pendingMigrations {
		pendingVersions = append(pendingVersions, m.Version)
	}
	log.Printf("INFO: Found %d pending migration(s) to run: %v", len(pendingMigrations), pendingVersions)

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

// resolveMigrationsDir returns the path to db/migrations, preferring the directory
// next to the executable so migrations are found regardless of working directory.
func (mm *MigrationManager) resolveMigrationsDir() string {
	// 1. Try next to the executable (Docker: /app/main -> /app/db/migrations; local: ./main -> ./db/migrations)
	if exe, err := os.Executable(); err == nil {
		dir := filepath.Join(filepath.Dir(exe), "db", "migrations")
		if _, err := os.Stat(dir); err == nil {
			return dir
		}
	}
	// 2. Fallback: relative to current working directory
	if _, err := os.Stat("db/migrations"); err == nil {
		return "db/migrations"
	}
	return ""
}

// getMigrationFiles reads all migration files from the migrations directory.
// It looks for db/migrations relative to the executable first, then relative to current working directory.
func (mm *MigrationManager) getMigrationFiles() ([]MigrationFile, error) {
	migrationsDir := mm.resolveMigrationsDir()
	if migrationsDir == "" {
		log.Printf("WARN: Migrations directory not found (tried executable-relative and cwd-relative db/migrations), skipping migrations")
		return []MigrationFile{}, nil
	}
	log.Printf("INFO: Using migrations directory: %s", migrationsDir)

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

	// Sort migrations by version (string sort: 0001, 0038, ..., 0044, 0045, 0046, 0047, 0048, 0049)
	sort.Slice(migrationFiles, func(i, j int) bool {
		return migrationFiles[i].Version < migrationFiles[j].Version
	})

	versions := make([]string, 0, len(migrationFiles))
	for _, f := range migrationFiles {
		versions = append(versions, f.Version)
	}
	log.Printf("INFO: Discovered %d migration file(s): %v", len(migrationFiles), versions)
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
