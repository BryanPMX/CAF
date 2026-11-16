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
	return actor.Role != "client" && (config.CanAccessAllOffices(actor.Role) || (actor.OfficeID != nil && *actor.OfficeID == organization.OfficeID))
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
	if organization.OfficeID != officeID || !CanAccessOrganization(actor, organization) {
		return InvalidOrganization("La maquila debe pertenecer a la oficina del registro")
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
	if input.MaquilaID != nil && client.OfficeID == nil {
		var organization models.Organization
		if err := tx.First(&organization, *input.MaquilaID).Error; err != nil {
			return InvalidOrganization("Maquila no disponible")
		}
		client.OfficeID = &organization.OfficeID
		if err := tx.Model(client).Update("office_id", client.OfficeID).Error; err != nil {
			return err
		}
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
	if user.Role != "client" || user.LastName != "" || user.OfficeID == nil {
		return InvalidOrganization("La cuenta de una constructora conserva su tipo, rol y oficina")
	}
	var organization models.Organization
	if err := tx.Where("account_client_id = ?", user.ID).First(&organization).Error; err != nil {
		return fmt.Errorf("constructora no disponible: %w", err)
	}
	if organization.OfficeID != *user.OfficeID {
		return InvalidOrganization("La oficina de la constructora no puede cambiarse desde Usuarios")
	}
	return tx.Model(&organization).Update("name", strings.TrimSpace(user.FirstName)).Error
}

// Memberships remain client records in the same office even when edited through Users.
func ValidateClientOrganizations(tx *gorm.DB, client models.User) error {
	var count int64
	query := tx.Model(&models.OrganizationClient{}).Where("client_id = ?", client.ID)
	if client.Role != "client" || client.OfficeID == nil {
		if err := query.Count(&count).Error; err != nil {
			return err
		}
	} else {
		if err := query.Where("organization_id IN (?)", tx.Model(&models.Organization{}).Select("id").Where("office_id <> ?", *client.OfficeID)).Count(&count).Error; err != nil {
			return err
		}
	}
	if count > 0 {
		return InvalidOrganization("Desvincule las organizaciones antes de cambiar el rol o la oficina del cliente")
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
