// api/handlers/offices.go
package handlers

import (
	"net/http"

	"github.com/BryanPMX/CAF/api/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// OfficeInput defines the structure for creating or updating an office.
type OfficeInput struct {
	Name    string `json:"name" binding:"required"`
	Address string `json:"address"`
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

		office := models.Office{Name: input.Name, Address: input.Address}
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

		// Update the office record with the new data.
		db.Model(&office).Updates(models.Office{Name: input.Name, Address: input.Address})
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
