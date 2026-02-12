// api/handlers/site_content.go
// HTTP handlers for the CMS (Content Management System).
// Public endpoints (no auth) serve content to the marketing website.
// Admin endpoints (JWT + role check) provide CRUD for the admin portal.
//
// Follows SRP: this file only handles site content HTTP concerns.
// Follows DIP: image uploads delegate to storage.FileStorage interface.
package handlers

import (
	"fmt"
	"log"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/BryanPMX/CAF/api/models"
	"github.com/BryanPMX/CAF/api/storage"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ──────────────────────────────────────────────
// PUBLIC ENDPOINTS (no authentication required)
// ──────────────────────────────────────────────

// GetPublicSiteContent returns all active content grouped by section.
func GetPublicSiteContent(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		section := c.Query("section") // optional filter

		var items []models.SiteContent
		q := db.Where("is_active = ?", true).Order("section, sort_order")
		if section != "" {
			q = q.Where("section = ?", section)
		}

		if err := q.Find(&items).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al obtener contenido"})
			return
		}

		// Group by section for convenience
		grouped := make(map[string][]models.SiteContent)
		for _, item := range items {
			grouped[item.Section] = append(grouped[item.Section], item)
		}

		c.JSON(http.StatusOK, gin.H{"content": grouped})
	}
}

// GetPublicSiteServices returns active services ordered by id (creation order).
func GetPublicSiteServices(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var services []models.SiteService
		if err := db.Where("is_active = ?", true).Order("id").Find(&services).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al obtener servicios"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"services": services})
	}
}

// GetPublicSiteEvents returns active upcoming events.
func GetPublicSiteEvents(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		now := time.Now()
		var events []models.SiteEvent
		if err := db.Where("is_active = ? AND event_date >= ?", true, now).
			Order("event_date ASC").Find(&events).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al obtener eventos"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"events": events})
	}
}

// GetPublicSiteImages returns active images, optionally filtered by section.
func GetPublicSiteImages(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		section := c.Query("section")
		var images []models.SiteImage
		q := db.Where("is_active = ?", true).Order("section, id")
		if section != "" {
			q = q.Where("section = ?", section)
		}
		if err := q.Find(&images).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al obtener imágenes"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"images": images})
	}
}

// ──────────────────────────────────────────────
// ADMIN ENDPOINTS (JWT + role-based auth)
// ──────────────────────────────────────────────

// --- Site Content CRUD ---

// GetAllSiteContent returns all content (including inactive) for admin.
func GetAllSiteContent(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var items []models.SiteContent
		if err := db.Order("section, sort_order").Find(&items).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al obtener contenido"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"content": items})
	}
}

// UpsertSiteContent creates or updates a content entry (upsert by section+key).
func UpsertSiteContent(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input models.SiteContent
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		if input.Section == "" || input.ContentKey == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "section y contentKey son requeridos"})
			return
		}

		// Sanitize HTML content
		if input.ContentType == "html" {
			input.ContentValue = sanitizeHTML(input.ContentValue)
		}

		userID := extractUserID(c)

		// Upsert: find existing or create new
		var existing models.SiteContent
		result := db.Where("section = ? AND content_key = ?", input.Section, input.ContentKey).First(&existing)

		if result.Error == nil {
			// Update existing
			updates := map[string]interface{}{
				"content_value": input.ContentValue,
				"content_type":  input.ContentType,
				"sort_order":    input.SortOrder,
				"is_active":     input.IsActive,
				"updated_by":    userID,
			}
			if err := db.Model(&existing).Updates(updates).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al actualizar contenido"})
				return
			}
			db.First(&existing, existing.ID)
			c.JSON(http.StatusOK, existing)
		} else {
			// Create new
			input.UpdatedBy = userID
			if err := db.Create(&input).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al crear contenido"})
				return
			}
			c.JSON(http.StatusCreated, input)
		}
	}
}

// DeleteSiteContent soft-deletes a content entry.
func DeleteSiteContent(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := parseIDParam(c)
		if err != nil {
			return
		}
		var item models.SiteContent
		if err := db.First(&item, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Contenido no encontrado"})
			return
		}
		if err := db.Delete(&item).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al eliminar contenido"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Contenido eliminado exitosamente"})
	}
}

// --- Site Services CRUD ---

// GetAllSiteServices returns all services (including inactive) for admin.
func GetAllSiteServices(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var items []models.SiteService
		if err := db.Order("id").Find(&items).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al obtener servicios"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"services": items})
	}
}

// CreateSiteService creates a new service.
func CreateSiteService(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input models.SiteService
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if input.Title == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "El título es requerido"})
			return
		}
		input.CreatedBy = extractUserIDUint(c)
		input.IsActive = true
		if err := db.Create(&input).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al crear servicio"})
			return
		}
		c.JSON(http.StatusCreated, input)
	}
}

// UpdateSiteService updates an existing service.
func UpdateSiteService(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := parseIDParam(c)
		if err != nil {
			return
		}
		var item models.SiteService
		if err := db.First(&item, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Servicio no encontrado"})
			return
		}

		var input models.SiteService
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		uid := extractUserID(c)
		updates := map[string]interface{}{
			"title":       input.Title,
			"description": input.Description,
			"details":     input.Details,
			"icon":        input.Icon,
			"image_url":   input.ImageURL,
			"is_active":   input.IsActive,
			"updated_by":  uid,
		}
		if err := db.Model(&item).Updates(updates).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al actualizar servicio"})
			return
		}
		db.First(&item, id)
		c.JSON(http.StatusOK, item)
	}
}

// DeleteSiteService soft-deletes a service.
func DeleteSiteService(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := parseIDParam(c)
		if err != nil {
			return
		}
		var item models.SiteService
		if err := db.First(&item, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Servicio no encontrado"})
			return
		}
		if err := db.Delete(&item).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al eliminar servicio"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Servicio eliminado exitosamente"})
	}
}

// --- Site Events CRUD ---

// GetAllSiteEvents returns all events (including past) for admin.
func GetAllSiteEvents(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var items []models.SiteEvent
		if err := db.Order("event_date DESC").Find(&items).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al obtener eventos"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"events": items})
	}
}

// CreateSiteEvent creates a new public event.
func CreateSiteEvent(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input models.SiteEvent
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if input.Title == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "El título es requerido"})
			return
		}
		if input.EventDate.IsZero() {
			c.JSON(http.StatusBadRequest, gin.H{"error": "La fecha del evento es requerida"})
			return
		}
		input.CreatedBy = extractUserIDUint(c)
		input.IsActive = true
		if err := db.Create(&input).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al crear evento"})
			return
		}
		c.JSON(http.StatusCreated, input)
	}
}

// UpdateSiteEvent updates an existing event.
func UpdateSiteEvent(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := parseIDParam(c)
		if err != nil {
			return
		}
		var item models.SiteEvent
		if err := db.First(&item, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Evento no encontrado"})
			return
		}

		var input models.SiteEvent
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		uid := extractUserID(c)
		updates := map[string]interface{}{
			"title":       input.Title,
			"description": input.Description,
			"event_date":  input.EventDate,
			"end_date":    input.EndDate,
			"location":    input.Location,
			"image_url":   input.ImageURL,
			"is_active":   input.IsActive,
			"updated_by":  uid,
		}
		if err := db.Model(&item).Updates(updates).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al actualizar evento"})
			return
		}
		db.First(&item, id)
		c.JSON(http.StatusOK, item)
	}
}

// DeleteSiteEvent soft-deletes an event.
func DeleteSiteEvent(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := parseIDParam(c)
		if err != nil {
			return
		}
		var item models.SiteEvent
		if err := db.First(&item, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Evento no encontrado"})
			return
		}
		if err := db.Delete(&item).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al eliminar evento"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Evento eliminado exitosamente"})
	}
}

// --- Site Images CRUD ---

// GetAllSiteImages returns all images (including inactive) for admin.
func GetAllSiteImages(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var items []models.SiteImage
		if err := db.Order("section, id").Find(&items).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al obtener imágenes"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"images": items})
	}
}

// CreateSiteImage creates a new image entry.
func CreateSiteImage(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input models.SiteImage
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if input.ImageURL == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "La URL de imagen es requerida"})
			return
		}
		input.CreatedBy = extractUserIDUint(c)
		input.IsActive = true
		if err := db.Create(&input).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al crear imagen"})
			return
		}
		c.JSON(http.StatusCreated, input)
	}
}

// UpdateSiteImage updates an existing image entry.
func UpdateSiteImage(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := parseIDParam(c)
		if err != nil {
			return
		}
		var item models.SiteImage
		if err := db.First(&item, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Imagen no encontrada"})
			return
		}

		var input models.SiteImage
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		uid := extractUserID(c)
		updates := map[string]interface{}{
			"title":      input.Title,
			"alt_text":   input.AltText,
			"image_url":  input.ImageURL,
			"section":    input.Section,
			"is_active":  input.IsActive,
			"updated_by": uid,
		}
		if err := db.Model(&item).Updates(updates).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al actualizar imagen"})
			return
		}
		db.First(&item, id)
		c.JSON(http.StatusOK, item)
	}
}

// DeleteSiteImage soft-deletes an image.
func DeleteSiteImage(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := parseIDParam(c)
		if err != nil {
			return
		}
		var item models.SiteImage
		if err := db.First(&item, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Imagen no encontrada"})
			return
		}
		if err := db.Delete(&item).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al eliminar imagen"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Imagen eliminada exitosamente"})
	}
}

// UploadSiteImage handles file upload for CMS images via multipart form.
// Uses the active FileStorage provider (S3 or local).
func UploadSiteImage(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		file, err := c.FormFile("file")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Archivo requerido"})
			return
		}

		// Validate file type
		ext := strings.ToLower(filepath.Ext(file.Filename))
		allowedExts := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true, ".svg": true}
		if !allowedExts[ext] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tipo de archivo no permitido. Use: jpg, png, gif, webp, svg"})
			return
		}

		// Validate file size (max 10MB)
		if file.Size > 10*1024*1024 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Archivo demasiado grande. Máximo 10MB"})
			return
		}

		fileURL, err := uploadCMSFile(file)
		if err != nil {
			log.Printf("ERROR: CMS image upload failed: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al subir la imagen"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"url": fileURL})
	}
}

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────

// uploadCMSFile saves a file using the active storage provider with a "site" prefix.
func uploadCMSFile(file *multipart.FileHeader) (string, error) {
	store := storage.GetActiveStorage()
	if store == nil {
		return "", fmt.Errorf("no storage provider available")
	}
	// Use "site" as the "caseID" parameter to store under site/ prefix
	// This keeps CMS uploads separate from case documents.
	return store.Upload(file, "site-content-"+uuid.New().String()[:8])
}

// parseIDParam extracts and validates the :id route parameter.
func parseIDParam(c *gin.Context) (uint, error) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil || id == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID inválido"})
		return 0, fmt.Errorf("invalid ID")
	}
	return uint(id), nil
}

// extractUserID returns the user ID as *uint from the context.
func extractUserID(c *gin.Context) *uint {
	userIDVal, _ := c.Get("userID")
	if userIDStr, ok := userIDVal.(string); ok {
		if id, err := strconv.ParseUint(userIDStr, 10, 32); err == nil {
			uid := uint(id)
			return &uid
		}
	}
	return nil
}

// extractUserIDUint returns the user ID as uint from the context.
func extractUserIDUint(c *gin.Context) uint {
	uid := extractUserID(c)
	if uid != nil {
		return *uid
	}
	return 0
}
