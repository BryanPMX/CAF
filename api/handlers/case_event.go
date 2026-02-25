// api/handlers/case_event.go
// Handlers for case timeline events: comments and document uploads.
//
// Document operations (upload, get, delete) use the storage.FileStorage
// interface, supporting both S3 and local filesystem backends transparently
// via the Strategy Pattern.
package handlers

import (
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/BryanPMX/CAF/api/models"
	"github.com/BryanPMX/CAF/api/storage"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// CreateCommentInput defines the structure for adding a comment.
type CreateCommentInput struct {
	Comment    string `json:"comment" binding:"required"`
	Visibility string `json:"visibility" binding:"required"` // "internal" or "client_visible"
}

// UpdateCommentInput defines the structure for updating a comment.
type UpdateCommentInput struct {
	Comment    string `json:"comment" binding:"required"`
	Visibility string `json:"visibility" binding:"required"` // "internal" or "client_visible"
}

// CreateComment is an admin-only handler to add a comment to a case.
func CreateComment(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		caseIDStr := c.Param("id")
		caseID, err := strconv.ParseUint(caseIDStr, 10, 32)
		if err != nil || caseID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Caso inválido"})
			return
		}
		userID, _ := c.Get("userID")
		userIDUint, _ := strconv.ParseUint(userID.(string), 10, 32)

		// Validate case exists
		var caseRecord models.Case
		if err := db.First(&caseRecord, uint(caseID)).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Caso no encontrado"})
			return
		}

		var input CreateCommentInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		event := models.CaseEvent{
			CaseID:      uint(caseID),
			UserID:      uint(userIDUint),
			EventType:   "comment",
			Visibility:  input.Visibility,
			CommentText: input.Comment,
		}

		if err := db.Create(&event).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create comment"})
			return
		}

		// Invalidate case cache so the updated case data is fetched on next request
		invalidateCache(caseIDStr)

		// Generate notification for client if comment is client_visible
		if input.Visibility == "client_visible" && caseRecord.ClientID != nil {
			var client models.User
			if err := db.Where("id = ?", caseRecord.ClientID).First(&client).Error; err == nil {
				notificationMessage := "Un miembro de nuestro equipo ha añadido un comentario en su caso."
				caseLink := "/app/cases/" + strconv.FormatUint(uint64(caseID), 10)
				if err := CreateNotification(db, client.ID, notificationMessage, "info", &caseLink); err != nil {
					_ = err // Log but don't fail
				} else {
					eventCaseID := uint(caseID)
					SendUserNotification(strconv.FormatUint(uint64(client.ID), 10), map[string]interface{}{
						"message":    notificationMessage,
						"type":       "info",
						"link":       &caseLink,
						"entityType": "case",
						"entityId":   &eventCaseID,
					})
				}
			}
		}

		c.JSON(http.StatusCreated, event)
	}
}

// UpdateComment updates an existing comment
func UpdateComment(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		eventIDStr := c.Param("eventId")
		eventID, err := strconv.ParseUint(eventIDStr, 10, 32)
		if err != nil || eventID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ID de evento inválido"})
			return
		}

		// Get current user
		currentUser, _ := c.Get("currentUser")
		user := currentUser.(models.User)

		// Get the event
		var event models.CaseEvent
		if err := db.First(&event, eventID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				c.JSON(http.StatusNotFound, gin.H{"error": "Comentario no encontrado"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Error interno del servidor"})
			}
			return
		}

		if event.EventType != "comment" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Evento no es un comentario"})
			return
		}

		// Only the author can update their own comments
		if event.UserID != user.ID {
			c.JSON(http.StatusForbidden, gin.H{"error": "Solo puedes editar tus propios comentarios"})
			return
		}

		var input UpdateCommentInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		updates := map[string]interface{}{
			"comment_text": input.Comment,
			"visibility":   input.Visibility,
		}

		if err := db.Model(&event).Updates(updates).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al actualizar el comentario"})
			return
		}

		db.Preload("User").First(&event, eventID)
		invalidateCache(strconv.FormatUint(uint64(event.CaseID), 10))

		c.JSON(http.StatusOK, event)
	}
}

// DeleteComment deletes a comment
func DeleteComment(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		eventIDStr := c.Param("eventId")
		eventID, err := strconv.ParseUint(eventIDStr, 10, 32)
		if err != nil || eventID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ID de evento inválido"})
			return
		}

		currentUser, _ := c.Get("currentUser")
		_ = currentUser.(models.User)

		var event models.CaseEvent
		if err := db.First(&event, eventID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				c.JSON(http.StatusNotFound, gin.H{"error": "Comentario no encontrado"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Error interno del servidor"})
			}
			return
		}

		if event.EventType != "comment" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Evento no es un comentario"})
			return
		}

		// Only admins and office managers can delete comments
		userRole, _ := c.Get("userRole")
		if userRole != "admin" && userRole != "office_manager" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Solo administradores y gerentes de oficina pueden eliminar comentarios"})
			return
		}

		if err := db.Delete(&event).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al eliminar el comentario"})
			return
		}

		invalidateCache(strconv.FormatUint(uint64(event.CaseID), 10))
		c.JSON(http.StatusOK, gin.H{"message": "Comentario eliminado exitosamente"})
	}
}

// UploadDocument uploads a file to a case using the active storage provider
// (S3 or local filesystem). The storage backend is determined at startup.
func UploadDocument(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		caseIDStr := c.Param("id")
		caseID, err := strconv.ParseUint(caseIDStr, 10, 32)
		if err != nil || caseID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Caso inválido"})
			return
		}
		userID, _ := c.Get("userID")
		userIDUint, _ := strconv.ParseUint(userID.(string), 10, 32)

		// Validate case exists
		var caseRecord models.Case
		if err := db.First(&caseRecord, uint(caseID)).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Caso no encontrado"})
			return
		}

		file, err := c.FormFile("file")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "File is required"})
			return
		}

		visibility := c.PostForm("visibility")
		if visibility == "" {
			visibility = "internal"
		}

		// Use the active storage provider (Strategy Pattern)
		store := storage.GetActiveStorage()
		if store == nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Almacenamiento no disponible. Contacte al administrador."})
			return
		}

		fileURL, err := store.Upload(file, caseIDStr)
		if err != nil {
			log.Printf("ERROR: Document upload failed: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al subir el archivo"})
			return
		}

		// Create CaseEvent record in the database
		event := models.CaseEvent{
			CaseID:     uint(caseID),
			UserID:     uint(userIDUint),
			EventType:  "file_upload",
			Visibility: visibility,
			FileName:   file.Filename,
			FileUrl:    fileURL,
			FileType:   file.Header.Get("Content-Type"),
		}

		if err := db.Create(&event).Error; err != nil {
			// Attempt to clean up the uploaded file if DB insert fails
			if deleteErr := store.Delete(fileURL); deleteErr != nil {
				log.Printf("WARN: Failed to clean up file after DB error: %v", deleteErr)
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file record"})
			return
		}

		c.JSON(http.StatusCreated, event)
	}
}

// UpdateDocument updates document metadata (visibility, filename)
func UpdateDocument(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		eventIDStr := c.Param("eventId")
		eventID, err := strconv.ParseUint(eventIDStr, 10, 32)
		if err != nil || eventID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ID de evento inválido"})
			return
		}

		currentUser, _ := c.Get("currentUser")
		user := currentUser.(models.User)

		var event models.CaseEvent
		if err := db.First(&event, eventID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				c.JSON(http.StatusNotFound, gin.H{"error": "Documento no encontrado"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Error interno del servidor"})
			}
			return
		}

		if event.EventType != "file_upload" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Evento no es un documento"})
			return
		}

		// Only the author can update their own documents
		if event.UserID != user.ID {
			c.JSON(http.StatusForbidden, gin.H{"error": "Solo puedes editar tus propios documentos"})
			return
		}

		var input struct {
			FileName   string `json:"fileName"`
			Visibility string `json:"visibility"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		updates := map[string]interface{}{}
		if input.FileName != "" {
			updates["file_name"] = input.FileName
		}
		if input.Visibility != "" {
			updates["visibility"] = input.Visibility
		}

		if len(updates) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No se proporcionaron campos para actualizar"})
			return
		}

		if err := db.Model(&event).Updates(updates).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al actualizar el documento"})
			return
		}

		db.Preload("User").First(&event, eventID)
		c.JSON(http.StatusOK, event)
	}
}

// DeleteDocument deletes a document record and its file from storage.
// Uses the active storage provider for file deletion.
func DeleteDocument(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		eventIDStr := c.Param("eventId")
		eventID, err := strconv.ParseUint(eventIDStr, 10, 32)
		if err != nil || eventID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ID de evento inválido"})
			return
		}

		currentUser, _ := c.Get("currentUser")
		_ = currentUser.(models.User)

		var event models.CaseEvent
		if err := db.First(&event, eventID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				c.JSON(http.StatusNotFound, gin.H{"error": "Documento no encontrado"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Error interno del servidor"})
			}
			return
		}

		if event.EventType != "file_upload" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Evento no es un documento"})
			return
		}

		// Only admins and office managers can delete documents
		userRole, _ := c.Get("userRole")
		if userRole != "admin" && userRole != "office_manager" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Solo administradores y gerentes de oficina pueden eliminar documentos"})
			return
		}

		// Delete file from storage using the active provider
		if event.FileUrl != "" {
			store := storage.GetActiveStorage()
			if store != nil {
				if deleteErr := store.Delete(event.FileUrl); deleteErr != nil {
					log.Printf("WARN: Failed to delete file from storage: %v", deleteErr)
					// Continue with DB record deletion even if file deletion fails
				}
			} else {
				log.Printf("WARN: No storage provider available; skipping file deletion for URL: %s", event.FileUrl)
			}
		}

		// Soft delete the document record
		if err := db.Delete(&event).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al eliminar el documento"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Documento eliminado exitosamente"})
	}
}

// GetDocument retrieves a document for viewing/downloading using the
// active storage provider.
func GetDocument(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		eventIDStr := c.Param("eventId")
		mode := c.Query("mode") // "preview" or "download"

		// Check if user is authenticated
		_, exists := c.Get("currentUser")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Usuario no autenticado"})
			return
		}

		if c.Request.Header.Get("User-Agent") == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "User-Agent header required"})
			return
		}

		eventID, err := strconv.ParseUint(eventIDStr, 10, 32)
		if err != nil || eventID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ID de evento inválido"})
			return
		}

		// Get the case event
		var event models.CaseEvent
		if err := db.Select("id, case_id, event_type, visibility, file_url, file_name, file_type, updated_at").First(&event, eventID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				c.JSON(http.StatusNotFound, gin.H{"error": "Documento no encontrado"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Error interno del servidor"})
			}
			return
		}

		if event.EventType != "file_upload" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Evento no es un documento"})
			return
		}

		// Check access permissions based on visibility
		userRole, _ := c.Get("userRole")
		if event.Visibility == "internal" && userRole == "client" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Acceso denegado: documento interno"})
			return
		}
		if userRole == "client" {
			userID, _ := c.Get("userID")
			var count int64
			if err := db.Model(&models.Case{}).
				Where("id = ? AND client_id = ?", event.CaseID, userID).
				Count(&count).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al validar acceso al documento"})
				return
			}
			if count == 0 {
				c.JSON(http.StatusForbidden, gin.H{"error": "Acceso denegado: documento no pertenece a su caso"})
				return
			}
		}

		// Use the active storage provider to retrieve the file
		store := storage.GetActiveStorage()
		if store == nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Almacenamiento no disponible"})
			return
		}

		body, contentType, err := store.Get(event.FileUrl)
		if err != nil {
			log.Printf("ERROR: Failed to retrieve document: %v", err)
			c.JSON(http.StatusNotFound, gin.H{"error": "Archivo no encontrado en almacenamiento"})
			return
		}
		defer body.Close()

		// Use stored content type if available, fall back to detected type
		if event.FileType != "" {
			contentType = event.FileType
		}
		c.Header("Content-Type", contentType)

		// Determine content disposition based on mode and file type
		fileExt := strings.ToLower(filepath.Ext(event.FileName))
		canPreview := isPreviewableFile(fileExt)

		if mode == "download" || !canPreview {
			c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", event.FileName))
		} else {
			c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", event.FileName))
		}

		// Security headers
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("X-XSS-Protection", "1; mode=block")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")

		// Caching headers
		if mode == "preview" && canPreview {
			c.Header("Cache-Control", "public, max-age=3600")
			c.Header("ETag", fmt.Sprintf("\"%d-%s\"", event.ID, event.UpdatedAt.Format("20060102150405")))
		} else {
			c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
			c.Header("Pragma", "no-cache")
			c.Header("Expires", "0")
		}

		// Stream the file content to the response
		if _, err = io.Copy(c.Writer, body); err != nil {
			log.Printf("ERROR: Failed to stream document: %v", err)
			// Don't try to send JSON here — headers are already written
			return
		}
	}
}

// isPreviewableFile determines if a file type can be previewed in the browser
func isPreviewableFile(extension string) bool {
	previewableExtensions := map[string]bool{
		".pdf":  true,
		".jpg":  true,
		".jpeg": true,
		".png":  true,
		".gif":  true,
		".webp": true,
		".svg":  true,
		".txt":  true,
		".html": true,
		".htm":  true,
	}
	return previewableExtensions[extension]
}
