package db

import (
	"fmt"
	"testing"

	"github.com/BryanPMX/CAF/api/config"
	"github.com/BryanPMX/CAF/api/models"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func bootstrapDatabase(t *testing.T) *gorm.DB {
	t.Helper()
	database, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", t.Name())), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, _ := database.DB()
	t.Cleanup(func() { sqlDB.Close() })
	if err := database.AutoMigrate(&models.Office{}, &models.User{}); err != nil {
		t.Fatal(err)
	}
	return database
}

func TestBootstrapCreatesSupportOnceWithoutOverwritingAccounts(t *testing.T) {
	database := bootstrapDatabase(t)
	password := "Synthetic-Bootstrap-Password123!"
	created, err := BootstrapAdmin(database, "Support@Example.test", password)
	if err != nil || !created {
		t.Fatalf("bootstrap: %v %v", created, err)
	}
	var support models.User
	database.First(&support)
	if support.Role != config.RoleTechnicalSupport || support.OfficeID != nil || support.Email != "support@example.test" || bcrypt.CompareHashAndPassword([]byte(support.Password), []byte(password)) != nil {
		t.Fatal("invalid bootstrap account")
	}
	created, err = BootstrapAdmin(database, "another@example.test", "Synthetic-Other-Password456!")
	if err != nil || created {
		t.Fatalf("repeat bootstrap: %v %v", created, err)
	}
	var unchanged models.User
	database.First(&unchanged)
	if unchanged.Email != support.Email || unchanged.Password != support.Password {
		t.Fatal("bootstrap overwrote credentials")
	}
	// Even a disabled/deleted support account must never cause replacement grants.
	database.Delete(&support)
	created, err = BootstrapAdmin(database, "another@example.test", password)
	if err != nil || created {
		t.Fatalf("deleted support duplicated: %v %v", created, err)
	}
}

func TestBootstrapRejectsExistingEmailAndInsecureCredentials(t *testing.T) {
	database := bootstrapDatabase(t)
	database.Create(&models.User{Email: "existing@example.test", FirstName: "Existing", LastName: "CEO", Role: config.RoleExecutiveDirector, Password: "preserved", IsActive: true})
	for _, tc := range []struct{ email, password string }{
		{"existing@example.test", "Synthetic-Bootstrap-Password123!"},
		{"support@example.test", "weak"}, {"support@example.test", ""}, {"invalid address", "Synthetic-Bootstrap-Password123!"},
	} {
		if created, err := BootstrapAdmin(database, tc.email, tc.password); err == nil || created {
			t.Fatalf("invalid bootstrap accepted: %s", tc.email)
		}
	}
	if created, err := BootstrapAdmin(database, "", ""); err != nil || created {
		t.Fatal("empty bootstrap should do nothing")
	}
}
