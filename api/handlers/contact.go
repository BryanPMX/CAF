// Package handlers: public contact/interest form from marketing site.
// Creates or finds a client user, stores submission linked to that user, and notifies admins.
package handlers

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/BryanPMX/CAF/api/models"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// ContactSubmitInput is the body for POST /api/v1/public/contact
type ContactSubmitInput struct {
	Name    string `json:"name" binding:"required,max=255"`
	Email   string `json:"email" binding:"required,email,max=255"`
	Phone   string `json:"phone" binding:"omitempty,max=50"`
	Message string `json:"message" binding:"required,max=5000"`
	OfficeID *uint `json:"officeId" binding:"omitempty"` // optional: selected office from dropdown
}

// findOrCreateClientUser finds an existing client by email or creates a new client user.
// Name is split into firstName and lastName (first word / rest; if single word, lastName = firstName).
// Returns the user ID and nil error, or 0 and error.
func findOrCreateClientUser(db *gorm.DB, name, email, phone string, officeID *uint) (uint, error) {
	firstName, lastName := splitName(name)
	if lastName == "" {
		lastName = firstName
	}

	var existing models.User
	err := db.Unscoped().Where("email = ? AND role = ?", email, "client").First(&existing).Error
	if err == nil {
		// Update if needed and reactivate if soft-deleted
		existing.FirstName = firstName
		existing.LastName = lastName
		existing.Phone = phone
		existing.OfficeID = officeID
		existing.DeletedAt = gorm.DeletedAt{}
		if err := db.Unscoped().Save(&existing).Error; err != nil {
			return 0, err
		}
		return existing.ID, nil
	}
	if err != gorm.ErrRecordNotFound {
		return 0, err
	}

	// Create new client with a random unusable password (no login until reset)
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return 0, err
	}
	rawPass := base64.URLEncoding.EncodeToString(b)
	hashed, err := bcrypt.GenerateFromPassword([]byte(rawPass), bcrypt.DefaultCost)
	if err != nil {
		return 0, err
	}

	user := models.User{
		FirstName: firstName,
		LastName:  lastName,
		Email:     email,
		Password:  string(hashed),
		Role:      "client",
		OfficeID:  officeID,
		Phone:     phone,
		IsActive:  true,
	}
	if err := db.Create(&user).Error; err != nil {
		return 0, err
	}
	return user.ID, nil
}

func splitName(name string) (first, last string) {
	name = strings.TrimSpace(name)
	i := strings.IndexFunc(name, func(r rune) bool { return r == ' ' || r == '\t' })
	if i <= 0 {
		return name, ""
	}
	return strings.TrimSpace(name[:i]), strings.TrimSpace(name[i+1:])
}

// SubmitContact is the public handler for marketing "Contacto" interest form.
// Rate-limited. Finds or creates a client user, creates contact_submission linked to that user, notifies admins with link to client profile.
func SubmitContact(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input ContactSubmitInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos", "details": err.Error()})
			return
		}

		input.Name = strings.TrimSpace(sanitizePrintable(input.Name))
		input.Email = strings.TrimSpace(strings.ToLower(input.Email))
		input.Phone = strings.TrimSpace(sanitizePrintable(input.Phone))
		input.Message = strings.TrimSpace(sanitizePrintable(input.Message))
		if input.Name == "" || input.Email == "" || input.Message == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nombre, correo y mensaje son obligatorios"})
			return
		}
		if len(input.Name) > 255 || len(input.Message) > 5000 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
			return
		}

		clientID, err := findOrCreateClientUser(db, input.Name, input.Email, input.Phone, input.OfficeID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al registrar el contacto"})
			return
		}

		sub := models.ContactSubmission{
			Name:    input.Name,
			Email:   input.Email,
			Phone:   input.Phone,
			Message: input.Message,
			Source:  "contacto",
			OfficeID: input.OfficeID,
			UserID:  &clientID,
		}
		if err := db.Create(&sub).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al guardar el mensaje"})
			return
		}

		// Notify all admins and the manager(s) of the selected office (if any); link to client profile
		msg := fmt.Sprintf("Nuevo interés desde Contacto: %s (%s). Mensaje: %s", input.Name, input.Email, truncate(input.Message, 200))
		link := fmt.Sprintf("/app/users/%d", clientID)
		eid := sub.ID
		NotifyAdminsAndOfficeManagersForContact(db, msg, "info", &link, "contact_interest", &eid, fmt.Sprintf("contact_interest:%d", sub.ID), input.OfficeID)

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Mensaje enviado correctamente. Nos pondremos en contacto pronto.",
		})
	}
}

// sanitizePrintable keeps only printable ASCII and common UTF-8 (letters, numbers, punctuation, newlines).
// Strips null bytes and control chars to prevent injection.
func sanitizePrintable(s string) string {
	return strings.Map(func(r rune) rune {
		if r == 0 || r == '\x00' {
			return -1
		}
		if r < 32 && r != '\n' && r != '\r' && r != '\t' {
			return -1
		}
		if r > 0x7F && r < 0xA0 {
			return -1
		}
		return r
	}, s)
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

