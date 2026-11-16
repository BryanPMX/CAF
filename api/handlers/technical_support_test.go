package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/BryanPMX/CAF/api/config"
	"github.com/BryanPMX/CAF/api/models"
	"github.com/BryanPMX/CAF/api/security"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

func TestSupportAccountCannotBeGrantedDemotedOrDeleted(t *testing.T) {
	f := authorizationSetup(t)
	for _, actor := range []models.User{f.support, f.director, f.admin} {
		for _, tc := range []struct{ method, path, body string }{
			{"POST", "/api/v1/admin/users", `{"firstName":"Extra","lastName":"Support","email":"extra@example.test","role":"technical_support","password":"Synthetic-E2E-Password123!","phone":"1234567890"}`},
			{"PATCH", "/api/v1/admin/users/2", `{"firstName":"Admin","lastName":"CAF","email":"a@example.test","role":"technical_support","officeId":1,"phone":"1234567890"}`},
			{"PATCH", "/api/v1/admin/users/5", `{"firstName":"Technical","lastName":"Support","email":"support@example.test","role":"admin","officeId":1,"phone":"1234567890"}`},
			{"DELETE", "/api/v1/admin/users/5", ""},
			{"DELETE", "/api/v1/admin/users/5/permanent", ""},
		} {
			w := f.request(t, actor, tc.method, tc.path, tc.body)
			if w.Code != http.StatusForbidden {
				t.Errorf("%s %s %s: %d %s", actor.Role, tc.method, tc.path, w.Code, w.Body.String())
			}
		}
	}
	// CEO cannot change even support's ordinary contact details.
	body := `{"firstName":"Changed","lastName":"Support","email":"support@example.test","role":"technical_support","phone":"1234567890"}`
	if w := f.request(t, f.director, "PATCH", "/api/v1/admin/users/5", body); w.Code != 403 {
		t.Fatalf("CEO edited support: %d", w.Code)
	}
	if w := f.request(t, f.support, "PATCH", "/api/v1/admin/users/5", body); w.Code != 200 {
		t.Fatalf("support self edit: %d %s", w.Code, w.Body.String())
	}
	var count int64
	f.db.Unscoped().Model(&models.User{}).Where("role = ?", config.RoleTechnicalSupport).Count(&count)
	if count != 1 {
		t.Fatalf("support grants escaped protection: %d", count)
	}
}

func TestPasswordResetRequiresSupportAndInvalidatesOldSessions(t *testing.T) {
	f := authorizationSetup(t)
	initial := "Synthetic-Original-Password123!"
	replacement := "Synthetic-Replaced-Password456!"
	hash, err := security.HashPassword(initial)
	if err != nil {
		t.Fatal(err)
	}
	if err := f.db.Model(&f.otherAdmin).Update("password", hash).Error; err != nil {
		t.Fatal(err)
	}
	body := fmt.Sprintf(`{"firstName":"Admin B Updated","lastName":"CAF","email":"b@example.test","role":"admin","officeId":2,"phone":"1234567890","personalAddress":"Updated address","password":%q}`, replacement)
	for _, actor := range []models.User{f.admin, f.director} {
		w := f.request(t, actor, "PATCH", "/api/v1/admin/users/3", body)
		if w.Code != 403 {
			t.Fatalf("%s reset password: %d %s", actor.Role, w.Code, w.Body.String())
		}
	}
	invalid := strings.Replace(body, replacement, "weak", 1)
	if w := f.request(t, f.support, "PATCH", "/api/v1/admin/users/3", invalid); w.Code != 400 {
		t.Fatalf("weak password accepted: %d %s", w.Code, w.Body.String())
	}
	var before models.User
	f.db.First(&before, 3)
	if before.Password != hash || before.FirstName != f.otherAdmin.FirstName || before.TokenVersion != 0 {
		t.Fatal("rejected reset changed user")
	}
	w := f.request(t, f.support, "PATCH", "/api/v1/admin/users/3", body)
	if w.Code != 200 {
		t.Fatalf("support reset failed: %d %s", w.Code, w.Body.String())
	}
	if strings.Contains(w.Body.String(), replacement) || strings.Contains(w.Body.String(), "tokenVersion") || strings.Contains(w.Body.String(), "$2") {
		t.Fatal("credential information leaked")
	}
	var updated models.User
	f.db.First(&updated, 3)
	if updated.TokenVersion != 1 || updated.FirstName != "Admin B Updated" || bcrypt.CompareHashAndPassword([]byte(updated.Password), []byte(replacement)) != nil {
		t.Fatal("password/details were not persisted correctly")
	}
	for _, path := range []string{"/api/v1/profile", "/api/v1/admin/users"} {
		if w := f.request(t, f.otherAdmin, "GET", path, ""); w.Code != 401 {
			t.Fatalf("old token remained usable on %s: %d", path, w.Code)
		}
		if w := f.request(t, updated, "GET", path, ""); w.Code != 200 {
			t.Fatalf("new token rejected on %s: %d %s", path, w.Code, w.Body.String())
		}
	}
	for _, tc := range []struct {
		password string
		want     int
	}{{initial, 401}, {replacement, 200}} {
		req := httptest.NewRequest("POST", "/api/v1/login", strings.NewReader(fmt.Sprintf(`{"email":"b@example.test","password":%q}`, tc.password)))
		req.Header.Set("Content-Type", "application/json")
		response := httptest.NewRecorder()
		f.router.ServeHTTP(response, req)
		if response.Code != tc.want {
			t.Fatalf("login status %d, want %d", response.Code, tc.want)
		}
		if tc.want == 200 {
			var payload struct {
				Token string `json:"token"`
			}
			json.Unmarshal(response.Body.Bytes(), &payload)
			_, version, err := security.ParseSessionJWT(payload.Token, authorizationTestSecret, time.Now())
			if err != nil || version != 1 {
				t.Fatalf("new login omitted credential version: %d %v", version, err)
			}
		}
	}
	// Omitting password preserves the credential and session version.
	noPassword := strings.Replace(body, fmt.Sprintf(`,"password":%q`, replacement), "", 1)
	if w := f.request(t, f.support, "PATCH", "/api/v1/admin/users/3", noPassword); w.Code != 200 {
		t.Fatalf("ordinary edit: %d", w.Code)
	}
	var unchanged models.User
	f.db.First(&unchanged, 3)
	if unchanged.Password != updated.Password || unchanged.TokenVersion != updated.TokenVersion {
		t.Fatal("ordinary edit reset password")
	}
}

func TestPasswordResetCheckDoesNotDependOnRouteMiddleware(t *testing.T) {
	f := authorizationSetup(t)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{{Key: "id", Value: "1"}}
	c.Set("currentUser", f.director)
	c.Request = httptest.NewRequest("PATCH", "/users/1", strings.NewReader(`{"firstName":"CEO","lastName":"CAF","email":"ceo@example.test","role":"executive_director","phone":"1234567890","password":"Synthetic-Replaced-Password456!"}`))
	c.Request.Header.Set("Content-Type", "application/json")
	UpdateUser(f.db)(c)
	if w.Code != 403 {
		t.Fatalf("handler accepted CEO password reset: %d %s", w.Code, w.Body.String())
	}
}
