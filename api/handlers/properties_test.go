package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/BryanPMX/CAF/api/config"
	"github.com/BryanPMX/CAF/api/models"
	"github.com/BryanPMX/CAF/api/security"
	"github.com/BryanPMX/CAF/api/storage"
)

func propertyRecord(t *testing.T, f authorizationFixture, actor models.User, body string) models.Property {
	t.Helper()
	w := f.request(t, actor, "POST", "/api/v1/properties", body)
	if w.Code != 201 {
		t.Fatalf("create property: %d %s", w.Code, w.Body.String())
	}
	var p models.Property
	if err := json.Unmarshal(w.Body.Bytes(), &p); err != nil {
		t.Fatal(err)
	}
	return p
}
func propertyRequest(t *testing.T, f authorizationFixture, actor models.User, method, path, body string, status int) []byte {
	t.Helper()
	w := f.request(t, actor, method, path, body)
	if w.Code != status {
		t.Fatalf("%s %s: %d want %d: %s", method, path, w.Code, status, w.Body.String())
	}
	return w.Body.Bytes()
}
func TestPropertyArchiveOwnershipHistoryRegistrySearchAndOfficeIsolation(t *testing.T) {
	f := authorizationSetup(t)
	person := registryPerson(t, f, "owner@example.test", f.admin.OfficeID)
	second := registryPerson(t, f, "second@example.test", f.admin.OfficeID)
	foreign := registryPerson(t, f, "foreign@example.test", f.otherAdmin.OfficeID)
	p := propertyRecord(t, f, f.admin, fmt.Sprintf(`{"name":"Terreno de prueba","kind":"land","areaM2":33600,"developmentName":"Desarrollo de prueba","initialOwnerId":%d}`, person.ID))
	if len(p.Owners) != 1 || p.Owners[0].Status != "reported" {
		t.Fatal("initial ownership was not recorded as unverified")
	}
	path := fmt.Sprintf("/api/v1/properties/%d", p.ID)
	propertyRequest(t, f, f.otherAdmin, "GET", path, "", 404)
	propertyRequest(t, f, f.otherAdmin, "PUT", path, `{"name":"Intrusión","kind":"land"}`, 404)
	propertyRequest(t, f, person, "GET", path, "", 403)
	propertyRequest(t, f, f.unassigned, "GET", path, "", 403)
	propertyRequest(t, f, f.admin, "POST", path+"/registry", `{"realFolio":"002178269","inscription":"00777","folio":"00144","book":"01064","instrumentDate":"1978-03-05","registrationDate":"1978-07-07"}`, 200)
	propertyRequest(t, f, f.admin, "POST", path+"/registry", `{"realFolio":"002178270","source":"Otra inscripción del mismo terreno"}`, 200)
	propertyRequest(t, f, f.admin, "POST", path+"/registry", `{"registrationDate":"2026-02-31","realFolio":"bad"}`, 400)
	var result struct {
		Data  []models.Property
		Total int64
	}
	data := propertyRequest(t, f, f.admin, "GET", "/api/v1/properties?q=00777", "", 200)
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatal(err)
	}
	if result.Total != 1 {
		t.Fatal("registry identifier search failed")
	}
	data = propertyRequest(t, f, f.otherAdmin, "GET", "/api/v1/properties?q=00777", "", 200)
	json.Unmarshal(data, &result)
	if result.Total != 0 {
		t.Fatal("search leaked another office's record")
	}
	propertyRequest(t, f, f.admin, "GET", fmt.Sprintf("/api/v1/properties?clientId=%d", foreign.ID), "", 400)
	propertyRequest(t, f, f.admin, "POST", path+"/owners", fmt.Sprintf(`{"clientId":%d,"status":"current","sharePercent":80}`, person.ID), 200)
	propertyRequest(t, f, f.admin, "POST", path+"/owners", fmt.Sprintf(`{"clientId":%d,"status":"current","sharePercent":30}`, second.ID), 400)
	propertyRequest(t, f, f.admin, "POST", path+"/owners", fmt.Sprintf(`{"clientId":%d,"status":"current","sharePercent":20}`, second.ID), 200)
	propertyRequest(t, f, f.admin, "POST", path+"/owners", fmt.Sprintf(`{"clientId":%d,"status":"historical","startDate":"1978-03-05","endDate":"1990-01-01","source":"Escritura anterior"}`, person.ID), 200)
	propertyRequest(t, f, f.admin, "POST", path+"/owners", fmt.Sprintf(`{"clientId":%d,"status":"reported"}`, foreign.ID), 400)
	data = propertyRequest(t, f, f.director, "GET", path, "", 200)
	var detail models.Property
	json.Unmarshal(data, &detail)
	if len(detail.Owners) != 4 || len(detail.RegistryEntries) != 2 {
		t.Fatalf("lost history: %s", data)
	}
	if detail.RegistryEntries[1].RealFolio != "002178269" || string(*detail.RegistryEntries[1].InstrumentDate) != "1978-03-05" {
		t.Fatal("identifiers or date-only values changed")
	}
	propertyRequest(t, f, f.support, "DELETE", fmt.Sprintf("/api/v1/admin/users/%d/permanent", person.ID), "", 409)
	var count int64
	f.db.Model(&models.Case{}).Where("client_id = ?", person.ID).Count(&count)
	if count != 0 {
		t.Fatal("property archive created a legal case")
	}
}
func TestPropertyArchiveHierarchyRollbackAndInputValidation(t *testing.T) {
	f := authorizationSetup(t)
	person := registryPerson(t, f, "owner@example.test", f.otherAdmin.OfficeID)
	propertyRequest(t, f, f.admin, "POST", "/api/v1/properties", fmt.Sprintf(`{"name":"Rollback","kind":"land","initialOwnerId":%d}`, person.ID), 400)
	var count int64
	f.db.Model(&models.Property{}).Count(&count)
	if count != 0 {
		t.Fatal("invalid owner left an orphaned property")
	}
	land := propertyRecord(t, f, f.admin, `{"name":"Terreno","kind":"land"}`)
	block := propertyRecord(t, f, f.admin, fmt.Sprintf(`{"name":"Manzana","kind":"block","parentId":%d}`, land.ID))
	lot := propertyRecord(t, f, f.admin, fmt.Sprintf(`{"name":"Lote","kind":"lot","parentId":%d}`, block.ID))
	propertyRequest(t, f, f.admin, "PUT", fmt.Sprintf("/api/v1/properties/%d", land.ID), fmt.Sprintf(`{"name":"Ciclo","kind":"land","parentId":%d}`, lot.ID), 400)
	propertyRequest(t, f, f.admin, "PUT", fmt.Sprintf("/api/v1/properties/%d", block.ID), `{"name":"Cambio inválido","kind":"lot"}`, 400)
	propertyRequest(t, f, f.admin, "POST", "/api/v1/properties", fmt.Sprintf(`{"name":"Padre inválido","kind":"lot","parentId":%d}`, lot.ID), 400)
	for _, body := range []string{`{"name":"Sin tipo"}`, `{"kind":"land","name":" ","areaM2":1}`, `{"kind":"land","name":"Negativo","areaM2":-1}`, `{"kind":"land","name":"Otra oficina","officeId":2}`} {
		w := f.request(t, f.admin, "POST", "/api/v1/properties", body)
		if w.Code != 400 && w.Code != 403 {
			t.Fatalf("accepted invalid property %s: %d", body, w.Code)
		}
	}
	propertyRequest(t, f, f.admin, "GET", "/api/v1/properties?clientId=bad", "", 400)
}
func TestPropertyDocumentsRequirePropertyAccessAndNeverExposeStorageURL(t *testing.T) {
	f := authorizationSetup(t)
	p := propertyRecord(t, f, f.admin, `{"name":"Archivo documental","kind":"land"}`)
	store, err := storage.NewLocalStorage(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	storage.SetActiveStorage(store)
	t.Cleanup(func() { storage.SetActiveStorage(nil) })
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	file, _ := writer.CreateFormFile("file", "escritura.txt")
	file.Write([]byte("Documento sintético de prueba"))
	writer.Close()
	token, _, err := security.IssueSessionJWT(authorizationTestSecret, f.admin.ID, 0, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest("POST", fmt.Sprintf("/api/v1/properties/%d/documents", p.ID), &body)
	request.Header.Set("Authorization", "Bearer "+token)
	request.Header.Set("Content-Type", writer.FormDataContentType())
	w := httptest.NewRecorder()
	f.router.ServeHTTP(w, request)
	if w.Code != 201 {
		t.Fatalf("upload: %d %s", w.Code, w.Body.String())
	}
	if strings.Contains(w.Body.String(), "local://") || strings.Contains(w.Body.String(), "fileURL") {
		t.Fatal("exposed storage path")
	}
	var document models.PropertyDocument
	json.Unmarshal(w.Body.Bytes(), &document)
	path := fmt.Sprintf("/api/v1/properties/%d/documents/%d", p.ID, document.ID)
	propertyRequest(t, f, f.otherAdmin, "GET", path, "", 404)
	w = f.request(t, f.admin, "GET", path, "")
	if w.Code != 200 || !strings.Contains(w.Body.String(), "Documento sintético") || !strings.HasPrefix(w.Header().Get("Content-Disposition"), "attachment") {
		t.Fatalf("document download failed: %d", w.Code)
	}
}
func TestContractorNamesRolesAndBirthDateAreIndependent(t *testing.T) {
	f := authorizationSetup(t)
	person := registryPerson(t, f, "owner@example.test", f.admin.OfficeID)
	w := f.request(t, f.admin, "POST", "/api/v1/organizations", `{"kind":"constructora","name":"Nombre visible","legalName":"Razón social de prueba","tradeName":"Comercial de prueba"}`)
	if w.Code != 201 {
		t.Fatalf("draft company rejected: %s", w.Body.String())
	}
	var company models.Organization
	json.Unmarshal(w.Body.Bytes(), &company)
	updated := propertyRequest(t, f, f.admin, "PATCH", fmt.Sprintf("/api/v1/organizations/%d", company.ID), `{"name":"Nombre actualizado"}`, 200)
	var preserved models.Organization
	json.Unmarshal(updated, &preserved)
	if preserved.LegalName != "Razón social de prueba" || preserved.TradeName != "Comercial de prueba" {
		t.Fatal("older request erased new company identities")
	}
	path := fmt.Sprintf("/api/v1/organizations/%d/clients", company.ID)
	propertyRequest(t, f, f.admin, "POST", path, fmt.Sprintf(`{"clientId":%d,"relationshipRoles":["owner","legal_representative"],"relationshipNotes":"Confirmado por la persona"}`, person.ID), 200)
	propertyRequest(t, f, f.admin, "POST", path, fmt.Sprintf(`{"clientId":%d}`, person.ID), 200)
	var link models.OrganizationClient
	f.db.Where("organization_id = ? AND client_id = ?", company.ID, person.ID).First(&link)
	if len(link.RelationshipRoles) != 2 || link.RelationshipNotes == "" {
		t.Fatal("omitted relationship details were overwritten")
	}
	propertyRequest(t, f, f.admin, "POST", path, fmt.Sprintf(`{"clientId":%d,"relationshipRoles":["invalid"]}`, person.ID), 400)
	person.FirstName = "Persona"
	person.LastName = "Prueba"
	person.Phone = "6561234567"
	body := fmt.Sprintf(`{"firstName":"Persona","lastName":"Prueba","email":"owner@example.test","role":"client","officeId":1,"phone":"6561234567","birthDate":"1980-11-24"}`)
	propertyRequest(t, f, f.admin, "PATCH", fmt.Sprintf("/api/v1/admin/users/%d", person.ID), body, 200)
	f.db.First(&person, person.ID)
	if person.BirthDate == nil || string(*person.BirthDate) != "1980-11-24" {
		t.Fatal("birth date not saved")
	}
	propertyRequest(t, f, f.admin, "PATCH", fmt.Sprintf("/api/v1/admin/users/%d", person.ID), strings.Replace(body, "1980-11-24", "2999-01-01", 1), 400)
	lawyer := registryPerson(t, f, "lawyer-property@example.test", f.admin.OfficeID)
	lawyer.Role = config.RoleLawyer
	if err := f.db.Save(&lawyer).Error; err != nil {
		t.Fatal(err)
	}
	propertyRequest(t, f, lawyer, "GET", "/api/v1/properties", "", 403)
}

func TestPropertySearchIncludesCompanyAndVisibleOwnersWithoutLeakingTransferredClients(t *testing.T) {
	f := authorizationSetup(t)
	person := registryPerson(t, f, "search-owner@example.test", f.admin.OfficeID)
	if err := f.db.Model(&person).Updates(map[string]interface{}{"first_name": "Titular", "last_name": "Archivo"}).Error; err != nil {
		t.Fatal(err)
	}
	company := registryCreate(t, f, f.admin, "constructora", "Empresa visible", 0)
	propertyRequest(t, f, f.admin, "PATCH", fmt.Sprintf("/api/v1/organizations/%d", company.ID), `{"name":"Empresa visible","legalName":"Razón Registral","tradeName":"Marca Terrenos"}`, 200)
	p := propertyRecord(t, f, f.admin, fmt.Sprintf(`{"name":"Predio de archivo","kind":"land","initialOwnerId":%d,"organizationId":%d}`, person.ID, company.ID))
	readCount := func(actor models.User, term string) int64 {
		t.Helper()
		w := f.request(t, actor, "GET", "/api/v1/properties?q="+url.QueryEscape(term), "")
		if w.Code != 200 {
			t.Fatalf("search: %d %s", w.Code, w.Body.String())
		}
		var result struct{ Total int64 }
		if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
			t.Fatal(err)
		}
		return result.Total
	}
	for _, term := range []string{"Titular Archivo", "Empresa visible", "Razón Registral", "Marca Terrenos"} {
		if readCount(f.admin, term) != 1 || readCount(f.otherAdmin, term) != 0 {
			t.Fatalf("scope/search incorrect for %q", term)
		}
	}
	var detail models.Property
	json.Unmarshal(propertyRequest(t, f, f.admin, "GET", fmt.Sprintf("/api/v1/properties/%d", p.ID), "", 200), &detail)
	if detail.Office == nil || detail.Office.Name != "Office A" {
		t.Fatal("responsible office name missing")
	}
	if err := f.db.Model(&person).Update("office_id", *f.otherAdmin.OfficeID).Error; err != nil {
		t.Fatal(err)
	}
	if readCount(f.admin, "Titular Archivo") != 0 || readCount(f.director, "Titular Archivo") != 1 {
		t.Fatal("owner-name search leaked a transferred client")
	}
	detail = models.Property{}
	json.Unmarshal(propertyRequest(t, f, f.admin, "GET", fmt.Sprintf("/api/v1/properties/%d", p.ID), "", 200), &detail)
	if detail.Owners[0].Client != nil {
		t.Fatal("transferred client's name was not masked")
	}
}
