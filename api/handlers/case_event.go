// api/handlers/case_events.go
package handlers

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/BryanPMX/CAF/api/models"
	"github.com/BryanPMX/CAF/api/storage"
	"github.com/aws/aws-sdk-go-v2/service/s3"
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

		// Generate notification for client if comment is client_visible
		if input.Visibility == "client_visible" {
			// Get the client ID from the case
			var client models.User
			if err := db.Where("id = ?", caseRecord.ClientID).First(&client).Error; err == nil {
				// Create notification message in Spanish
				notificationMessage := "Un miembro de nuestro equipo ha añadido un comentario en su caso."

				// Create link to the case
				caseLink := "/app/cases/" + strconv.FormatUint(uint64(caseID), 10)

				// Create notification for the client
				if err := CreateNotification(db, client.ID, notificationMessage, "info", &caseLink); err != nil {
					// Log error but don't fail the comment creation
					_ = err // Suppress unused variable warning
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

		// Check if it's a comment
		if event.EventType != "comment" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Evento no es un comentario"})
			return
		}

		// Check permissions: only the author can update their own comments
		if event.UserID != user.ID {
			c.JSON(http.StatusForbidden, gin.H{"error": "Solo puedes editar tus propios comentarios"})
			return
		}

		var input UpdateCommentInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Update the comment
		updates := map[string]interface{}{
			"comment_text": input.Comment,
			"visibility":   input.Visibility,
		}

		if err := db.Model(&event).Updates(updates).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al actualizar el comentario"})
			return
		}

		// Reload the event with user info
		db.Preload("User").First(&event, eventID)

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

		// Get current user
		currentUser, _ := c.Get("currentUser")
		_ = currentUser.(models.User) // Use blank identifier to avoid unused variable

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

		// Check if it's a comment
		if event.EventType != "comment" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Evento no es un comentario"})
			return
		}

		// Check permissions: only admins and office managers can delete
		userRole, _ := c.Get("userRole")
		if userRole != "admin" && userRole != "office_manager" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Solo administradores y gerentes de oficina pueden eliminar comentarios"})
			return
		}

		// Soft delete the comment
		if err := db.Delete(&event).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al eliminar el comentario"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Comentario eliminado exitosamente"})
	}
}

// UploadDocument is an admin-only handler to upload a file to a case.
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
			visibility = "internal" // Default to internal
		}

		// Upload file to S3
		fileURL, err := storage.UploadFile(file, caseIDStr)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
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

		// Get current user
		currentUser, _ := c.Get("currentUser")
		user := currentUser.(models.User)

		// Get the event
		var event models.CaseEvent
		if err := db.First(&event, eventID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				c.JSON(http.StatusNotFound, gin.H{"error": "Documento no encontrado"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Error interno del servidor"})
			}
			return
		}

		// Check if it's a file upload
		if event.EventType != "file_upload" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Evento no es un documento"})
			return
		}

		// Check permissions: only the author can update their own documents
		if event.UserID != user.ID {
			c.JSON(http.StatusForbidden, gin.H{"error": "Solo puedes editar tus propios documentos"})
			return
		}

		// Parse update input
		var input struct {
			FileName   string `json:"fileName"`
			Visibility string `json:"visibility"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Update the document metadata
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

		// Reload the event with user info
		db.Preload("User").First(&event, eventID)

		c.JSON(http.StatusOK, event)
	}
}

// DeleteDocument deletes a document and its file from S3
func DeleteDocument(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		eventIDStr := c.Param("eventId")
		eventID, err := strconv.ParseUint(eventIDStr, 10, 32)
		if err != nil || eventID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ID de evento inválido"})
			return
		}

		// Get current user
		currentUser, _ := c.Get("currentUser")
		_ = currentUser.(models.User) // Use blank identifier to avoid unused variable

		// Get the event
		var event models.CaseEvent
		if err := db.First(&event, eventID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				c.JSON(http.StatusNotFound, gin.H{"error": "Documento no encontrado"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Error interno del servidor"})
			}
			return
		}

		// Check if it's a file upload
		if event.EventType != "file_upload" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Evento no es un documento"})
			return
		}

		// Check permissions: only admins and office managers can delete
		userRole, _ := c.Get("userRole")
		if userRole != "admin" && userRole != "office_manager" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Solo administradores y gerentes de oficina pueden eliminar documentos"})
			return
		}

		// Delete file from S3
		if event.FileUrl != "" {
			// Extract object key from URL
			parts := strings.Split(event.FileUrl, "/")
			if len(parts) >= 4 {
				bucketIndex := -1
				for i, part := range parts {
					if part == "caf-system-bucket" {
						bucketIndex = i
						break
					}
				}

				if bucketIndex != -1 && bucketIndex+2 < len(parts) {
					objectKey := strings.Join(parts[bucketIndex+1:], "/")
					bucket := os.Getenv("S3_BUCKET")
					if bucket == "" {
						bucket = "caf-system-bucket"
					}

					s3Client := storage.GetS3Client()
					if s3Client != nil {
						_, deleteErr := s3Client.DeleteObject(context.TODO(), &s3.DeleteObjectInput{
							Bucket: &bucket,
							Key:    &objectKey,
						})
						if deleteErr != nil {
							// Log the error but don't fail the request
							log.Printf("Warning: Failed to delete file from S3: %v", deleteErr)
						}
					}
				}
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

// GetDocument retrieves a document for viewing/downloading
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

		// Simple rate limiting - in production, use Redis or similar
		// For now, we'll just validate the request
		if c.Request.Header.Get("User-Agent") == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "User-Agent header required"})
			return
		}

		eventID, err := strconv.ParseUint(eventIDStr, 10, 32)
		if err != nil || eventID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ID de evento inválido"})
			return
		}

		// Get the case event with optimized query
		var event models.CaseEvent
		if err := db.Select("id, event_type, visibility, file_url, file_name, file_type").First(&event, eventID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				c.JSON(http.StatusNotFound, gin.H{"error": "Documento no encontrado"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Error interno del servidor"})
			}
			return
		}

		// Check if it's a file upload event
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

		// Extract the object key from the file URL
		// The URL format is: http://localstack:4566/bucket-name/cases/caseID/filename
		// We need to extract the object key part: cases/caseID/filename
		fileURL := event.FileUrl
		parts := strings.Split(fileURL, "/")
		if len(parts) < 4 {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "URL de archivo inválida"})
			return
		}

		// Find the bucket name and extract the object key
		// The URL structure is: http://endpoint/bucket/cases/caseID/filename
		bucketIndex := -1
		for i, part := range parts {
			if part == "caf-system-bucket" {
				bucketIndex = i
				break
			}
		}

		if bucketIndex == -1 || bucketIndex+2 >= len(parts) {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Formato de URL de archivo inválido"})
			return
		}

		// Extract the object key: everything after the bucket name
		objectKey := strings.Join(parts[bucketIndex+1:], "/")

		// Get the file from S3
		bucket := os.Getenv("S3_BUCKET")
		if bucket == "" {
			bucket = "caf-system-bucket" // fallback
		}

		// Get the S3 client
		s3Client := storage.GetS3Client()
		if s3Client == nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Cliente S3 no disponible"})
			return
		}

		// Get the object from S3
		result, err := s3Client.GetObject(context.TODO(), &s3.GetObjectInput{
			Bucket: &bucket,
			Key:    &objectKey,
		})
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Archivo no encontrado en S3"})
			return
		}
		defer result.Body.Close()

		// Set appropriate headers for file download/viewing
		c.Header("Content-Type", event.FileType)

		// Determine content disposition based on mode and file type
		fileExt := strings.ToLower(filepath.Ext(event.FileName))
		canPreview := isPreviewableFile(fileExt)

		if mode == "download" || !canPreview {
			// Force download for all files or when download mode is requested
			c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", event.FileName))
		} else {
			// Preview mode for supported file types
			c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", event.FileName))
		}

		// Add security headers
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("X-XSS-Protection", "1; mode=block")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")

		// Add caching headers for better performance
		if mode == "preview" && canPreview {
			c.Header("Cache-Control", "public, max-age=3600") // Cache for 1 hour
			c.Header("ETag", fmt.Sprintf("\"%d-%s\"", event.ID, event.UpdatedAt.Format("20060102150405")))
		} else {
			c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
			c.Header("Pragma", "no-cache")
			c.Header("Expires", "0")
		}

		// Stream the file content to the response
		_, err = io.Copy(c.Writer, result.Body)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al transmitir el archivo"})
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
