package handlers

import (
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/BryanPMX/CAF/api/config"
	"github.com/BryanPMX/CAF/api/models"
	"github.com/gin-gonic/gin"
)

func TestOrganizationDirectoriesRequireManagementButWorkflowSelectorsRemainAvailable(t *testing.T) {
	f := authorizationSetup(t)
	factory := registryCreate(t, f, f.admin, "maquila", "Minimal factory", 0)
	company := registryCreate(t, f, f.admin, "constructora", "Private legal details", 0)
	person := registryPerson(t, f, "directory-person@example.test", f.admin.OfficeID)
	for _, role := range []string{config.RoleLawyer, config.RolePsychologist, config.RoleReceptionist, config.RoleEventCoordinator, "client"} {
		t.Run(role, func(t *testing.T) {
			actor := models.User{FirstName: "Role", LastName: role, Role: role, OfficeID: f.admin.OfficeID, Email: role + "-directory@example.test", IsActive: true}
			if err := f.db.Create(&actor).Error; err != nil {
				t.Fatal(err)
			}
			for _, org := range []models.Organization{factory, company} {
				for _, tc := range []struct{ method, path, body string }{
					{"GET", "/api/v1/organizations?kind=" + org.Kind, ""},
					{"GET", fmt.Sprintf("/api/v1/organizations/%d", org.ID), ""},
					{"POST", "/api/v1/organizations", `{"kind":"maquila","name":"Denied"}`},
					{"PATCH", fmt.Sprintf("/api/v1/organizations/%d", org.ID), `{"name":"Denied"}`},
					{"POST", fmt.Sprintf("/api/v1/organizations/%d/clients", org.ID), fmt.Sprintf(`{"clientId":%d}`, person.ID)},
					{"DELETE", fmt.Sprintf("/api/v1/organizations/%d/clients/%d", org.ID, person.ID), ""},
				} {
					if w := f.request(t, actor, tc.method, tc.path, tc.body); w.Code != 403 {
						t.Fatalf("%s %s: %d %s", tc.method, tc.path, w.Code, w.Body.String())
					}
				}
			}
			w := f.request(t, actor, "GET", "/api/v1/maquila-options", "")
			if role == "client" {
				if w.Code != 403 {
					t.Fatal("client gained workflow selector access")
				}
				return
			}
			var options struct {
				Data []map[string]interface{} `json:"data"`
			}
			if err := json.Unmarshal(w.Body.Bytes(), &options); err != nil {
				t.Fatal(err)
			}
			if w.Code != 200 || len(options.Data) != 1 || len(options.Data[0]) != 2 || options.Data[0]["name"] != factory.Name {
				t.Fatalf("nonminimal factory options: %s", w.Body.String())
			}
			if w := f.request(t, actor, "GET", "/api/v1/client-options?clientType=organization", ""); w.Code != 200 || !strings.Contains(w.Body.String(), company.Name) || strings.Contains(w.Body.String(), "legalRepresentative") {
				t.Fatalf("company workflow selector failed: %s", w.Body.String())
			}
		})
	}
	for _, actor := range []models.User{f.admin, f.otherAdmin, f.director, f.support} {
		for _, kind := range []string{"maquila", "constructora"} {
			if w := f.request(t, actor, "GET", "/api/v1/organizations?kind="+kind, ""); w.Code != 200 {
				t.Fatalf("management cannot access %s: %d", kind, w.Code)
			}
		}
	}
}

func TestSharedContractorPreservesIdentityAndOfficeServiceBoundaries(t *testing.T) {
	f := authorizationSetup(t)
	company := registryCreate(t, f, f.admin, "constructora", "Shared contractor", 0)
	var account models.User
	if err := f.db.First(&account, *company.AccountClientID).Error; err != nil {
		t.Fatal(err)
	}
	if company.OfficeID != nil || account.OfficeID != nil {
		t.Fatal("shared company retained office ownership")
	}
	people := []models.User{registryPerson(t, f, "contact-a@example.test", f.admin.OfficeID), registryPerson(t, f, "contact-b@example.test", f.otherAdmin.OfficeID)}
	var appointments []models.Appointment
	for i, actor := range []models.User{f.admin, f.otherAdmin} {
		w := f.request(t, actor, "POST", fmt.Sprintf("/api/v1/organizations/%d/clients", company.ID), fmt.Sprintf(`{"clientId":%d}`, people[i].ID))
		if w.Code != 200 {
			t.Fatalf("contact link: %d %s", w.Code, w.Body.String())
		}
		body := fmt.Sprintf(`{"withoutCase":true,"clientId":%d,"officeId":%d,"staffId":%d,"title":"Company meeting","startTime":"2030-01-07T10:00:00Z","endTime":"2030-01-07T11:00:00Z","status":"confirmed","category":"General","department":"General","timeZone":"UTC"}`, account.ID, *actor.OfficeID, actor.ID)
		w = f.request(t, actor, "POST", "/api/v1/admin/appointments", body)
		if w.Code != 201 {
			t.Fatalf("same company, office %d booking: %d %s", i, w.Code, w.Body.String())
		}
		var appointment models.Appointment
		json.Unmarshal(w.Body.Bytes(), &appointment)
		appointments = append(appointments, appointment)
		if appointment.ClientID == nil || *appointment.ClientID != account.ID || appointment.OfficeID != *actor.OfficeID || appointment.CaseID != 0 {
			t.Fatal("appointment changed company identity or fabricated case")
		}
	}
	for _, actor := range []models.User{f.admin, f.otherAdmin, f.director, f.support} {
		w := f.request(t, actor, "GET", fmt.Sprintf("/api/v1/organizations/%d", company.ID), "")
		var detail struct {
			Clients     []organizationClientRow `json:"clients"`
			ClientTotal int                     `json:"clientTotal"`
			Account     *models.User            `json:"accountClient"`
			CaseTotal   int                     `json:"caseTotal"`
		}
		json.Unmarshal(w.Body.Bytes(), &detail)
		want := 2
		if config.CanAccessAllOffices(actor.Role) {
			want = 3
		}
		if w.Code != 200 || detail.ClientTotal != want || detail.Account == nil || detail.Account.ID != account.ID || detail.CaseTotal != 0 {
			t.Fatalf("shared company detail: %s", w.Body.String())
		}
		if !config.CanAccessAllOffices(actor.Role) {
			for _, row := range detail.Clients {
				if row.Client.ID != account.ID && (row.Client.OfficeID == nil || *row.Client.OfficeID != *actor.OfficeID) {
					t.Fatal("foreign individual exposed")
				}
			}
		}
		for _, path := range []string{fmt.Sprintf("/api/v1/admin/users/%d", account.ID), "/api/v1/admin/users?q=Shared%20contractor"} {
			if w := f.request(t, actor, "GET", path, ""); w.Code != 200 || !strings.Contains(w.Body.String(), company.Name) {
				t.Fatalf("shared company absent in Usuarios: %d %s", w.Code, w.Body.String())
			}
		}
		w = f.request(t, actor, "GET", fmt.Sprintf("/api/v1/admin/appointments?clientId=%d", account.ID), "")
		var list struct {
			Data []models.Appointment `json:"data"`
		}
		json.Unmarshal(w.Body.Bytes(), &list)
		expected := 1
		if config.CanAccessAllOffices(actor.Role) {
			expected = 2
		}
		if w.Code != 200 || len(list.Data) != expected {
			t.Fatalf("company appointment scope: %d %s", w.Code, w.Body.String())
		}
	}
	for _, tc := range []struct{ method, path, body string }{
		{"POST", fmt.Sprintf("/api/v1/organizations/%d/clients", company.ID), fmt.Sprintf(`{"clientId":%d}`, people[1].ID)},
		{"DELETE", fmt.Sprintf("/api/v1/organizations/%d/clients/%d", company.ID, people[1].ID), ""},
	} {
		if w := f.request(t, f.admin, tc.method, tc.path, tc.body); w.Code != 400 {
			t.Fatalf("foreign contact mutation: %d", w.Code)
		}
	}
	if w := f.request(t, f.admin, "PATCH", fmt.Sprintf("/api/v1/admin/appointments/%d", appointments[1].ID), `{"title":"Denied"}`); w.Code != 403 {
		t.Fatal("shared identity widened appointment access")
	}
	if w := f.request(t, f.otherAdmin, "POST", "/api/v1/organizations", `{"kind":"constructora","name":" SHARED CONTRACTOR ","legalRepresentative":"R","legalAddress":"D","boardPresident":"P","neighborhood":"C"}`); w.Code != 409 {
		t.Fatalf("duplicate company accepted: %d %s", w.Code, w.Body.String())
	}
	if w := f.request(t, f.admin, "PATCH", fmt.Sprintf("/api/v1/admin/users/%d", account.ID), `{"firstName":"Updated shared contractor","lastName":"","email":"","role":"client","officeId":null,"phone":"6561234567"}`); w.Code != 200 {
		t.Fatalf("shared company edit: %d %s", w.Code, w.Body.String())
	}
	if w := f.request(t, f.admin, "PATCH", fmt.Sprintf("/api/v1/admin/users/%d", account.ID), `{"firstName":"Updated shared contractor","role":"client","officeId":1}`); w.Code != 403 {
		t.Fatal("shared company gained an office")
	}
	// Calendar relations may reference the shared identity, but do not reveal B's event.
	if w := f.request(t, f.otherAdmin, "PATCH", "/api/v1/calendar/events/2", fmt.Sprintf(`{"relatedClientIds":[%d]}`, account.ID)); w.Code != 200 {
		t.Fatalf("shared calendar relation: %s", w.Body.String())
	}
	if w := f.request(t, f.admin, "GET", "/api/v1/calendar/events", ""); w.Code != 200 || strings.Contains(w.Body.String(), "Meeting 2") {
		t.Fatal("shared company widened event visibility")
	}
}

func TestSharedCompanyNameAndOptimizedUserScope(t *testing.T) {
	f := authorizationSetup(t)
	first := registryCreate(t, f, f.admin, "constructora", "Original company", 0)
	second := registryCreate(t, f, f.otherAdmin, "constructora", "Existing company", 0)
	w := f.request(t, f.admin, "PATCH", fmt.Sprintf("/api/v1/admin/users/%d", *first.AccountClientID), `{"firstName":" existing COMPANY ","lastName":"","email":"","role":"client","officeId":null,"phone":""}`)
	if w.Code != 409 {
		t.Fatalf("duplicate user rename: %d %s", w.Code, w.Body.String())
	}
	var company models.Organization
	var account models.User
	f.db.First(&company, first.ID)
	f.db.First(&account, *first.AccountClientID)
	if company.Name != first.Name || account.FirstName != first.Name {
		t.Fatal("rejected duplicate left a partial rename")
	}
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Set("userRole", "admin")
	c.Set("officeScopeID", *f.admin.OfficeID)
	h := NewPerformanceOptimizedHandler(f.db, nil)
	var users []models.User
	if err := h.buildOptimizedUsersQuery(PaginationParams{Filters: map[string]interface{}{"office_id": "1"}}, c).Find(&users).Error; err != nil {
		t.Fatal(err)
	}
	found := map[uint]bool{}
	for _, user := range users {
		found[user.ID] = true
		if user.ID == f.otherAdmin.ID {
			t.Fatal("foreign user leaked through shared identity scope")
		}
	}
	if !found[*first.AccountClientID] || !found[*second.AccountClientID] {
		t.Fatal("optimized user list omitted shared companies")
	}
}
