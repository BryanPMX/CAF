package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/BryanPMX/CAF/api/config"
	"github.com/BryanPMX/CAF/api/models"
	"github.com/BryanPMX/CAF/api/security"
	"github.com/BryanPMX/CAF/api/services"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type organizationInput struct {
	Kind                string  `json:"kind"`
	OfficeID            uint    `json:"officeId"`
	LegalName           *string `json:"legalName"`
	TradeName           *string `json:"tradeName"`
	Name                string  `json:"name"`
	LegalRepresentative string  `json:"legalRepresentative"`
	LegalAddress        string  `json:"legalAddress"`
	BoardPresident      string  `json:"boardPresident"`
	Neighborhood        string  `json:"neighborhood"`
	Email               string  `json:"email" binding:"omitempty,email"`
	Phone               string  `json:"phone"`
}

type organizationClientRow struct {
	Client     models.User                `json:"client"`
	Membership *models.OrganizationClient `json:"membership"`
	Historical bool                       `json:"historical"`
}

func workflowClientActor(c *gin.Context) (models.User, bool) {
	value, _ := c.Get("currentUser")
	actor, ok := value.(models.User)
	if !ok || !config.IsValidRole(actor.Role) || actor.Role == "client" || (!config.CanAccessAllOffices(actor.Role) && (actor.OfficeID == nil || *actor.OfficeID == 0)) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Sin acceso a estos registros"})
		return actor, false
	}
	return actor, true
}
func organizationActor(c *gin.Context) (models.User, bool) {
	actor, ok := workflowClientActor(c)
	if !ok {
		return actor, false
	}
	if !config.CanAccessOrganizationDirectory(actor.Role) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Sin acceso a este directorio"})
		return actor, false
	}
	return actor, true
}
func loadOrganization(db *gorm.DB, c *gin.Context) (models.Organization, bool) {
	var organization models.Organization
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil || id == 0 {
		c.JSON(400, gin.H{"error": "Registro no válido"})
		return organization, false
	}
	if err := db.Preload("Office").First(&organization, uint(id)).Error; err != nil {
		c.JSON(404, gin.H{"error": "Registro no disponible"})
		return organization, false
	}
	return organization, true
}
func organizationFailure(c *gin.Context, err error) {
	if errors.Is(err, gorm.ErrDuplicatedKey) || strings.Contains(err.Error(), "duplicate key") || strings.Contains(err.Error(), "UNIQUE constraint") {
		c.JSON(409, gin.H{"error": "Ya existe un registro con ese nombre o correo"})
		return
	}
	var validation services.OrganizationValidationError
	if errors.As(err, &validation) {
		c.JSON(400, gin.H{"error": validation.Message})
		return
	}
	c.JSON(500, gin.H{"error": "No fue posible guardar el registro"})
}

func ListOrganizations(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, ok := organizationActor(c)
		if !ok {
			return
		}
		kind := c.Query("kind")
		if kind != models.OrganizationMaquila && kind != models.OrganizationContractor {
			c.JSON(400, gin.H{"error": "Tipo de directorio no válido"})
			return
		}
		query := db.Model(&models.Organization{}).Where("kind = ?", kind)
		if q := strings.TrimSpace(c.Query("q")); q != "" {
			query = query.Where("(LOWER(organizations.name) LIKE ? OR LOWER(organizations.legal_name) LIKE ? OR LOWER(organizations.trade_name) LIKE ?)", "%"+strings.ToLower(q)+"%", "%"+strings.ToLower(q)+"%", "%"+strings.ToLower(q)+"%")
		}
		if id := c.Query("id"); id != "" {
			parsed, err := strconv.ParseUint(id, 10, 32)
			if err != nil || parsed == 0 {
				c.JSON(400, gin.H{"error": "Registro no válido"})
				return
			}
			query = query.Where("organizations.id = ?", parsed)
		}
		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		if page < 1 {
			page = 1
		}
		size, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
		if size < 1 || size > 100 {
			size = 20
		}
		var total int64
		if err := query.Count(&total).Error; err != nil {
			c.JSON(500, gin.H{"error": "No se pudo cargar el directorio"})
			return
		}
		records := []models.Organization{}
		if err := query.Preload("Office").Order("organizations.name ASC").Offset((page - 1) * size).Limit(size).Find(&records).Error; err != nil {
			c.JSON(500, gin.H{"error": "No se pudo cargar el directorio"})
			return
		}
		c.JSON(200, gin.H{"data": records, "total": total})
	}
}

func SaveOrganization(db *gorm.DB, create bool) gin.HandlerFunc {
	// Corporate profiles can be edited from Usuarios or the registry. Share the
	// user-mutation lock so both paths update the canonical account consistently.
	return serializeUserMutation(db, func(session *gorm.DB) gin.HandlerFunc { return saveOrganization(session, create) })
}

func saveOrganization(db *gorm.DB, create bool) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, ok := organizationActor(c)
		if !ok {
			return
		}
		var existing models.Organization
		if !create {
			var available bool
			existing, available = loadOrganization(db, c)
			if !available {
				return
			}
		}
		var input organizationInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(400, gin.H{"error": "Datos no válidos"})
			return
		}
		input.Name = strings.TrimSpace(input.Name)
		for _, alias := range []*string{input.LegalName, input.TradeName} {
			if alias != nil {
				*alias = strings.TrimSpace(*alias)
				if utf8.RuneCountInString(*alias) > 255 {
					c.JSON(400, gin.H{"error": "Los nombres admiten hasta 255 caracteres"})
					return
				}
			}
		}
		input.LegalRepresentative = strings.TrimSpace(input.LegalRepresentative)
		input.LegalAddress = strings.TrimSpace(input.LegalAddress)
		input.BoardPresident = strings.TrimSpace(input.BoardPresident)
		input.Neighborhood = strings.TrimSpace(input.Neighborhood)
		input.Email = strings.ToLower(strings.TrimSpace(input.Email))
		input.Phone = strings.TrimSpace(input.Phone)
		if !create {
			input.Kind = existing.Kind
		}
		if input.Kind != models.OrganizationMaquila && input.Kind != models.OrganizationContractor {
			c.JSON(400, gin.H{"error": "Tipo no válido"})
			return
		}
		if input.OfficeID != 0 {
			c.JSON(400, gin.H{"error": "Los directorios se comparten entre todas las oficinas"})
			return
		}
		for _, field := range []string{input.Name, input.LegalRepresentative, input.BoardPresident, input.Neighborhood, input.Phone} {
			if utf8.RuneCountInString(field) > 255 {
				c.JSON(400, gin.H{"error": "Los campos admiten hasta 255 caracteres"})
				return
			}
		}
		if input.Name == "" || utf8.RuneCountInString(input.LegalAddress) > 1000 {
			c.JSON(400, gin.H{"error": "Nombre y domicilio no válidos"})
			return
		}

		if len(input.Email) > 255 {
			c.JSON(400, gin.H{"error": "El correo admite hasta 255 caracteres"})
			return
		}
		if len(input.Phone) > 50 {
			c.JSON(400, gin.H{"error": "El teléfono admite hasta 50 caracteres"})
			return
		}
		err := db.Transaction(func(tx *gorm.DB) error {
			if create || !strings.EqualFold(strings.TrimSpace(existing.Name), input.Name) {
				if err := services.EnsureOrganizationNameAvailable(tx, input.Kind, input.Name, existing.ID); err != nil {
					return err
				}
			}
			record := existing
			record.Kind = input.Kind
			record.OfficeID = nil
			record.Name = input.Name
			if input.LegalName != nil {
				record.LegalName = *input.LegalName
			}
			if input.TradeName != nil {
				record.TradeName = *input.TradeName
			}
			record.LegalRepresentative = input.LegalRepresentative
			record.LegalAddress = input.LegalAddress
			record.BoardPresident = input.BoardPresident
			record.Neighborhood = input.Neighborhood
			if create && input.Kind == models.OrganizationContractor {
				hash, err := security.HashRandomPassword()
				if err != nil {
					return err
				}
				client := models.User{FirstName: input.Name, LastName: "", Email: input.Email, Phone: input.Phone, Role: "client", ClientType: models.ClientOrganization, Password: hash, IsActive: true}
				if err := tx.Create(&client).Error; err != nil {
					return err
				}
				record.AccountClientID = &client.ID
			}
			if err := tx.Omit("Office").Save(&record).Error; err != nil {
				return err
			}
			if record.AccountClientID != nil {
				if !create {
					if err := tx.Model(&models.User{}).Where("id = ?", *record.AccountClientID).Updates(map[string]interface{}{"first_name": input.Name, "email": input.Email, "phone": input.Phone}).Error; err != nil {
						return err
					}
				}
				if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&models.OrganizationClient{OrganizationID: record.ID, ClientID: *record.AccountClientID}).Error; err != nil {
					return err
				}
			}
			existing = record
			return nil
		})
		if err != nil {
			organizationFailure(c, err)
			return
		}
		status := 200
		if create {
			status = 201
		}
		c.JSON(status, existing)
	}
}

func GetOrganization(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		actor, ok := organizationActor(c)
		if !ok {
			return
		}
		organization, ok := loadOrganization(db, c)
		if !ok {
			return
		}
		parsePage := func(key string) int {
			value, _ := strconv.Atoi(c.DefaultQuery(key, "1"))
			if value < 1 {
				return 1
			}
			return value
		}
		clientPage, casePage := parsePage("clientPage"), parsePage("casePage")
		const size = 20
		caseQuery := NewCaseService(db).NewCaseQueryBuilder().ApplyAccessControl(c).query.Model(&models.Case{}).Where("cases.maquila_id = ? AND cases.deleted_at IS NULL", organization.ID)
		var caseTotal int64
		cases := []models.Case{}
		if organization.Kind == models.OrganizationMaquila {
			if err := caseQuery.Session(&gorm.Session{}).Count(&caseTotal).Error; err != nil {
				c.JSON(500, gin.H{"error": "No se pudieron cargar los expedientes"})
				return
			}
			if err := caseQuery.Session(&gorm.Session{}).Order("cases.created_at DESC").Offset((casePage - 1) * size).Limit(size).Find(&cases).Error; err != nil {
				c.JSON(500, gin.H{"error": "No se pudieron cargar los expedientes"})
				return
			}
		}
		memberIDs := db.Model(&models.OrganizationClient{}).Select("client_id").Where("organization_id = ?", organization.ID)
		clientQuery := db.Model(&models.User{}).Where("role = ?", "client")
		if !config.CanAccessAllOffices(actor.Role) {
			clientQuery = services.OfficeClientUsers(clientQuery, *actor.OfficeID)
		}
		if organization.Kind == models.OrganizationMaquila {
			historical := caseQuery.Session(&gorm.Session{}).Select("cases.client_id")
			clientQuery = clientQuery.Where("(users.id IN (?) OR users.id IN (?))", memberIDs, historical)
		} else {
			clientQuery = clientQuery.Where("users.id IN (?)", memberIDs)
		}
		if q := strings.ToLower(strings.TrimSpace(c.Query("clientQ"))); q != "" {
			clientQuery = clientQuery.Where("LOWER(first_name || ' ' || last_name) LIKE ?", "%"+q+"%")
		}
		var clientTotal int64
		if err := clientQuery.Session(&gorm.Session{}).Count(&clientTotal).Error; err != nil {
			c.JSON(500, gin.H{"error": "No se pudieron cargar los clientes"})
			return
		}
		clients := []models.User{}
		if err := clientQuery.Preload("Office").Order("first_name ASC").Offset((clientPage - 1) * size).Limit(size).Find(&clients).Error; err != nil {
			c.JSON(500, gin.H{"error": "No se pudieron cargar los clientes"})
			return
		}
		ids := []uint{}
		for _, client := range clients {
			ids = append(ids, client.ID)
		}
		memberships := []models.OrganizationClient{}
		if len(ids) > 0 {
			if err := db.Where("organization_id = ? AND client_id IN ?", organization.ID, ids).Find(&memberships).Error; err != nil {
				c.JSON(500, gin.H{"error": "No se pudieron cargar las relaciones"})
				return
			}
		}
		membershipByClient := map[uint]*models.OrganizationClient{}
		for i := range memberships {
			membershipByClient[memberships[i].ClientID] = &memberships[i]
		}
		rows := []organizationClientRow{}
		for _, client := range clients {
			member := membershipByClient[client.ID]
			rows = append(rows, organizationClientRow{Client: client, Membership: member, Historical: member == nil})
		}
		var account *models.User
		if organization.AccountClientID != nil {
			var user models.User
			if err := db.Where("id = ? AND role = ? AND client_type = ? AND office_id IS NULL", *organization.AccountClientID, "client", models.ClientOrganization).First(&user).Error; err == nil {
				account = &user
			}
		}
		c.JSON(200, gin.H{"organization": organization, "clients": rows, "cases": cases, "clientTotal": clientTotal, "caseTotal": caseTotal, "accountClient": account})
	}
}

func LinkOrganizationClient(db *gorm.DB, remove bool) gin.HandlerFunc {
	return func(c *gin.Context) {
		actor, ok := organizationActor(c)
		if !ok {
			return
		}
		organization, ok := loadOrganization(db, c)
		if !ok {
			return
		}
		var input struct {
			ClientID          uint      `json:"clientId"`
			RelationshipRoles *[]string `json:"relationshipRoles"`
			RelationshipNotes *string   `json:"relationshipNotes"`
			models.EmploymentDetails
		}
		if remove {
			id, err := strconv.ParseUint(c.Param("clientId"), 10, 32)
			if err != nil {
				c.JSON(400, gin.H{"error": "Cliente no válido"})
				return
			}
			input.ClientID = uint(id)
		} else if c.ShouldBindJSON(&input) != nil {
			c.JSON(400, gin.H{"error": "Datos no válidos"})
			return
		}
		if organization.AccountClientID != nil && *organization.AccountClientID == input.ClientID {
			c.JSON(400, gin.H{"error": "La cuenta de la constructora es parte del registro"})
			return
		}
		err := db.Transaction(func(tx *gorm.DB) error {
			var client models.User
			query := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ? AND role = ? AND is_active = ?", input.ClientID, "client", true)
			if !config.CanAccessAllOffices(actor.Role) {
				query = services.OfficeClientUsers(query, *actor.OfficeID)
			}
			if err := query.First(&client).Error; err != nil {
				return services.InvalidOrganization("Cliente no disponible en esta oficina")
			}
			if client.ClientType == models.ClientOrganization {
				return services.InvalidOrganization("Vincule una persona; la cuenta de una constructora ya tiene su propio registro")
			}
			if !remove && (client.OfficeID == nil || *client.OfficeID == 0) {
				return services.InvalidOrganization("Asigne una oficina responsable al cliente antes de vincularlo")
			}
			if remove {
				return tx.Where("organization_id = ? AND client_id = ?", organization.ID, client.ID).Delete(&models.OrganizationClient{}).Error
			}
			if organization.Kind == models.OrganizationMaquila {
				return services.SaveClientEmployment(tx, actor, &client, &services.EmploymentInput{MaquilaID: &organization.ID, EmploymentDetails: input.EmploymentDetails})
			}
			var membership models.OrganizationClient
			err := tx.Where("organization_id = ? AND client_id = ?", organization.ID, client.ID).First(&membership).Error
			if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}
			membership.OrganizationID = organization.ID
			membership.ClientID = client.ID
			if input.RelationshipRoles != nil {
				roles, err := services.NormalizeContractorRoles(*input.RelationshipRoles)
				if err != nil {
					return err
				}
				membership.RelationshipRoles = roles
			}
			if input.RelationshipNotes != nil {
				value := strings.TrimSpace(*input.RelationshipNotes)
				if utf8.RuneCountInString(value) > 2000 {
					return services.InvalidOrganization("La aclaración admite hasta 2,000 caracteres")
				}
				membership.RelationshipNotes = value
			}
			return tx.Omit(clause.Associations).Save(&membership).Error
		})
		if err != nil {
			organizationFailure(c, err)
			return
		}
		c.JSON(200, gin.H{"ok": true})
	}
}

func GetClientOrganizations(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		actor, ok := workflowClientActor(c)
		if !ok {
			return
		}
		var client models.User
		query := db.Where("id = ? AND role = ?", c.Param("clientId"), "client")
		if !config.CanAccessAllOffices(actor.Role) {
			query = services.OfficeClientUsers(query, *actor.OfficeID)
		}
		if err := query.First(&client).Error; err != nil {
			c.JSON(404, gin.H{"error": "Cliente no disponible"})
			return
		}
		memberships := []models.OrganizationClient{}
		membershipQuery := db.Preload("Organization")
		if !config.CanAccessOrganizationDirectory(actor.Role) {
			membershipQuery = db.Preload("Organization", func(query *gorm.DB) *gorm.DB { return query.Select("id, kind, name") }).Where("organization_id IN (?)", db.Model(&models.Organization{}).Select("id").Where("kind = ?", models.OrganizationMaquila))
		}
		if err := membershipQuery.Where("client_id = ?", client.ID).Find(&memberships).Error; err != nil {
			c.JSON(500, gin.H{"error": "No se pudieron cargar las relaciones"})
			return
		}
		c.JSON(200, gin.H{"data": memberships})
	}
}

// ClientOptions is a minimal, office-scoped selector shared by registry,
// appointment and calendar forms. Client credentials and addresses are excluded.
func ClientOptions(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		actor, ok := workflowClientActor(c)
		if !ok {
			return
		}
		query := db.Model(&models.User{}).Where("role = ? AND is_active = ?", "client", true)
		if !config.CanAccessAllOffices(actor.Role) {
			query = services.OfficeClientUsers(query, *actor.OfficeID)
		}
		if office := c.Query("officeId"); office != "" {
			officeID, err := strconv.ParseUint(office, 10, 32)
			if err != nil || officeID == 0 {
				c.JSON(400, gin.H{"error": "Oficina no válida"})
				return
			}
			query = services.OfficeClientUsers(query, uint(officeID))
		}
		if kind := c.Query("clientType"); kind != "" {
			if kind != models.ClientPerson && kind != models.ClientOrganization {
				c.JSON(400, gin.H{"error": "Tipo de cliente no válido"})
				return
			}
			query = query.Where("client_type = ?", kind)
		}
		if q := strings.ToLower(strings.TrimSpace(c.Query("q"))); q != "" {
			pattern := "%" + q + "%"
			query = query.Where("LOWER(first_name || ' ' || last_name) LIKE ? OR LOWER(email) LIKE ?", pattern, pattern)
		}
		var users []struct {
			ID         uint   `json:"id"`
			FirstName  string `json:"firstName"`
			LastName   string `json:"lastName"`
			Email      string `json:"email"`
			ClientType string `json:"clientType"`
			OfficeID   *uint  `json:"officeId"`
		}
		if err := query.Select("id,first_name,last_name,email,client_type,office_id").Order("first_name ASC").Limit(50).Scan(&users).Error; err != nil {
			c.JSON(500, gin.H{"error": "No se pudieron cargar los clientes"})
			return
		}
		if users == nil {
			c.JSON(200, gin.H{"data": []interface{}{}})
			return
		}
		c.JSON(200, gin.H{"data": users})
	}
}

// FactoryOptions exposes only names/IDs needed by existing case forms, never
// directory details, memberships, totals or other offices' client data.
func FactoryOptions(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		if _, ok := workflowClientActor(c); !ok {
			return
		}
		query := db.Model(&models.Organization{}).Where("kind = ?", models.OrganizationMaquila)
		if q := strings.TrimSpace(c.Query("q")); q != "" {
			query = query.Where("LOWER(name) LIKE ?", "%"+strings.ToLower(q)+"%")
		}
		if id := c.Query("id"); id != "" {
			parsed, err := strconv.ParseUint(id, 10, 32)
			if err != nil || parsed == 0 {
				c.JSON(400, gin.H{"error": "Maquila no válida"})
				return
			}
			query = query.Where("id = ?", parsed)
		}
		records := []struct {
			ID   uint   `json:"id"`
			Name string `json:"name"`
		}{}
		if err := query.Select("id, name").Order("name ASC").Limit(100).Scan(&records).Error; err != nil {
			c.JSON(500, gin.H{"error": "No se pudieron cargar las maquilas"})
			return
		}
		c.JSON(200, gin.H{"data": records})
	}
}
