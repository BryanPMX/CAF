package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/BryanPMX/CAF/api/config"
	"github.com/BryanPMX/CAF/api/models"
	"github.com/BryanPMX/CAF/api/security"
)

func TestOwnProfileContractForEveryRole(t *testing.T) {
	f := authorizationSetup(t)
	createdAt := time.Date(2025, 3, 4, 12, 0, 0, 0, time.UTC)
	lastLogin := createdAt.Add(24 * time.Hour)
	department, specialty, address, customerID, avatar := "Legal", "Family law", "Private address", "private-customer", "local://avatars/test.png"
	officeID := uint(1)
	for i, role := range config.VALID_ROLES {
		actor := models.User{ID: uint(20 + i), FirstName: "Profile", LastName: "Test", Email: fmt.Sprintf("profile-%d@example.test", i), Password: "private-hash", Role: role, OfficeID: &officeID, IsActive: true, CreatedAt: createdAt, LastLogin: &lastLogin, Department: &department, Specialty: &specialty, PersonalAddress: &address, StripeCustomerID: &customerID, AvatarURL: &avatar, Phone: "6561234567"}
		if err := f.db.Create(&actor).Error; err != nil {
			t.Fatal(err)
		}
		path := "/api/v1/profile"
		if role == "client" {
			path = "/api/v1/client/profile"
		}
		w := f.request(t, actor, "GET", path+"?userID=3", "")
		if w.Code != http.StatusOK {
			t.Fatalf("%s: %d %s", role, w.Code, w.Body.String())
		}
		if w.Header().Get("Cache-Control") != "private, no-store" {
			t.Fatal("profile may be cached publicly")
		}
		var profile ProfileResponse
		if err := json.Unmarshal(w.Body.Bytes(), &profile); err != nil {
			t.Fatal(err)
		}
		if profile.UserID != fmt.Sprint(actor.ID) || profile.Email != actor.Email || profile.Phone != actor.Phone || profile.Role != role || profile.Department == nil || *profile.Department != department || profile.Specialty == nil || *profile.Specialty != specialty || !profile.CreatedAt.Equal(createdAt) || profile.LastLogin == nil || !profile.LastLogin.Equal(lastLogin) {
			t.Fatalf("incomplete or wrong profile for %s: %s", role, w.Body.String())
		}
		if config.CanAccessAllOffices(role) {
			if profile.Office != nil || profile.OfficeID != nil {
				t.Fatalf("global role exposes legacy office: %s", w.Body.String())
			}
		} else if profile.Office == nil || profile.OfficeID == nil || profile.Office.ID != officeID {
			t.Fatalf("office missing for %s: %s", role, w.Body.String())
		}
		expectedAvatar := "/api/v1/avatar?v="
		if role == "client" {
			expectedAvatar = "/api/v1/client/avatar?v="
		}
		if !strings.HasPrefix(profile.AvatarURL, expectedAvatar) {
			t.Fatalf("wrong protected avatar: %s", profile.AvatarURL)
		}
		if profile.AvatarPolicy.MaxBytes != security.MaxImageBytes || profile.AvatarPolicy.MaxURLBytes != maxAvatarURLLen || len(profile.AvatarPolicy.AllowedMIMETypes) != 4 {
			t.Fatal("photo upload policy does not match validation")
		}
		for _, secret := range []string{"private-hash", address, customerID, "tokenVersion", "token_version", "local://"} {
			if strings.Contains(w.Body.String(), secret) {
				t.Fatalf("profile exposed private data: %s", secret)
			}
		}
		var unchanged models.User
		f.db.First(&unchanged, actor.ID)
		if unchanged.LastLogin == nil || !unchanged.LastLogin.Equal(lastLogin) {
			t.Fatal("reading profile changed last sign-in")
		}
		if role == "client" && f.request(t, actor, "GET", "/api/v1/profile", "").Code != 403 {
			t.Fatal("client escaped its route group")
		}
	}
}

func TestAvatarURLUpdateAndRemovalOnlyAffectCurrentUser(t *testing.T) {
	f := authorizationSetup(t)
	for _, value := range []string{"javascript:alert(1)", "https://", "https://example.test/\ninvalid", strings.Repeat("x", 513)} {
		body, _ := json.Marshal(map[string]string{"avatarUrl": value})
		w := f.request(t, f.admin, "PATCH", "/api/v1/profile", string(body))
		if w.Code != 400 {
			t.Fatalf("invalid photo URL accepted: %q %d", value, w.Code)
		}
	}
	for _, value := range []string{"https://example.test/avatar.png", "http://a.co", ""} {
		body, _ := json.Marshal(map[string]interface{}{"avatarUrl": value, "userID": 3, "role": "technical_support", "email": "changed@example.test"})
		w := f.request(t, f.admin, "PATCH", "/api/v1/profile", string(body))
		if w.Code != 200 {
			t.Fatalf("valid photo change failed: %d %s", w.Code, w.Body.String())
		}
		var current, other models.User
		f.db.First(&current, f.admin.ID)
		f.db.First(&other, f.otherAdmin.ID)
		if current.Role != f.admin.Role || current.Email != f.admin.Email || other.AvatarURL != nil {
			t.Fatal("photo change modified account or another user")
		}
		if value == "" {
			if current.AvatarURL != nil {
				t.Fatal("photo not cleared")
			}
		} else if current.AvatarURL == nil || *current.AvatarURL != value {
			t.Fatal("photo not persisted")
		}
	}
}
