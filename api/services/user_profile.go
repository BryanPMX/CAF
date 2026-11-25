package services

import (
	"strings"
	"time"
	"unicode/utf8"

	"github.com/BryanPMX/CAF/api/config"
	"github.com/BryanPMX/CAF/api/models"
)

// User-role changes must not retain an unrelated professional specialty.
// Department assignments also drive access queries; preserve them while
// correcting the explicitly defined IT department of technical support.
func ApplyUserOrganization(user *models.User, previousRole string, specialty *string) error {
	if specialty != nil {
		value := strings.TrimSpace(*specialty)
		if utf8.RuneCountInString(value) > 100 {
			return InvalidOrganization("La especialidad admite hasta 100 caracteres")
		}
		if value != "" && (!config.SupportsProfessionalSpecialty(user.Role) || !config.SpecialtyFitsRole(user.Role, value)) {
			return InvalidOrganization("La especialidad debe corresponder al rol profesional seleccionado")
		}
		user.Specialty = nil
		if value != "" {
			user.Specialty = &value
		}
	}
	if user.Role == config.RoleTechnicalSupport {
		department := config.DepartmentIT
		user.Department = &department
	}
	if !config.SupportsProfessionalSpecialty(user.Role) || previousRole != user.Role && specialty == nil {
		user.Specialty = nil
	}
	return nil
}

// NormalizeBirthDate preserves omitted values and permits explicit clearing with "".
func NormalizeBirthDate(value *string) (*models.Date, error) {
	if value == nil {
		return nil, nil
	}
	if strings.TrimSpace(*value) == "" {
		return nil, nil
	}
	v := strings.TrimSpace(*value)
	date, err := time.Parse("2006-01-02", v)
	if err != nil || date.After(time.Now()) || date.Year() < 1850 {
		return nil, InvalidOrganization("Fecha de nacimiento no válida")
	}
	return models.DatePointer(&v), nil
}
