package services

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/BryanPMX/CAF/api/config"
	"github.com/BryanPMX/CAF/api/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var shiftClock = regexp.MustCompile(`^([01][0-9]|2[0-3]):[0-5][0-9]$`)

type EmploymentInput struct {
	MaquilaID *uint `json:"maquilaId"`
	models.EmploymentDetails
}

func NormalizeEmployment(input *EmploymentInput) error {
	input.EmployeeNumber = strings.TrimSpace(input.EmployeeNumber)
	input.ShiftName = strings.TrimSpace(input.ShiftName)
	input.ShiftStart = strings.TrimSpace(input.ShiftStart)
	input.ShiftEnd = strings.TrimSpace(input.ShiftEnd)
	if utf8.RuneCountInString(input.EmployeeNumber) > 100 || utf8.RuneCountInString(input.ShiftName) > 100 {
		return InvalidOrganization("Turno y número de empleado admiten hasta 100 caracteres")
	}
	if input.MaquilaID == nil {
		if input.EmployeeNumber != "" || input.ShiftName != "" || input.ShiftStart != "" || input.ShiftEnd != "" {
			return InvalidOrganization("Seleccione una maquila para los datos laborales")
		}
		return nil
	}
	if *input.MaquilaID == 0 || input.EmployeeNumber == "" || input.ShiftName == "" {
		return InvalidOrganization("La maquila requiere número de empleado y turno")
	}
	if (input.ShiftStart != "" || input.ShiftEnd != "") && (!shiftClock.MatchString(input.ShiftStart) || !shiftClock.MatchString(input.ShiftEnd)) {
		return InvalidOrganization("Capture ambas horas del turno en formato HH:mm")
	}
	return nil
}

func CanAccessOrganization(actor models.User, organization models.Organization) bool {
	return actor.Role != "client" && (organization.Kind == models.OrganizationMaquila || config.CanAccessAllOffices(actor.Role) || (actor.OfficeID != nil && organization.OfficeID != nil && *actor.OfficeID == *organization.OfficeID))
}

func ValidateMaquila(db *gorm.DB, actor models.User, officeID uint, input *EmploymentInput) error {
	if err := NormalizeEmployment(input); err != nil {
		return err
	}
	if input.MaquilaID == nil {
		return nil
	}
	var organization models.Organization
	if err := db.Where("id = ? AND kind = ?", *input.MaquilaID, models.OrganizationMaquila).First(&organization).Error; err != nil {
		return InvalidOrganization("Maquila no disponible")
	}
	if officeID == 0 || !CanAccessOrganization(actor, organization) || (!config.CanAccessAllOffices(actor.Role) && (actor.OfficeID == nil || *actor.OfficeID != officeID)) {
		return InvalidOrganization("La oficina responsable del registro debe estar dentro de su alcance")
	}
	return nil
}

// SaveClientEmployment replaces only the current factory relationship. Contractor
// contacts and historical case snapshots are independent and remain intact.
func SaveClientEmployment(tx *gorm.DB, actor models.User, client *models.User, input *EmploymentInput) error {
	if input == nil {
		return nil
	}
	if client.Role != "client" || client.ClientType == models.ClientOrganization {
		return InvalidOrganization("Los datos laborales corresponden a clientes individuales")
	}
	if err := NormalizeEmployment(input); err != nil {
		return err
	}
	if input.MaquilaID != nil && (client.OfficeID == nil || *client.OfficeID == 0) {
		return InvalidOrganization("Asigne una oficina responsable al cliente antes de vincular una maquila")
	}
	officeID := uint(0)
	if client.OfficeID != nil {
		officeID = *client.OfficeID
	}
	if err := ValidateMaquila(tx, actor, officeID, input); err != nil {
		return err
	}
	var locked models.User
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&locked, client.ID).Error; err != nil {
		return err
	}
	if err := tx.Where("client_id = ? AND organization_id IN (?)", client.ID, tx.Model(&models.Organization{}).Select("id").Where("kind = ?", models.OrganizationMaquila)).Delete(&models.OrganizationClient{}).Error; err != nil {
		return err
	}
	if input.MaquilaID == nil {
		return nil
	}
	return tx.Create(&models.OrganizationClient{OrganizationID: *input.MaquilaID, ClientID: client.ID, EmploymentDetails: input.EmploymentDetails}).Error
}

func ValidateCaseClient(client models.User) error {
	if client.Role != "client" || client.ClientType == models.ClientOrganization {
		return InvalidOrganization("Los expedientes requieren un cliente individual; una constructora puede tener citas sin expediente")
	}
	return nil
}

func ApplyCaseEmployment(tx *gorm.DB, actor models.User, record *models.Case, input *EmploymentInput) error {
	if record.ClientID == nil {
		if input != nil && input.MaquilaID != nil {
			return InvalidOrganization("Seleccione un cliente para el expediente de maquila")
		}
		return nil
	}
	var client models.User
	if err := tx.First(&client, *record.ClientID).Error; err != nil {
		return InvalidOrganization("Cliente no disponible")
	}
	if err := ValidateCaseClient(client); err != nil {
		return err
	}
	if input == nil {
		var membership models.OrganizationClient
		err := tx.Where("client_id = ? AND organization_id IN (?)", client.ID, tx.Model(&models.Organization{}).Select("id").Where("kind = ?", models.OrganizationMaquila)).First(&membership).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		if err != nil {
			return err
		}
		input = &EmploymentInput{MaquilaID: &membership.OrganizationID, EmploymentDetails: membership.EmploymentDetails}
	}
	if err := ValidateMaquila(tx, actor, record.OfficeID, input); err != nil {
		return err
	}
	record.MaquilaID = input.MaquilaID
	record.EmploymentDetails = input.EmploymentDetails
	return nil
}

func SyncOrganizationClient(tx *gorm.DB, user *models.User) error {
	if user.ClientType != models.ClientOrganization {
		return nil
	}
	if user.Role != "client" || user.LastName != "" || user.OfficeID != nil {
		return InvalidOrganization("La cuenta compartida de una constructora conserva su tipo y rol, sin oficina")
	}
	var organization models.Organization
	if err := tx.Where("account_client_id = ?", user.ID).First(&organization).Error; err != nil {
		return fmt.Errorf("constructora no disponible: %w", err)
	}
	if organization.OfficeID != nil {
		return InvalidOrganization("La oficina de la constructora no puede cambiarse desde Usuarios")
	}
	if !strings.EqualFold(strings.TrimSpace(organization.Name), strings.TrimSpace(user.FirstName)) {
		if err := EnsureOrganizationNameAvailable(tx, models.OrganizationContractor, user.FirstName, organization.ID); err != nil {
			return err
		}
	}
	return tx.Model(&organization).Update("name", strings.TrimSpace(user.FirstName)).Error
}

// Shared memberships follow the individual client's responsible office. Company
// identities are global; changing a linked individual's role/removing their office
// still requires unlinking, but authorized office transfers preserve relationships.
func ValidateClientOrganizations(tx *gorm.DB, client models.User) error {
	if client.Role == "client" && (client.ClientType == models.ClientOrganization || (client.OfficeID != nil && *client.OfficeID != 0)) {
		return nil
	}
	var count int64
	if err := tx.Model(&models.OrganizationClient{}).Where("client_id = ?", client.ID).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return InvalidOrganization("Desvincule las organizaciones antes de cambiar el rol o quitar la oficina del cliente")
	}
	return nil
}

type OrganizationValidationError struct{ Message string }

func (e OrganizationValidationError) Error() string { return e.Message }
func InvalidOrganization(message string) error      { return OrganizationValidationError{Message: message} }

// SyncUserOrganizations applies the same invariants to edits and reactivations.
func SyncUserOrganizations(tx *gorm.DB, actor models.User, user *models.User, employment *EmploymentInput) error {
	if err := SyncOrganizationClient(tx, user); err != nil {
		return err
	}
	if err := SaveClientEmployment(tx, actor, user, employment); err != nil {
		return err
	}
	return ValidateClientOrganizations(tx, *user)
}

// OfficeClientUsers includes only canonical shared company identities alongside
// records assigned to this office. Service records must retain their own office filters.
func OfficeClientUsers(query *gorm.DB, officeID uint) *gorm.DB {
	if officeID == 0 {
		return query.Where("1 = 0")
	}
	companies := query.Session(&gorm.Session{NewDB: true}).Model(&models.Organization{}).Select("account_client_id").Where("kind = ? AND office_id IS NULL", models.OrganizationContractor)
	return query.Where("(users.office_id = ? OR (users.office_id IS NULL AND users.role = ? AND users.client_type = ? AND users.id IN (?)))", officeID, "client", models.ClientOrganization, companies)
}

// Call inside the user-mutation lock and transaction used by registry/Usuarios.
func EnsureOrganizationNameAvailable(tx *gorm.DB, kind, name string, excludeID uint) error {
	var count int64
	if err := tx.Model(&models.Organization{}).Where("kind = ? AND LOWER(TRIM(name)) = LOWER(?) AND id <> ?", kind, strings.TrimSpace(name), excludeID).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return gorm.ErrDuplicatedKey
	}
	return nil
}
