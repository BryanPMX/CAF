package handlers

import (
	"fmt"
	"testing"

	"github.com/BryanPMX/CAF/api/models"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func authorizationDatabase(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", t.Name())), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = sqlDB.Close() })
	// The production assignment default uses PostgreSQL's now(). These tests
	// exercise authorization, while PostgreSQL migrations remain authoritative.
	if err := db.Exec(`CREATE TABLE user_case_assignments (id INTEGER PRIMARY KEY, user_id INTEGER, case_id INTEGER, role TEXT, assigned_at DATETIME, created_at DATETIME, updated_at DATETIME, deleted_at DATETIME)`).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&models.Office{}, &models.User{}, &models.Organization{}, &models.OrganizationClient{}, &models.CalendarEventClient{}, &models.Case{}, &models.Appointment{}, &models.Task{}, &models.TaskComment{}, &models.CaseEvent{}, &models.CalendarEvent{}, &models.CalendarEventAttendee{}, &models.ContactSubmission{}, &models.Notification{}); err != nil {
		t.Fatal(err)
	}
	return db
}
