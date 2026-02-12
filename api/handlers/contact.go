// Package handlers: public contact/interest form from marketing site.
// Stores submission and notifies admins (with dedup to avoid duplicate notifications).
package handlers

import (
	"fmt"
	"net/http"
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

		// Notify all admins with full contact info (dedup by submission id)
		msg := fmt.Sprintf("Nuevo interés desde Contacto: %s (%s). Mensaje: %s", input.Name, input.Email, truncate(input.Message, 200))
		link := "/app/notifications"
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
