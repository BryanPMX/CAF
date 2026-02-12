// Package handlers: public contact/interest form from marketing site.
// Stores submission and notifies admins (with dedup to avoid duplicate notifications).
package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/BryanPMX/CAF/api/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ContactSubmitInput is the body for POST /api/v1/public/contact
type ContactSubmitInput struct {
	Name    string `json:"name" binding:"required,max=255"`
	Email   string `json:"email" binding:"required,email,max=255"`
	Phone   string `json:"phone" binding:"omitempty,max=50"`
	Message string `json:"message" binding:"required,max=5000"`
}

// SubmitContact is the public handler for marketing "Contacto" interest form.
// Rate-limited by ContactFormRateLimit. Creates a contact_submission and notifies all admins.
func SubmitContact(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input ContactSubmitInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos", "details": err.Error()})
			return
		}

		input.Name = strings.TrimSpace(input.Name)
		input.Email = strings.TrimSpace(strings.ToLower(input.Email))
		input.Phone = strings.TrimSpace(input.Phone)
		input.Message = strings.TrimSpace(input.Message)
		if input.Name == "" || input.Email == "" || input.Message == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nombre, correo y mensaje son obligatorios"})
			return
		}

		sub := models.ContactSubmission{
			Name:    input.Name,
			Email:   input.Email,
			Phone:   input.Phone,
			Message: input.Message,
			Source:  "contacto",
		}
		if err := db.Create(&sub).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al guardar el mensaje"})
			return
		}

		// Notify all admins with full contact info (dedup by submission id). Link to profile contactos section.
		msg := fmt.Sprintf("Nuevo interés desde Contacto: %s (%s). Mensaje: %s", input.Name, input.Email, truncate(input.Message, 200))
		link := "/app/profile#contactos"
		eid := sub.ID
		NotifyAdmins(db, msg, "info", &link, "contact_interest", &eid, fmt.Sprintf("contact_interest:%d", sub.ID))

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Mensaje enviado correctamente. Nos pondremos en contacto pronto.",
		})
	}
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "..."
}

// GetContactSubmissions returns contact form submissions for admins (paginated, newest first).
func GetContactSubmissions(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		page, _ := c.GetQuery("page")
		limit, _ := c.GetQuery("limit")
		pageNum := 1
		limitNum := 20
		if page != "" {
			if p, err := strconv.Atoi(page); err == nil && p > 0 {
				pageNum = p
			}
		}
		if limit != "" {
			if l, err := strconv.Atoi(limit); err == nil && l > 0 && l <= 100 {
				limitNum = l
			}
		}
		offset := (pageNum - 1) * limitNum

		var submissions []models.ContactSubmission
		var total int64
		if err := db.Model(&models.ContactSubmission{}).Count(&total).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al obtener total"})
			return
		}
		if err := db.Order("created_at DESC").Offset(offset).Limit(limitNum).Find(&submissions).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al listar intereses"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"data":       submissions,
			"total":      total,
			"page":       pageNum,
			"pageSize":   limitNum,
			"totalPages": (total + int64(limitNum) - 1) / int64(limitNum),
		})
	}
}

