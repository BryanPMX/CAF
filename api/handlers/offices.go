// api/handlers/offices.go
package handlers

import (
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/BryanPMX/CAF/api/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// uniqueCodeFromName generates a short, URL-style code from name and ensures it is unique in the DB.
// Used so multiple offices (e.g. "CAF Office 1", "CAF Office 2") never share the same empty code and hit a unique constraint.
func uniqueCodeFromName(db *gorm.DB, name string, excludeID uint) string {
	base := strings.ToLower(name)
	base = regexp.MustCompile(`[^a-z0-9]+`).ReplaceAllString(base, "-")
	base = strings.Trim(base, "-")
	if base == "" {
		base = "office"
	}
	code := base
	suffix := 1
	for {
		var count int64
		q := db.Model(&models.Office{}).Where("code = ?", code)
		if excludeID != 0 {
			q = q.Where("id != ?", excludeID)
		}
		q.Count(&count)
		if count == 0 {
			break
		}
		suffix++
		code = base + "-" + strconv.Itoa(suffix)
	}
	return code
}

// OfficeInput defines the structure for creating or updating an office.
type OfficeInput struct {
	Name      string   `json:"name" binding:"required"`
	Address   string   `json:"address"`
	Latitude  *float64 `json:"latitude"`
	Longitude *float64 `json:"longitude"`
}

// --- CRUD Handlers for Offices ---

// GetOfficeByID retrieves a single office by its ID
func GetOfficeByID(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		officeID := c.Param("id")
		var office models.Office

		if err := db.Where("id = ?", officeID).First(&office).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Office not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"data": office})
	}
}

// CreateOffice is an admin-only handler to add a new office location.
func CreateOffice(db *gorm.DB) gin.HandlerFunc {
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

		var count int64
		if err := db.Model(&models.Office{}).Where("name = ?", input.Name).Count(&count).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create office."})
			return
		}
		if count > 0 {
			c.JSON(http.StatusConflict, gin.H{"error": "Ya existe una oficina con ese nombre. Usa un nombre distinto."})
			return
		}

		office := models.Office{
			Name:      input.Name,
			Address:   input.Address,
			Latitude:  input.Latitude,
			Longitude: input.Longitude,
			Code:      uniqueCodeFromName(db, input.Name, 0),
		}
		if err := db.Create(&office).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create office."})
			return
		}

		c.JSON(http.StatusCreated, office)
	}
}

// GetOffices is an admin-only handler to retrieve all office locations.
func GetOffices(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Initialize with empty slice to prevent null JSON response
		offices := make([]models.Office, 0)
		if err := db.Find(&offices).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve offices."})
			return
		}
		c.JSON(http.StatusOK, offices)
	}
}

// GetPublicOffices returns all non-deleted offices without authentication.
// Used by the public marketing site to display office locations on a map.
// Filters out soft-deleted offices (deleted_at IS NULL).
func GetPublicOffices(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		offices := make([]models.Office, 0)
		if err := db.Where("deleted_at IS NULL").Find(&offices).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve offices."})
			return
		}
		c.JSON(http.StatusOK, offices)
	}
}

// UpdateOffice is an admin-only handler to modify an existing office.
func UpdateOffice(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var office models.Office
		// First, find the office by its ID from the URL parameter.
		if err := db.Where("id = ?", c.Param("id")).First(&office).Error; err != nil {
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

		var count int64
		if err := db.Model(&models.Office{}).Where("name = ? AND id != ?", input.Name, office.ID).Count(&count).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update office."})
			return
		}
		if count > 0 {
			c.JSON(http.StatusConflict, gin.H{"error": "Ya existe otra oficina con ese nombre. Usa un nombre distinto."})
			return
		}

		// Update the office record with the new data.
		updates := map[string]interface{}{
			"name":    input.Name,
			"address": input.Address,
			"code":    uniqueCodeFromName(db, input.Name, office.ID),
		}
		if input.Latitude != nil {
			updates["latitude"] = *input.Latitude
		} else {
			updates["latitude"] = nil
		}
		if input.Longitude != nil {
			updates["longitude"] = *input.Longitude
		} else {
			updates["longitude"] = nil
		}
		db.Model(&office).Updates(updates)
		c.JSON(http.StatusOK, office)
	}
}

// DeleteOffice is an admin-only handler to remove an office.
func DeleteOffice(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var office models.Office
		if err := db.Where("id = ?", c.Param("id")).First(&office).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Office not found."})
			return
		}

		db.Delete(&office)
		// A 204 No Content response is standard for a successful deletion.
		c.Status(http.StatusNoContent)
	}
}
