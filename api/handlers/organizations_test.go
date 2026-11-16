package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/BryanPMX/CAF/api/config"
	"github.com/BryanPMX/CAF/api/models"
)

func registryCreate(t *testing.T, f authorizationFixture, actor models.User, kind, name string, office uint) models.Organization {
	t.Helper()
	body := fmt.Sprintf(`{"kind":%q,"name":%q,"officeId":%d,"legalRepresentative":"Representante","legalAddress":"Domicilio legal 123","boardPresident":"Presidente","neighborhood":"Colonia Centro"}`, kind, name, office)
	w := f.request(t, actor, "POST", "/api/v1/organizations", body)
	if w.Code != 201 {
		t.Fatalf("registry create: %d %s", w.Code, w.Body.String())
	}
	var record models.Organization
	if err := json.Unmarshal(w.Body.Bytes(), &record); err != nil {
		t.Fatal(err)
	}
	return record
}
func registryPerson(t *testing.T, f authorizationFixture, email string, office *uint) models.User {
	t.Helper()
	person := models.User{FirstName: "Persona", LastName: "Prueba", Email: email, Role: "client", ClientType: models.ClientPerson, OfficeID: office, IsActive: true}
	if err := f.db.Create(&person).Error; err != nil {
		t.Fatal(err)
	}
	return person
}

func TestFactoryEmploymentSnapshotSurvivesClientFactoryChange(t *testing.T) {
	f := authorizationSetup(t)
	first := registryCreate(t, f, f.admin, "maquila", "Fábrica Uno", 1)
	second := registryCreate(t, f, f.admin, "maquila", "Fábrica Dos", 1)
	client := registryPerson(t, f, "employee@example.test", f.admin.OfficeID)
	link := func(org models.Organization, number string) {
		t.Helper()
		w := f.request(t, f.admin, "POST", fmt.Sprintf("/api/v1/organizations/%d/clients", org.ID), fmt.Sprintf(`{"clientId":%d,"employeeNumber":%q,"shiftName":"Tercer turno","shiftStart":"22:00","shiftEnd":"06:00"}`, client.ID, number))
		if w.Code != 200 {
			t.Fatalf("link failed: %d %s", w.Code, w.Body.String())
		}
	}
	link(first, "000042")
	body := fmt.Sprintf(`{"clientId":%d,"officeId":1,"title":"Asesoría laboral","category":"Legal","description":"Expediente de fábrica"}`, client.ID)
	w := f.request(t, f.admin, "POST", "/api/v1/admin/cases", body)
	if w.Code != 201 {
		t.Fatalf("create case: %d %s", w.Code, w.Body.String())
	}
	var record models.Case
	if err := f.db.Where("client_id = ?", client.ID).First(&record).Error; err != nil {
		t.Fatal(err)
	}
	if record.MaquilaID == nil || *record.MaquilaID != first.ID || record.EmployeeNumber != "000042" || record.ShiftStart != "22:00" || record.ShiftEnd != "06:00" {
		t.Fatalf("snapshot missing: %#v", record)
	}
	link(second, "000099")
	var historical models.Case
	f.db.First(&historical, record.ID)
	if historical.MaquilaID == nil || *historical.MaquilaID != first.ID || historical.EmployeeNumber != "000042" {
		t.Fatal("current employment rewrote case history")
	}
	w = f.request(t, f.admin, "GET", fmt.Sprintf("/api/v1/organizations/%d", first.ID), "")
	var detail struct {
		Clients     []organizationClientRow `json:"clients"`
		Cases       []models.Case           `json:"cases"`
		ClientTotal int64                   `json:"clientTotal"`
	}
	if w.Code != 200 {
		t.Fatalf("factory detail: %d %s", w.Code, w.Body.String())
	}
	json.Unmarshal(w.Body.Bytes(), &detail)
	if len(detail.Cases) != 1 || len(detail.Clients) != 1 || !detail.Clients[0].Historical || detail.ClientTotal != 1 {
		t.Fatalf("historical record disappeared: %s", w.Body.String())
	}
	company := registryCreate(t, f, f.admin, "constructora", "Constructora Contactos", 1)
	if w := f.request(t, f.admin, "POST", fmt.Sprintf("/api/v1/organizations/%d/clients", company.ID), fmt.Sprintf(`{"clientId":%d}`, client.ID)); w.Code != 200 {
		t.Fatalf("contact link: %d %s", w.Code, w.Body.String())
	}
	var memberships []models.OrganizationClient
	f.db.Where("client_id = ?", client.ID).Find(&memberships)
	if len(memberships) != 2 {
		t.Fatalf("contractor contact removed employment: %#v", memberships)
	}
}

func TestContractorsHaveCanonicalClientAccountsAndDirectAppointments(t *testing.T) {
	f := authorizationSetup(t)
	first := registryCreate(t, f, f.admin, "constructora", "Constructora Uno", 1)
	second := registryCreate(t, f, f.admin, "constructora", "Constructora Dos", 1)
	if first.AccountClientID == nil || second.AccountClientID == nil || *first.AccountClientID == *second.AccountClientID {
		t.Fatal("companies lack distinct client accounts")
	}
	var client models.User
	f.db.First(&client, *first.AccountClientID)
	if client.Role != "client" || client.ClientType != models.ClientOrganization || client.FirstName != first.Name || client.LastName != "" || client.Email != "" {
		t.Fatalf("company misrepresented as a person: %#v", client)
	}
	var before int64
	f.db.Model(&models.Case{}).Count(&before)
	body := fmt.Sprintf(`{"withoutCase":true,"clientId":%d,"officeId":1,"staffId":2,"title":"Reunión con constructora","startTime":"2030-01-07T10:00:00Z","endTime":"2030-01-07T11:00:00Z","status":"confirmed","category":"General","department":"General","timeZone":"UTC"}`, client.ID)
	w := f.request(t, f.admin, "POST", "/api/v1/admin/appointments", body)
	if w.Code != 201 {
		t.Fatalf("direct appointment: %d %s", w.Code, w.Body.String())
	}
	var appointment models.Appointment
	json.Unmarshal(w.Body.Bytes(), &appointment)
	if appointment.CaseID != 0 || appointment.ClientID == nil || *appointment.ClientID != client.ID {
		t.Fatalf("appointment not related to company: %s", w.Body.String())
	}
	var nullCases, after int64
	f.db.Model(&models.Appointment{}).Where("id = ? AND case_id IS NULL", appointment.ID).Count(&nullCases)
	f.db.Model(&models.Case{}).Count(&after)
	if nullCases != 1 || after != before {
		t.Fatal("direct appointment fabricated a case or saved a zero foreign key")
	}
	if w := f.request(t, f.admin, "POST", "/api/v1/admin/appointments", body); w.Code != 400 {
		t.Fatalf("overlapping appointment accepted: %d %s", w.Code, w.Body.String())
	}
	w = f.request(t, f.admin, "GET", fmt.Sprintf("/api/v1/admin/appointments?clientId=%d", client.ID), "")
	if w.Code != 200 {
		t.Fatalf("appointment list: %d %s", w.Code, w.Body.String())
	}
	var listed struct {
		Data []models.Appointment `json:"data"`
	}
	json.Unmarshal(w.Body.Bytes(), &listed)
	if len(listed.Data) != 1 || listed.Data[0].Client == nil || listed.Data[0].Client.FirstName != first.Name {
		t.Fatalf("company missing from appointments: %s", w.Body.String())
	}
	for _, path := range []string{fmt.Sprintf("/api/v1/admin/users/%d", client.ID), fmt.Sprintf("/api/v1/admin/users/%d/permanent", client.ID)} {
		if w := f.request(t, f.admin, "DELETE", path, ""); w.Code != 403 {
			t.Fatalf("company account detached: %d", w.Code)
		}
	}
	w = f.request(t, f.admin, "POST", "/api/v1/admin/cases", fmt.Sprintf(`{"clientId":%d,"officeId":1,"title":"Invalid company case","category":"Legal"}`, client.ID))
	if w.Code == 201 {
		t.Fatal("company can be used as a fabricated case client")
	}
	update := fmt.Sprintf(`{"firstName":"Nuevo nombre","lastName":"","email":"","role":"client","officeId":1,"phone":""}`)
	if w := f.request(t, f.admin, "PATCH", fmt.Sprintf("/api/v1/admin/users/%d", client.ID), update); w.Code != 200 {
		t.Fatalf("company user edit: %d %s", w.Code, w.Body.String())
	}
	f.db.First(&first, first.ID)
	if first.Name != "Nuevo nombre" {
		t.Fatal("user edit did not synchronize contractor name")
	}
}

func TestOrganizationScopeAndValidation(t *testing.T) {
	f := authorizationSetup(t)
	own := registryCreate(t, f, f.admin, "maquila", "Local", 1)
	other := registryCreate(t, f, f.otherAdmin, "maquila", "Otra oficina", 2)
	client := registryPerson(t, f, "scope@example.test", f.admin.OfficeID)
	outside := registryPerson(t, f, "other-scope@example.test", f.otherAdmin.OfficeID)
	for _, tc := range []struct {
		method, path, body string
		want               int
	}{
		{"GET", fmt.Sprintf("/api/v1/organizations/%d", other.ID), "", 404},
		{"POST", "/api/v1/organizations", `{"kind":"maquila","name":"Escape","officeId":2}`, 403},
		{"POST", fmt.Sprintf("/api/v1/organizations/%d/clients", own.ID), fmt.Sprintf(`{"clientId":%d,"employeeNumber":"123","shiftName":"Primero"}`, outside.ID), 400},
		{"POST", fmt.Sprintf("/api/v1/organizations/%d/clients", own.ID), fmt.Sprintf(`{"clientId":%d,"employeeNumber":"123","shiftName":"Primero","shiftStart":"08:00"}`, client.ID), 400},
		{"POST", "/api/v1/organizations", `{"kind":"constructora","name":"Incomplete","officeId":1}`, 400},
		{"POST", "/api/v1/admin/users", fmt.Sprintf(`{"firstName":"Employee","lastName":"Test","email":"invalid-employment@example.test","role":"client","phone":"6561234567","password":"Synthetic-E2E-Password123!","officeId":1,"employment":{"maquilaId":%d,"employeeNumber":"0001","shiftName":"Primero"}}`, other.ID), 400},
	} {
		w := f.request(t, f.admin, tc.method, tc.path, tc.body)
		if w.Code != tc.want {
			t.Errorf("%s %s: %d want %d: %s", tc.method, tc.path, w.Code, tc.want, w.Body.String())
		}
	}
	var count int64
	f.db.Model(&models.User{}).Where("email = ?", "invalid-employment@example.test").Count(&count)
	if count != 0 {
		t.Fatal("invalid membership left a partial user")
	}
	if w := f.request(t, f.director, "GET", fmt.Sprintf("/api/v1/organizations/%d", other.ID), ""); w.Code != 200 {
		t.Fatalf("executive global read: %d %s", w.Code, w.Body.String())
	}
	employee := models.User{ID: 40, FirstName: "Staff", LastName: "Local", Email: "staff-directory@example.test", Role: config.RoleLawyer, OfficeID: f.admin.OfficeID, IsActive: true}
	f.db.Create(&employee)
	if w := f.request(t, employee, "POST", "/api/v1/organizations", `{"kind":"maquila","name":"Denied","officeId":1}`); w.Code != 403 {
		t.Fatal("staff can mutate directory")
	}
	if w := f.request(t, employee, "GET", "/api/v1/organizations?kind=maquila", ""); w.Code != http.StatusOK {
		t.Fatalf("staff cannot read own directory: %d", w.Code)
	}
}

func TestCalendarClientLinksDoNotInviteClientsOrExposeOtherOffices(t *testing.T) {
	f := authorizationSetup(t)
	a := registryCreate(t, f, f.admin, "constructora", "Calendario A", 1)
	b := registryCreate(t, f, f.otherAdmin, "constructora", "Calendario B", 2)
	payload := fmt.Sprintf(`{"relatedClientIds":[%d,%d]}`, *a.AccountClientID, *b.AccountClientID)
	if w := f.request(t, f.director, "PATCH", "/api/v1/calendar/events/1", payload); w.Code != 200 {
		t.Fatalf("global calendar links: %d %s", w.Code, w.Body.String())
	}
	w := f.request(t, f.admin, "GET", "/api/v1/calendar/events", "")
	var events struct {
		Data []models.CalendarEvent `json:"data"`
	}
	json.Unmarshal(w.Body.Bytes(), &events)
	if w.Code != 200 || len(events.Data) != 1 || len(events.Data[0].RelatedClients) != 1 || events.Data[0].RelatedClients[0].ClientID != *a.AccountClientID {
		t.Fatalf("cross-office calendar link exposed: %s", w.Body.String())
	}
	if w := f.request(t, f.admin, "PATCH", "/api/v1/calendar/events/1", fmt.Sprintf(`{"relatedClientIds":[%d]}`, *a.AccountClientID)); w.Code != 200 {
		t.Fatalf("local edit: %d %s", w.Code, w.Body.String())
	}
	var count int64
	f.db.Model(&models.CalendarEventClient{}).Where("event_id = ?", 1).Count(&count)
	if count != 2 {
		t.Fatal("local edit removed hidden cross-office relationships")
	}
	if w := f.request(t, f.admin, "PATCH", "/api/v1/calendar/events/1", fmt.Sprintf(`{"relatedClientIds":[%d]}`, *b.AccountClientID)); w.Code != 400 {
		t.Fatalf("local actor linked foreign client: %d", w.Code)
	}
	f.db.Model(&models.CalendarEventAttendee{}).Where("user_id IN ?", []uint{*a.AccountClientID, *b.AccountClientID}).Count(&count)
	if count != 0 {
		t.Fatal("related client was treated as an employee attendee")
	}
	var corporate models.User
	f.db.First(&corporate, *a.AccountClientID)
	if w := f.request(t, corporate, "GET", "/api/v1/organizations?kind=maquila", ""); w.Code != 403 {
		t.Fatal("client gained directory access")
	}
}

func TestDirectCompanyAppointmentsCannotEscapeOfficeOnEdit(t *testing.T) {
	f := authorizationSetup(t)
	company := registryCreate(t, f, f.admin, "constructora", "Citas y alcance", 1)
	body := fmt.Sprintf(`{"withoutCase":true,"clientId":%d,"officeId":1,"staffId":2,"title":"Cita","startTime":"2030-01-07T10:00:00Z","endTime":"2030-01-07T11:00:00Z","status":"confirmed","category":"General","department":"General","timeZone":"UTC"}`, *company.AccountClientID)
	w := f.request(t, f.admin, "POST", "/api/v1/admin/appointments", body)
	if w.Code != 201 {
		t.Fatal(w.Body.String())
	}
	var appointment models.Appointment
	json.Unmarshal(w.Body.Bytes(), &appointment)
	path := fmt.Sprintf("/api/v1/admin/appointments/%d", appointment.ID)
	if w := f.request(t, f.director, "PATCH", path, `{"staffId":3}`); w.Code != 400 {
		t.Fatalf("cross-office employee assignment accepted: %d %s", w.Code, w.Body.String())
	}
	if w := f.request(t, f.otherAdmin, "PATCH", path, `{"title":"Escape"}`); w.Code != 403 {
		t.Fatalf("cross-office appointment modified: %d", w.Code)
	}
	if w := f.request(t, f.admin, "PATCH", path, `{"startTime":"2030-01-07T11:00:00Z","endTime":"2030-01-07T12:00:00Z","timeZone":"UTC"}`); w.Code != 200 {
		t.Fatalf("valid adjacent reschedule failed: %d %s", w.Code, w.Body.String())
	}
}

func TestInlineFactoryClientCreationIsAtomic(t *testing.T) {
	f := authorizationSetup(t)
	factory := registryCreate(t, f, f.admin, "maquila", "Inline factory", 1)
	for _, invalid := range []bool{false, true} {
		email := fmt.Sprintf("inline-%t@example.test", invalid)
		factoryID := factory.ID
		if invalid {
			factoryID = 99999
		}
		body := fmt.Sprintf(`{"firstName":"Inline","lastName":"Employee","email":%q,"officeId":1,"title":"Divorcios","category":"Legal","description":"Factory client","employment":{"maquilaId":%d,"employeeNumber":"000001","shiftName":"Segundo turno"}}`, email, factoryID)
		response := f.request(t, f.admin, "POST", "/api/v1/admin/cases", body)
		var person models.User
		result := f.db.Where("email = ?", email).First(&person)
		if invalid {
			if response.Code == 201 || result.Error == nil {
				t.Fatal("invalid employment left a partial client/case")
			}
			continue
		}
		if response.Code != 201 || result.Error != nil {
			t.Fatalf("inline creation failed: %d %s %v", response.Code, response.Body.String(), result.Error)
		}
		var membership models.OrganizationClient
		if err := f.db.Where("client_id = ? AND organization_id = ?", person.ID, factory.ID).First(&membership).Error; err != nil || membership.EmployeeNumber != "000001" {
			t.Fatal("inline client has no current employment")
		}
	}
}

func TestCompanyAppointmentReportsAndArchivesKeepClientName(t *testing.T) {
	f := authorizationSetup(t)
	company := registryCreate(t, f, f.admin, "constructora", "Report Company", 1)
	body := fmt.Sprintf(`{"withoutCase":true,"clientId":%d,"officeId":1,"staffId":2,"title":"Company reporting","category":"General","department":"General","startTime":"2030-01-07T10:00:00Z","endTime":"2030-01-07T11:00:00Z","timeZone":"UTC","status":"confirmed"}`, *company.AccountClientID)
	response := f.request(t, f.admin, "POST", "/api/v1/admin/appointments", body)
	if response.Code != 201 {
		t.Fatalf("booking failed: %s", response.Body.String())
	}
	var appointment models.Appointment
	json.Unmarshal(response.Body.Bytes(), &appointment)
	report := f.request(t, f.admin, "GET", "/api/v1/admin/reports/appointments-report?dateFrom=2030-01-07T00:00:00Z&dateTo=2030-01-08T00:00:00Z", "")
	if report.Code != 200 || !strings.Contains(report.Body.String(), `"clientName":"Report Company"`) {
		t.Fatalf("report lost direct client: %d %s", report.Code, report.Body.String())
	}
	f.db.Delete(&appointment)
	archive := f.request(t, f.admin, "GET", "/api/v1/admin/records/appointments", "")
	if archive.Code != 200 || !strings.Contains(archive.Body.String(), `"firstName":"Report Company"`) {
		t.Fatalf("archive lost direct client: %d %s", archive.Code, archive.Body.String())
	}
}
