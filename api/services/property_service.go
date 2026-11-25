package services

import (
	"errors"
	"math"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/BryanPMX/CAF/api/config"
	"github.com/BryanPMX/CAF/api/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type PropertyError struct {
	Status  int
	Message string
}

func (e PropertyError) Error() string      { return e.Message }
func propertyInvalid(message string) error { return PropertyError{400, message} }

type PropertyService struct{ db *gorm.DB }

func NewPropertyService(db *gorm.DB) *PropertyService { return &PropertyService{db: db} }

type PropertyInput struct {
	InitialOwnerID  *uint    `json:"initialOwnerId"`
	OfficeID        uint     `json:"officeId"`
	OrganizationID  *uint    `json:"organizationId"`
	ParentID        *uint    `json:"parentId"`
	Name            string   `json:"name"`
	Kind            string   `json:"kind"`
	DevelopmentName string   `json:"developmentName"`
	Address         string   `json:"address"`
	State           string   `json:"state"`
	Municipality    string   `json:"municipality"`
	District        string   `json:"district"`
	Block           string   `json:"block"`
	Lot             string   `json:"lot"`
	CadastralKey    string   `json:"cadastralKey"`
	AreaM2          *float64 `json:"areaM2"`
	Notes           string   `json:"notes"`
}
type PropertyFilter struct {
	Q                                  string
	OfficeID, OrganizationID, ClientID uint
	Page, PageSize                     int
}
type PropertyOwnerInput struct {
	ClientID     uint     `json:"clientId"`
	SharePercent *float64 `json:"sharePercent"`
	Status       string   `json:"status"`
	StartDate    *string  `json:"startDate"`
	EndDate      *string  `json:"endDate"`
	Source       string   `json:"source"`
}
type PropertyRegistryInput struct {
	RealFolio        string  `json:"realFolio"`
	Inscription      string  `json:"inscription"`
	Folio            string  `json:"folio"`
	Book             string  `json:"book"`
	Section          string  `json:"section"`
	ActType          string  `json:"actType"`
	InstrumentNumber string  `json:"instrumentNumber"`
	InstrumentDate   *string `json:"instrumentDate"`
	RegistrationDate *string `json:"registrationDate"`
	Notary           string  `json:"notary"`
	Source           string  `json:"source"`
}

func propertyAccess(actor models.User) error {
	if !actor.IsActive || !config.CanAccessOrganizationDirectory(actor.Role) || (!config.CanAccessAllOffices(actor.Role) && (actor.OfficeID == nil || *actor.OfficeID == 0)) {
		return PropertyError{403, "Sin acceso al archivo de propiedades"}
	}
	return nil
}
func (s *PropertyService) scope(actor models.User) *gorm.DB {
	q := s.db.Model(&models.Property{})
	if !config.CanAccessAllOffices(actor.Role) {
		q = q.Where("properties.office_id = ?", *actor.OfficeID)
	}
	return q
}
func propertyDBError(err error) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return PropertyError{404, "Propiedad no disponible"}
	}
	return err
}
func (s *PropertyService) Get(actor models.User, id uint) (*models.Property, error) {
	if err := propertyAccess(actor); err != nil {
		return nil, err
	}
	var record models.Property
	people := func(q *gorm.DB) *gorm.DB {
		q = q.Select("id, first_name, last_name, client_type, office_id")
		if !config.CanAccessAllOffices(actor.Role) {
			q = OfficeClientUsers(q, *actor.OfficeID)
		}
		return q
	}
	err := s.scope(actor).Preload("Office").Preload("Documents").Preload("Organization").Preload("Owners", func(q *gorm.DB) *gorm.DB { return q.Order("id DESC") }).Preload("Owners.Client", people).Preload("RegistryEntries", func(q *gorm.DB) *gorm.DB { return q.Order("id DESC") }).First(&record, id).Error
	return &record, propertyDBError(err)
}
func (s *PropertyService) List(actor models.User, filter PropertyFilter) ([]models.Property, int64, error) {
	records := []models.Property{}
	if err := propertyAccess(actor); err != nil {
		return records, 0, err
	}
	if filter.Page < 1 {
		filter.Page = 1
	}
	if filter.PageSize < 1 || filter.PageSize > 100 {
		filter.PageSize = 20
	}
	if utf8.RuneCountInString(filter.Q) > 200 {
		return records, 0, propertyInvalid("La búsqueda admite hasta 200 caracteres")
	}
	q := s.scope(actor)
	if filter.OfficeID != 0 {
		if !config.CanAccessAllOffices(actor.Role) && filter.OfficeID != *actor.OfficeID {
			return records, 0, PropertyError{403, "Oficina fuera de su alcance"}
		}
		q = q.Where("properties.office_id = ?", filter.OfficeID)
	}
	if filter.OrganizationID != 0 {
		q = q.Where("properties.organization_id = ?", filter.OrganizationID)
	}
	if filter.ClientID != 0 {
		if err := s.validateClient(s.db, actor, filter.ClientID, 0); err != nil {
			return records, 0, err
		}
		q = q.Where("EXISTS (SELECT 1 FROM property_owners po WHERE po.property_id = properties.id AND po.client_id = ?)", filter.ClientID)
	}
	if term := strings.ToLower(strings.TrimSpace(filter.Q)); term != "" {
		like := "%" + term + "%"
		people := s.db.Model(&models.User{}).Select("users.id").Where("LOWER(users.first_name || ' ' || users.last_name) LIKE ?", like)
		if !config.CanAccessAllOffices(actor.Role) {
			people = OfficeClientUsers(people, *actor.OfficeID)
		}
		owned := s.db.Model(&models.PropertyOwner{}).Select("property_id").Where("client_id IN (?)", people)
		companies := s.db.Model(&models.Organization{}).Select("id").Where("LOWER(name) LIKE ? OR LOWER(legal_name) LIKE ? OR LOWER(trade_name) LIKE ?", like, like, like)
		q = q.Where(`(LOWER(properties.name) LIKE ? OR LOWER(properties.development_name) LIKE ? OR LOWER(properties.address) LIKE ? OR LOWER(properties.cadastral_key) LIKE ? OR properties.id IN (?) OR properties.organization_id IN (?) OR EXISTS (SELECT 1 FROM property_registry_entries pr WHERE pr.property_id = properties.id AND (LOWER(pr.real_folio) LIKE ? OR LOWER(pr.inscription) LIKE ? OR LOWER(pr.folio) LIKE ? OR LOWER(pr.book) LIKE ?)))`, like, like, like, like, owned, companies, like, like, like, like)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return records, 0, err
	}
	err := q.Preload("Office").Order("properties.updated_at DESC, properties.id DESC").Limit(filter.PageSize).Offset((filter.Page - 1) * filter.PageSize).Find(&records).Error
	return records, total, err
}
func trimField(value *string, max int) error {
	*value = strings.TrimSpace(*value)
	if utf8.RuneCountInString(*value) > max {
		return propertyInvalid("Uno de los campos excede la longitud permitida")
	}
	return nil
}
func dateField(value **string) error {
	if *value == nil {
		return nil
	}
	v := strings.TrimSpace(**value)
	if v == "" {
		*value = nil
		return nil
	}
	if _, err := time.Parse("2006-01-02", v); err != nil {
		return propertyInvalid("Use una fecha válida en formato AAAA-MM-DD")
	}
	*value = &v
	return nil
}

func (s *PropertyService) Save(actor models.User, id uint, input PropertyInput) (*models.Property, error) {
	if err := propertyAccess(actor); err != nil {
		return nil, err
	}
	for field, max := range map[*string]int{&input.Name: 255, &input.DevelopmentName: 255, &input.Address: 1000, &input.State: 100, &input.Municipality: 100, &input.District: 100, &input.Block: 100, &input.Lot: 100, &input.CadastralKey: 100, &input.Notes: 5000} {
		if err := trimField(field, max); err != nil {
			return nil, err
		}
	}
	if input.Name == "" {
		return nil, propertyInvalid("Indique un nombre para identificar la propiedad")
	}
	if input.Kind != "land" && input.Kind != "block" && input.Kind != "lot" {
		return nil, propertyInvalid("Seleccione terreno, manzana o lote")
	}
	if input.AreaM2 != nil && (math.IsNaN(*input.AreaM2) || math.IsInf(*input.AreaM2, 0) || *input.AreaM2 < 0.0001 || *input.AreaM2 >= 1e14) {
		return nil, propertyInvalid("La superficie debe ser mayor que cero y menor que 100 billones de m²")
	}
	var record models.Property
	err := s.db.Transaction(func(tx *gorm.DB) error {
		scoped := NewPropertyService(tx)
		// Serialize hierarchy edits per office so simultaneous changes cannot create a cycle.
		if id != 0 {
			if err := scoped.scope(actor).First(&record, id).Error; err != nil {
				return propertyDBError(err)
			}
			if input.OfficeID == 0 {
				input.OfficeID = record.OfficeID
			}
			if input.OfficeID != record.OfficeID {
				return propertyInvalid("La oficina del archivo no puede cambiarse")
			}
		}
		if !config.CanAccessAllOffices(actor.Role) {
			if input.OfficeID != 0 && input.OfficeID != *actor.OfficeID {
				return PropertyError{403, "Oficina fuera de su alcance"}
			}
			input.OfficeID = *actor.OfficeID
		}
		if input.OfficeID == 0 {
			return propertyInvalid("Seleccione la oficina responsable")
		}
		var office models.Office
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&office, input.OfficeID).Error; err != nil {
			return propertyInvalid("Oficina no disponible")
		}
		if id != 0 {
			if err := scoped.scope(actor).Clauses(clause.Locking{Strength: "UPDATE"}).First(&record, id).Error; err != nil {
				return propertyDBError(err)
			}
		}
		if input.OrganizationID != nil {
			var org models.Organization
			if *input.OrganizationID == 0 || tx.Where("id = ? AND kind = ?", *input.OrganizationID, models.OrganizationContractor).First(&org).Error != nil {
				return propertyInvalid("Constructora no disponible")
			}
		}
		if input.ParentID != nil {
			visited := map[uint]bool{}
			ancestor := input.ParentID
			first := true
			for ancestor != nil {
				if *ancestor == id || visited[*ancestor] {
					return propertyInvalid("La relación entre terrenos no puede formar un ciclo")
				}
				visited[*ancestor] = true
				var parent models.Property
				if err := tx.Where("id = ? AND office_id = ?", *ancestor, input.OfficeID).First(&parent).Error; err != nil {
					return propertyInvalid("La propiedad de origen debe estar en la misma oficina")
				}
				if first && (parent.Kind == "lot" || input.Kind == "land" || input.Kind == "block" && parent.Kind != "land") {
					return propertyInvalid("La propiedad de origen debe ser un terreno o una manzana compatible")
				}
				first = false
				ancestor = parent.ParentID
			}
		}
		if id != 0 && record.Kind != input.Kind {
			var children int64
			if err := tx.Model(&models.Property{}).Where("parent_id = ?", id).Count(&children).Error; err != nil {
				return err
			}
			if children > 0 {
				return propertyInvalid("No cambie el tipo de una propiedad que tiene subdivisiones")
			}
		}
		record.OfficeID = input.OfficeID
		record.OrganizationID = input.OrganizationID
		record.ParentID = input.ParentID
		record.Name = input.Name
		record.Kind = input.Kind
		record.DevelopmentName = input.DevelopmentName
		record.Address = input.Address
		record.State = input.State
		record.Municipality = input.Municipality
		record.District = input.District
		record.Block = input.Block
		record.Lot = input.Lot
		record.CadastralKey = input.CadastralKey
		record.AreaM2 = input.AreaM2
		record.Notes = input.Notes
		record.UpdatedBy = actor.ID
		if id == 0 {
			record.CreatedBy = actor.ID
		}
		if err := tx.Omit(clause.Associations).Save(&record).Error; err != nil {
			return err
		}
		if input.InitialOwnerID != nil {
			if id != 0 {
				return propertyInvalid("Agregue propietarios desde su historial")
			}
			if err := s.validateClient(tx, actor, *input.InitialOwnerID, record.OfficeID); err != nil {
				return err
			}
			return tx.Create(&models.PropertyOwner{PropertyID: record.ID, ClientID: *input.InitialOwnerID, Status: "reported", CreatedBy: actor.ID, UpdatedBy: actor.ID}).Error
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return s.Get(actor, record.ID)
}
func (s *PropertyService) validateClient(tx *gorm.DB, actor models.User, id, office uint) error {
	var person models.User
	q := tx.Where("id = ? AND role = ?", id, "client")
	if !config.CanAccessAllOffices(actor.Role) {
		q = OfficeClientUsers(q, *actor.OfficeID)
	}
	if id == 0 || q.First(&person).Error != nil {
		return propertyInvalid("Cliente no disponible")
	}
	if office != 0 && person.ClientType != models.ClientOrganization && (person.OfficeID == nil || *person.OfficeID != office) {
		return propertyInvalid("La persona debe pertenecer a la oficina responsable de la propiedad")
	}
	return nil
}
func (s *PropertyService) SaveOwner(actor models.User, propertyID, id uint, input PropertyOwnerInput) (*models.Property, error) {
	if err := propertyAccess(actor); err != nil {
		return nil, err
	}
	if input.Status == "" {
		input.Status = "reported"
	}
	if input.Status != "reported" && input.Status != "current" && input.Status != "historical" {
		return nil, propertyInvalid("Estado de propiedad no válido")
	}
	if input.SharePercent != nil && (math.IsNaN(*input.SharePercent) || math.IsInf(*input.SharePercent, 0) || *input.SharePercent < 0.0001 || *input.SharePercent > 100) {
		return nil, propertyInvalid("El porcentaje debe ser mayor que cero y hasta 100")
	}
	if err := dateField(&input.StartDate); err != nil {
		return nil, err
	}
	if err := dateField(&input.EndDate); err != nil {
		return nil, err
	}
	if input.StartDate != nil && input.EndDate != nil && *input.EndDate < *input.StartDate {
		return nil, propertyInvalid("La fecha final debe ser posterior a la inicial")
	}
	if input.Status == "current" && input.EndDate != nil {
		return nil, propertyInvalid("Un propietario actual no debe tener fecha de término")
	}
	if err := trimField(&input.Source, 2000); err != nil {
		return nil, err
	}
	err := s.db.Transaction(func(tx *gorm.DB) error {
		var property models.Property
		if err := NewPropertyService(tx).scope(actor).Clauses(clause.Locking{Strength: "UPDATE"}).First(&property, propertyID).Error; err != nil {
			return propertyDBError(err)
		}
		if err := s.validateClient(tx, actor, input.ClientID, property.OfficeID); err != nil {
			return err
		}
		var record models.PropertyOwner
		if id != 0 {
			if err := tx.Where("id = ? AND property_id = ?", id, propertyID).First(&record).Error; err != nil {
				return PropertyError{404, "Propietario no disponible"}
			}
			if record.ClientID != input.ClientID {
				return propertyInvalid("Para otro propietario, agregue un registro y conserve el anterior")
			}
		}
		if input.Status == "current" {
			var duplicate int64
			if err := tx.Model(&models.PropertyOwner{}).Where("property_id = ? AND client_id = ? AND status = ? AND id <> ?", propertyID, input.ClientID, "current", id).Count(&duplicate).Error; err != nil {
				return err
			}
			if duplicate > 0 {
				return propertyInvalid("Este cliente ya está registrado como propietario actual")
			}
			if input.SharePercent != nil {
				var sum float64
				if err := tx.Model(&models.PropertyOwner{}).Select("COALESCE(SUM(share_percent),0)").Where("property_id = ? AND status = ? AND id <> ?", propertyID, "current", id).Scan(&sum).Error; err != nil {
					return err
				}
				if sum+*input.SharePercent > 100.00001 {
					return propertyInvalid("Los porcentajes de propietarios actuales no pueden superar 100%")
				}
			}
		}
		record.PropertyID = propertyID
		record.ClientID = input.ClientID
		record.SharePercent = input.SharePercent
		record.Status = input.Status
		record.StartDate = models.DatePointer(input.StartDate)
		record.EndDate = models.DatePointer(input.EndDate)
		record.Source = input.Source
		record.UpdatedBy = actor.ID
		if id == 0 {
			record.CreatedBy = actor.ID
		}
		return tx.Omit(clause.Associations).Save(&record).Error
	})
	if err != nil {
		return nil, err
	}
	return s.Get(actor, propertyID)
}
func (s *PropertyService) SaveRegistry(actor models.User, propertyID, id uint, input PropertyRegistryInput) (*models.Property, error) {
	if err := propertyAccess(actor); err != nil {
		return nil, err
	}
	for field, max := range map[*string]int{&input.RealFolio: 100, &input.Inscription: 100, &input.Folio: 100, &input.Book: 100, &input.Section: 100, &input.ActType: 255, &input.InstrumentNumber: 100, &input.Notary: 255, &input.Source: 2000} {
		if err := trimField(field, max); err != nil {
			return nil, err
		}
	}
	if input.RealFolio == "" && input.Inscription == "" && input.Folio == "" && input.Book == "" && input.InstrumentNumber == "" && input.Source == "" {
		return nil, propertyInvalid("Capture un dato registral o una fuente para identificar el registro")
	}
	if err := dateField(&input.InstrumentDate); err != nil {
		return nil, err
	}
	if err := dateField(&input.RegistrationDate); err != nil {
		return nil, err
	}
	err := s.db.Transaction(func(tx *gorm.DB) error {
		var property models.Property
		if err := NewPropertyService(tx).scope(actor).Clauses(clause.Locking{Strength: "UPDATE"}).First(&property, propertyID).Error; err != nil {
			return propertyDBError(err)
		}
		var record models.PropertyRegistryEntry
		if id != 0 {
			if err := tx.Where("id = ? AND property_id = ?", id, propertyID).First(&record).Error; err != nil {
				return PropertyError{404, "Inscripción no disponible"}
			}
		}
		record.PropertyID = propertyID
		record.RealFolio = input.RealFolio
		record.Inscription = input.Inscription
		record.Folio = input.Folio
		record.Book = input.Book
		record.Section = input.Section
		record.ActType = input.ActType
		record.InstrumentNumber = input.InstrumentNumber
		record.InstrumentDate = models.DatePointer(input.InstrumentDate)
		record.RegistrationDate = models.DatePointer(input.RegistrationDate)
		record.Notary = input.Notary
		record.Source = input.Source
		record.UpdatedBy = actor.ID
		if id == 0 {
			record.CreatedBy = actor.ID
		}
		return tx.Save(&record).Error
	})
	if err != nil {
		return nil, err
	}
	return s.Get(actor, propertyID)
}

// Property archive authors and owners must remain identifiable after service work
// ends. Soft deletion may disable an account; hard deletion would erase history.
func HasPropertyUserReferences(db *gorm.DB, userID uint) (bool, error) {
	references := []struct {
		model     interface{}
		condition string
	}{
		{&models.Property{}, "created_by = ? OR updated_by = ?"},
		{&models.PropertyOwner{}, "client_id = ? OR created_by = ? OR updated_by = ?"},
		{&models.PropertyRegistryEntry{}, "created_by = ? OR updated_by = ?"},
		{&models.PropertyDocument{}, "created_by = ?"},
	}
	for _, ref := range references {
		args := []interface{}{}
		for range strings.Count(ref.condition, "?") {
			args = append(args, userID)
		}
		var count int64
		if err := db.Unscoped().Model(ref.model).Where(ref.condition, args...).Count(&count).Error; err != nil {
			return false, err
		}
		if count > 0 {
			return true, nil
		}
	}
	return false, nil
}
