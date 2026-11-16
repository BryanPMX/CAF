package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/BryanPMX/CAF/api/config"
	"github.com/BryanPMX/CAF/api/middleware"
	"github.com/BryanPMX/CAF/api/models"
	"github.com/BryanPMX/CAF/api/repositories"
	"github.com/BryanPMX/CAF/api/security"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const authorizationTestSecret = "authorization-test-secret-at-least-32-characters"

type authorizationFixture struct {
	db                                      *gorm.DB
	router                                  *gin.Engine
	director, admin, otherAdmin, unassigned models.User
}

func authorizationSetup(t *testing.T) authorizationFixture {
	t.Helper()
	gin.SetMode(gin.TestMode)
	db := authorizationDatabase(t)
	a, b := uint(1), uint(2)
	for _, office := range []models.Office{{ID: a, Name: "Office A"}, {ID: b, Name: "Office B"}} {
		if err := db.Create(&office).Error; err != nil {
			t.Fatal(err)
		}
	}
	f := authorizationFixture{db: db,
		director:   models.User{ID: 1, FirstName: "CEO", LastName: "CAF", Email: "ceo@example.test", Role: config.RoleExecutiveDirector, IsActive: true},
		admin:      models.User{ID: 2, FirstName: "Admin A", LastName: "CAF", Email: "a@example.test", Role: config.RoleAdmin, OfficeID: &a, IsActive: true},
		otherAdmin: models.User{ID: 3, FirstName: "Admin B", LastName: "CAF", Email: "b@example.test", Role: config.RoleAdmin, OfficeID: &b, IsActive: true},
		unassigned: models.User{ID: 4, FirstName: "Unassigned", LastName: "CAF", Email: "none@example.test", Role: config.RoleAdmin, IsActive: true},
	}
	for _, user := range []models.User{f.director, f.admin, f.otherAdmin, f.unassigned} {
		if err := db.Create(&user).Error; err != nil {
			t.Fatal(err)
		}
	}
	now := time.Now().UTC()
	for _, officeID := range []uint{a, b} {
		staffID := officeID + 1
		for _, archived := range []bool{false, true} {
			caseRecord := models.Case{OfficeID: officeID, Title: fmt.Sprintf("Case %d", officeID), Category: "Legal", IsArchived: archived, CreatedAt: now}
			if err := db.Create(&caseRecord).Error; err != nil {
				t.Fatal(err)
			}
			appointment := models.Appointment{CaseID: caseRecord.ID, StaffID: staffID, OfficeID: officeID, Title: "Appointment", StartTime: now.Add(time.Hour), EndTime: now.Add(2 * time.Hour)}
			if archived {
				appointment.DeletedAt = gorm.DeletedAt{Time: now, Valid: true}
			}
			if err := db.Create(&appointment).Error; err != nil {
				t.Fatal(err)
			}
		}
		meeting := models.CalendarEvent{OrganizerID: staffID, Title: fmt.Sprintf("Meeting %d", officeID), StartTime: now.Add(time.Hour), EndTime: now.Add(2 * time.Hour)}
		if err := db.Create(&meeting).Error; err != nil {
			t.Fatal(err)
		}
	}
	r := gin.New()
	r.Use(cors.New(cors.Config{AllowOrigins: []string{"http://127.0.0.1:3100"}, AllowMethods: []string{"GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"}, AllowHeaders: []string{"Authorization", "Content-Type", "X-API-Version"}}))
	r.POST("/api/v1/login", EnhancedLogin(db, authorizationTestSecret))
	base := r.Group("/api/v1", middleware.EnhancedJWTAuth(authorizationTestSecret), middleware.DataAccessControl(db))
	base.GET("/dashboard-summary", GetDashboardSummary(db))
	base.GET("/profile", func(c *gin.Context) {
		value, _ := c.Get("currentUser")
		user := value.(models.User)
		c.JSON(200, gin.H{"userID": user.ID, "role": user.Role, "firstName": user.FirstName, "lastName": user.LastName, "officeId": user.OfficeID, "office": user.Office})
	})
	base.GET("/notifications", GetNotifications(db))
	base.GET("/offices", GetOffices(repositories.NewOfficeRepository(db)))
	base.GET("/appointments", GetAppointmentsEnhanced(db))
	base.POST("/appointments", CreateAppointmentEnhanced(db))
	base.GET("/tasks/my", GetMyTasks(db))
	base.GET("/calendar/events", GetCalendarEvents(db))
	base.POST("/calendar/events", CreateCalendarEvent(db))
	base.PATCH("/calendar/events/:id", UpdateCalendarEvent(db))
	base.DELETE("/calendar/events/:id", DeleteCalendarEvent(db))
	base.GET("/calendar/staff", GetCalendarStaff(db))
	base.GET("/cases/:id", middleware.CaseAccessControl(db), GetCaseByIDEnhanced(db))
	base.GET("/appointments/:id", middleware.AppointmentAccessControl(db), GetAppointmentByIDEnhanced(db))
	admin := r.Group("/api/v1/admin", middleware.EnhancedJWTAuth(authorizationTestSecret), middleware.RoleAuth(db, config.RoleAdmin), middleware.DataAccessControl(db), middleware.AdminOfficeAccess(db))
	admin.GET("/cases", GetCasesEnhanced(db))
	admin.GET("/cases/:id", GetCaseByIDEnhanced(db))
	admin.PUT("/cases/:id", UpdateCase(db))
	admin.GET("/appointments", GetAppointmentsEnhanced(db))
	admin.POST("/appointments", CreateAppointmentSmart(db))
	admin.PATCH("/appointments/:id", UpdateAppointmentEnhanced(db))
	admin.GET("/users", GetUsers(db))
	admin.POST("/users", CreateUser(db))
	admin.PATCH("/users/:id", UpdateUser(db))
	admin.DELETE("/users/:id", DeleteUser(db))
	admin.GET("/users/:id", GetUserByID(db))
	admin.GET("/offices", GetOffices(repositories.NewOfficeRepository(db)))
	admin.GET("/offices/:id/detail", GetOfficeDetailWithStaff(db))
	admin.GET("/records/cases", GetRecordsArchivedCases(db))
	admin.GET("/records/stats", GetRecordsArchiveStats(db))
	admin.GET("/records/appointments", GetArchivedAppointments(db))
	admin.POST("/records/cases/:id/restore", RestoreCase(db))
	admin.GET("/reports/summary-report", NewReportsHandler(db).GetSummaryReport())
	admin.GET("/reports/appointments-report", NewReportsHandler(db).GetAppointmentsReport())
	admin.GET("/reports/export", NewReportsHandler(db).ExportReport())
	admin.GET("/site-content", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"ok": true}) })
	f.router = r
	return f
}

func TestCalendarAdministrationCannotCrossOfficeBoundaries(t *testing.T) {
	f := authorizationSetup(t)
	if err := f.db.Create(&models.CalendarEventAttendee{EventID: 2, UserID: f.admin.ID, ResponseStatus: "accepted"}).Error; err != nil {
		t.Fatal(err)
	}
	w := f.request(t, f.admin, "GET", "/api/v1/calendar/events", "")
	var events struct {
		Data []models.CalendarEvent `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &events); err != nil {
		t.Fatal(err)
	}
	if len(events.Data) != 1 || events.Data[0].OrganizerID != f.admin.ID {
		t.Fatalf("cross-office invitation expanded admin scope: %s", w.Body.String())
	}
	patch := `{"title":"Updated local meeting","startTime":"2030-01-07T10:00:00Z","endTime":"2030-01-07T11:00:00Z","timeZone":"UTC"}`
	for _, tc := range []struct {
		actor              models.User
		method, path, body string
		status             int
	}{
		{f.admin, "PATCH", "/api/v1/calendar/events/2", patch, 403},
		{f.admin, "DELETE", "/api/v1/calendar/events/2", "", 403},
		{f.admin, "PATCH", "/api/v1/calendar/events/1", patch, 200},
		{f.director, "PATCH", "/api/v1/calendar/events/2", patch, 200},
		{f.admin, "POST", "/api/v1/calendar/events", `{"title":"Cross office invite","startTime":"2030-01-07T12:00:00Z","endTime":"2030-01-07T13:00:00Z","timeZone":"UTC","attendeeIds":[3]}`, 403},
	} {
		w := f.request(t, tc.actor, tc.method, tc.path, tc.body)
		if w.Code != tc.status {
			t.Errorf("%s %s: got %d want %d: %s", tc.method, tc.path, w.Code, tc.status, w.Body.String())
		}
	}
}

// TestOfficeAuthorizationPreview runs only when explicitly enabled by the E2E
// runner. It serves synthetic, in-memory fixtures on loopback and never reads
// production environment files, migrations, or credentials.
func TestOfficeAuthorizationPreview(t *testing.T) {
	if os.Getenv("CAF_RBAC_PREVIEW") != "1" {
		t.Skip("Enabled only for local role E2E checks")
	}
	f := authorizationSetup(t)
	hash, err := security.HashPassword("Synthetic-E2E-Password123!")
	if err != nil {
		t.Fatal(err)
	}
	if err := f.db.Model(&models.User{}).Where("id IN ?", []uint{1, 2, 3}).Update("password", hash).Error; err != nil {
		t.Fatal(err)
	}
	t.Log("Synthetic role preview listening on 127.0.0.1:8080")
	if err := http.ListenAndServe("127.0.0.1:8080", f.router); err != nil {
		t.Fatal(err)
	}
}

func (f authorizationFixture) request(t *testing.T, actor models.User, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	token, _, err := security.IssueJWT(authorizationTestSecret, actor.ID, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	f.router.ServeHTTP(w, req)
	return w
}

func TestManagementListsRespectOfficeScope(t *testing.T) {
	f := authorizationSetup(t)
	for _, tc := range []struct {
		path                      string
		adminCount, directorCount int
		wrapped                   bool
	}{
		{"/admin/cases", 1, 2, true}, {"/admin/appointments", 1, 2, true}, {"/admin/users", 1, 4, true},
		{"/admin/offices", 1, 2, false}, {"/admin/records/cases", 1, 2, true}, {"/admin/records/appointments", 1, 2, true},
		{"/calendar/events", 1, 2, true}, {"/calendar/staff", 1, 4, true},
	} {
		t.Run(tc.path, func(t *testing.T) {
			for _, actor := range []models.User{f.admin, f.director} {
				w := f.request(t, actor, http.MethodGet, "/api/v1"+tc.path, "")
				if w.Code != http.StatusOK {
					t.Fatalf("%s %s: %d %s", actor.Role, tc.path, w.Code, w.Body.String())
				}
				payload := json.RawMessage(w.Body.Bytes())
				if tc.wrapped {
					var envelope map[string]json.RawMessage
					if err := json.Unmarshal(payload, &envelope); err != nil {
						t.Fatal(err)
					}
					key := "data"
					if tc.path == "/admin/records/cases" {
						key = "cases"
					}
					if tc.path == "/admin/records/appointments" {
						key = "appointments"
					}
					payload = envelope[key]
				}
				var rows []json.RawMessage
				if err := json.Unmarshal(payload, &rows); err != nil {
					t.Fatalf("%s: %s", err, payload)
				}
				want := tc.adminCount
				if actor.Role == config.RoleExecutiveDirector {
					want = tc.directorCount
				}
				if len(rows) != want {
					t.Fatalf("%s %s: got %d, want %d; %s", actor.Role, tc.path, len(rows), want, w.Body.String())
				}
			}
		})
	}
}

func TestAdminCannotBypassOfficeOrWebsiteBoundaries(t *testing.T) {
	f := authorizationSetup(t)
	for _, tc := range []struct {
		method, path, body string
		status             int
	}{
		{"GET", "/admin/cases/3", "", 403}, {"GET", "/cases/3", "", 403}, {"GET", "/appointments/3", "", 403},
		{"GET", "/admin/users/3", "", 403}, {"GET", "/admin/offices/2/detail", "", 403}, {"GET", "/admin/site-content", "", 403},
		{"POST", "/admin/records/cases/4/restore", "", 403},
		{"PUT", "/admin/cases/1", `{"office_id":2}`, 400},
		{"PUT", "/admin/cases/1", `{"officeId":2}`, 400},
		{"PATCH", "/admin/appointments/1", `{"staffId":3}`, 403},
		{"POST", "/appointments", `{"caseId":1,"staffId":3,"title":"Cross office","category":"Legal","department":"Legal","startTime":"2030-01-07T10:00:00Z","endTime":"2030-01-07T11:00:00Z","timeZone":"UTC"}`, 403},
		{"POST", "/admin/users", `{"firstName":"CEO","lastName":"CAF","role":"executive_director","password":"Strong-Test-Pass123!","phone":"1234567890"}`, 403},
	} {
		w := f.request(t, f.admin, tc.method, "/api/v1"+tc.path, tc.body)
		if w.Code != tc.status {
			t.Errorf("%s %s: got %d, want %d: %s", tc.method, tc.path, w.Code, tc.status, w.Body.String())
		}
	}
	if w := f.request(t, f.director, "GET", "/api/v1/admin/site-content", ""); w.Code != 200 {
		t.Fatalf("director website: %d", w.Code)
	}
	if w := f.request(t, f.unassigned, "GET", "/api/v1/admin/cases", ""); w.Code != 403 {
		t.Fatalf("unassigned admin: %d", w.Code)
	}
	// A pre-existing token cannot retain global access after a role change.
	if err := f.db.Model(&f.director).Updates(map[string]interface{}{"role": "admin", "office_id": 1}).Error; err != nil {
		t.Fatal(err)
	}
	if w := f.request(t, f.director, "GET", "/api/v1/admin/site-content", ""); w.Code != 403 {
		t.Fatalf("stale director token: %d", w.Code)
	}
}

func TestUserMutationsStayInOfficeAndPreserveLastExecutive(t *testing.T) {
	f := authorizationSetup(t)
	body := `{"firstName":"Local","lastName":"Client","email":"local@example.test","role":"client","password":"Synthetic-E2E-Password123!","phone":"1234567890"}`
	w := f.request(t, f.admin, "POST", "/api/v1/admin/users", body)
	if w.Code != 201 {
		t.Fatalf("local client creation: %d %s", w.Code, w.Body.String())
	}
	var created models.User
	if err := json.Unmarshal(w.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	if created.OfficeID == nil || *created.OfficeID != *f.admin.OfficeID {
		t.Fatal("client was not assigned to administrator's office")
	}
	for _, tc := range []struct {
		actor      models.User
		path, body string
	}{
		{f.admin, "/api/v1/admin/users/2", `{"firstName":"Admin","lastName":"CAF","email":"a@example.test","role":"executive_director","officeId":1,"phone":"1234567890"}`},
		{f.director, "/api/v1/admin/users/1", `{"firstName":"CEO","lastName":"CAF","email":"ceo@example.test","role":"admin","officeId":1,"phone":"1234567890"}`},
		{f.admin, "/api/v1/admin/users/2", `{"firstName":"Admin","lastName":"CAF","email":"a@example.test","role":"admin","officeId":2,"phone":"1234567890"}`},
	} {
		w := f.request(t, tc.actor, "PATCH", tc.path, tc.body)
		if w.Code != 403 {
			t.Errorf("role/office mutation: %d %s", w.Code, w.Body.String())
		}
	}
}

func TestReportExportsAndArchiveStatsStayInOffice(t *testing.T) {
	f := authorizationSetup(t)
	for _, actor := range []models.User{f.admin, f.director} {
		w := f.request(t, actor, "GET", "/api/v1/admin/reports/export?reportType=cases&period=monthly", "")
		if w.Code != 200 {
			t.Fatalf("export: %d %s", w.Code, w.Body.String())
		}
		if strings.Contains(w.Body.String(), "Case 2") != (actor.Role == config.RoleExecutiveDirector) {
			t.Fatalf("incorrect export scope for %s: %s", actor.Role, w.Body.String())
		}
	}
	w := f.request(t, f.admin, "GET", "/api/v1/admin/records/stats", "")
	if w.Code != 200 {
		t.Fatalf("archive stats: %d %s", w.Code, w.Body.String())
	}
	var stats map[string]int
	if err := json.Unmarshal(w.Body.Bytes(), &stats); err != nil {
		t.Fatal(err)
	}
	if stats["totalArchived"] != 1 {
		t.Fatalf("archive count leaked: %s", w.Body.String())
	}
}

func TestDashboardAndReportFiltersCannotWidenOfficeScope(t *testing.T) {
	f := authorizationSetup(t)
	for _, tc := range []struct {
		path, field string
		want        float64
	}{
		{"/dashboard-summary?officeId=2", "totalCases", 1},
		{"/admin/reports/summary-report", "totalAppointments", 1},
	} {
		w := f.request(t, f.admin, "GET", "/api/v1"+tc.path, "")
		if w.Code != 200 {
			t.Fatalf("%s: %d %s", tc.path, w.Code, w.Body.String())
		}
		var payload map[string]interface{}
		if err := json.Unmarshal(w.Body.Bytes(), &payload); err != nil {
			t.Fatal(err)
		}
		if payload[tc.field] != tc.want {
			t.Errorf("%s %s: got %v want %v", tc.path, tc.field, payload[tc.field], tc.want)
		}
	}
	w := f.request(t, f.admin, "GET", "/api/v1/admin/reports/appointments-report?officeId=2", "")
	if w.Code != 200 {
		t.Fatalf("appointments report: %d %s", w.Code, w.Body.String())
	}
	var payload map[string]json.RawMessage
	if err := json.Unmarshal(w.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	var rows []json.RawMessage
	if err := json.Unmarshal(payload["data"], &rows); err != nil {
		t.Fatalf("%s %s", err, w.Body.String())
	}
	if len(rows) != 0 {
		t.Fatalf("cross-office filter leaked %s", w.Body.String())
	}
}

func TestSmartAppointmentsCannotClaimOtherOfficeClients(t *testing.T) {
	f := authorizationSetup(t)
	officeB := uint(2)
	for _, user := range []models.User{
		{ID: 10, Email: "unassigned-client@example.test", FirstName: "Unassigned", LastName: "Client", Role: "client", IsActive: true},
		{ID: 11, Email: "remote-client@example.test", FirstName: "Remote", LastName: "Client", Role: "client", OfficeID: &officeB, IsActive: true},
	} {
		if err := f.db.Create(&user).Error; err != nil {
			t.Fatal(err)
		}
	}
	base := `"caseId":1,"staffId":2,"title":"Scoped appointment","status":"confirmed","department":"Legal","category":"Legal","startTime":"2030-01-07T10:00:00Z","endTime":"2030-01-07T11:00:00Z","timeZone":"UTC"`
	for _, client := range []string{`"clientId":10`, `"newClient":{"email":"remote-client@example.test","firstName":"Remote","lastName":"Client"}`} {
		w := f.request(t, f.admin, "POST", "/api/v1/admin/appointments", "{"+base+","+client+"}")
		if w.Code != 403 {
			t.Errorf("client office bypass: %d %s", w.Code, w.Body.String())
		}
	}
}
