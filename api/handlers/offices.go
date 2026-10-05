// api/handlers/offices.go
package handlers

import (
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/BryanPMX/CAF/api/interfaces"
	"github.com/BryanPMX/CAF/api/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// officePhonePattern validates phone format when provided (optional fields - no error if empty)
var officePhonePattern = regexp.MustCompile(`^[\d\s\+\-\(\)\.]{7,25}$`)

// OfficeInput defines the structure for creating or updating an office.
type OfficeInput struct {
	Name        string   `json:"name" binding:"required"`
	Address     string   `json:"address"`
	PhoneOffice string   `json:"phoneOffice"`
	PhoneCell   string   `json:"phoneCell"`
	Latitude    *float64 `json:"latitude"`
	Longitude   *float64 `json:"longitude"`
}

// GetOfficeByID retrieves a single office by its ID.
func GetOfficeByID(repo interfaces.OfficeRepository) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := parseOfficeID(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid office ID"})
			return
		}
		office, err := repo.GetByID(c.Request.Context(), id)
		if err != nil || office == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Office not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": office})
	}
}

// CreateOffice creates a new office (admin-only).
func CreateOffice(repo interfaces.OfficeRepository) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input OfficeInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		input.Name = strings.TrimSpace(input.Name)
		if input.Name == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "El nombre de la oficina no puede estar vacío."})
			return
		}
		exists, err := repo.ExistsByName(c.Request.Context(), input.Name, 0)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create office."})
			return
		}
		if exists {
			c.JSON(http.StatusConflict, gin.H{"error": "Ya existe una oficina con ese nombre. Usa un nombre distinto."})
			return
		}
		if msg := validateOfficePhone(input.PhoneOffice); msg != "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": msg})
			return
		}
		if msg := validateOfficePhone(input.PhoneCell); msg != "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": msg})
			return
		}
		office := &models.Office{
			Name:        input.Name,
			Address:     input.Address,
			PhoneOffice: strings.TrimSpace(input.PhoneOffice),
			PhoneCell:   strings.TrimSpace(input.PhoneCell),
			Latitude:    input.Latitude,
			Longitude:   input.Longitude,
			Code:        repo.GenerateUniqueCode(c.Request.Context(), input.Name, 0),
		}
		if err := repo.Create(c.Request.Context(), office); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create office."})
			return
		}
		c.JSON(http.StatusCreated, office)
	}
}

// GetOffices returns all offices (admin-only).
func GetOffices(repo interfaces.OfficeRepository) gin.HandlerFunc {
	return func(c *gin.Context) {
		offices, err := repo.List(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve offices."})
			return
		}
		if offices == nil {
			offices = make([]models.Office, 0)
		}
		c.JSON(http.StatusOK, offices)
	}
}

// GetPublicOffices returns all offices for the public marketing site (no auth).
func GetPublicOffices(repo interfaces.OfficeRepository) gin.HandlerFunc {
	return func(c *gin.Context) {
		offices, err := repo.List(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve offices."})
			return
		}
		if offices == nil {
			offices = make([]models.Office, 0)
		}
		c.JSON(http.StatusOK, offices)
	}
}

// UpdateOffice updates an existing office and returns the updated entity (admin-only).
func UpdateOffice(repo interfaces.OfficeRepository) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := parseOfficeID(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid office ID"})
			return
		}
		office, err := repo.GetByID(c.Request.Context(), id)
		if err != nil || office == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Office not found."})
			return
		}
		var input OfficeInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		input.Name = strings.TrimSpace(input.Name)
		if input.Name == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "El nombre de la oficina no puede estar vacío."})
			return
		}
		exists, err := repo.ExistsByName(c.Request.Context(), input.Name, office.ID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update office."})
			return
		}
		if exists {
			c.JSON(http.StatusConflict, gin.H{"error": "Ya existe otra oficina con ese nombre. Usa un nombre distinto."})
			return
		}
		if msg := validateOfficePhone(input.PhoneOffice); msg != "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": msg})
			return
		}
		if msg := validateOfficePhone(input.PhoneCell); msg != "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": msg})
			return
		}
		office.Name = input.Name
		office.Address = input.Address
		office.PhoneOffice = strings.TrimSpace(input.PhoneOffice)
		office.PhoneCell = strings.TrimSpace(input.PhoneCell)
		office.Code = repo.GenerateUniqueCode(c.Request.Context(), input.Name, office.ID)
		office.Latitude = input.Latitude
		office.Longitude = input.Longitude
		if err := repo.Update(c.Request.Context(), office); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update office."})
			return
		}
		// Return the updated entity from the database
		updated, _ := repo.GetByID(c.Request.Context(), id)
		if updated != nil {
			c.JSON(http.StatusOK, updated)
		} else {
			c.JSON(http.StatusOK, office)
		}
	}
}

// DeleteOffice permanently deletes an office (admin-only, hard delete).
// Blocks delete if the office has users, cases, or appointments assigned; returns 409 with a clear message.
func DeleteOffice(repo interfaces.OfficeRepository) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := parseOfficeID(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid office ID"})
			return
		}
		if _, err := repo.GetByID(c.Request.Context(), id); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Office not found."})
			return
		}
		blockReason, err := repo.GetDeleteBlockReason(c.Request.Context(), id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check office dependencies."})
			return
		}
		if blockReason != "" {
			c.JSON(http.StatusConflict, gin.H{"error": blockReason})
			return
		}
		if err := repo.Delete(c.Request.Context(), id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete office."})
			return
		}
		c.Status(http.StatusNoContent)
	}
}

// GetOfficeDetailWithStaff retrieves an office along with its users, separated into staff and clients.
func GetOfficeDetailWithStaff(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := parseOfficeID(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid office ID"})
			return
		}

		// Get the office
		var office models.Office
		if err := db.First(&office, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Office not found"})
			return
		}

		// Get all users assigned to this office. They are separated by role below.
		var officeUsers []models.User
		if err := db.Where("office_id = ? AND deleted_at IS NULL", id).
			Select("id, first_name, last_name, email, role, phone, is_active").
			Order("role, first_name, last_name").
			Find(&officeUsers).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch office users"})
			return
		}

		// Get counts for cases and appointments.
		var activeCases int64
		db.Model(&models.Case{}).Where("office_id = ? AND deleted_at IS NULL AND status != 'closed'", id).Count(&activeCases)

		var totalAppointments int64
		db.Model(&models.Appointment{}).Where("office_id = ?", id).Count(&totalAppointments)

		// Transform and separate users for response.
		staffList := make([]gin.H, 0, len(officeUsers))
		clientList := make([]gin.H, 0)
		for _, officeUser := range officeUsers {
			userResponse := gin.H{
				"id":        officeUser.ID,
				"firstName": officeUser.FirstName,
				"lastName":  officeUser.LastName,
				"email":     officeUser.Email,
				"role":      officeUser.Role,
				"phone":     officeUser.Phone,
				"isActive":  officeUser.IsActive,
			}
			if officeUser.Role == "client" {
				clientList = append(clientList, userResponse)
			} else {
				staffList = append(staffList, userResponse)
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"office":            office,
			"staff":             staffList,
			"clients":           clientList,
			"activeCases":       activeCases,
			"totalAppointments": totalAppointments,
			"staffCount":        len(staffList),
			"clientCount":       len(clientList),
		})
	}
}

func parseOfficeID(s string) (uint, error) {
	id, err := strconv.ParseUint(s, 10, 32)
	if err != nil {
		return 0, err
	}
	return uint(id), nil
}

// validateOfficePhone returns an error message if the phone is non-empty and invalid; empty is OK
func validateOfficePhone(phone string) string {
	trimmed := strings.TrimSpace(phone)
	if trimmed == "" {
		return ""
	}
	if !officePhonePattern.MatchString(trimmed) {
		return "Formato de teléfono inválido. Use dígitos, espacios, +, -, () o . (ej: +52 656 123 4567)"
	}
	return ""
}
