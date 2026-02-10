// api/handlers/offices.go
package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/BryanPMX/CAF/api/interfaces"
	"github.com/BryanPMX/CAF/api/models"
	"github.com/gin-gonic/gin"
)

// OfficeInput defines the structure for creating or updating an office.
type OfficeInput struct {
	Name      string   `json:"name" binding:"required"`
	Address   string   `json:"address"`
	Latitude  *float64 `json:"latitude"`
	Longitude *float64 `json:"longitude"`
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
		office := &models.Office{
			Name:      input.Name,
			Address:   input.Address,
			Latitude:  input.Latitude,
			Longitude: input.Longitude,
			Code:      repo.GenerateUniqueCode(c.Request.Context(), input.Name, 0),
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
		office.Name = input.Name
		office.Address = input.Address
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
		if err := repo.Delete(c.Request.Context(), id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete office."})
			return
		}
		c.Status(http.StatusNoContent)
	}
}

func parseOfficeID(s string) (uint, error) {
	id, err := strconv.ParseUint(s, 10, 32)
	if err != nil {
		return 0, err
	}
	return uint(id), nil
}
