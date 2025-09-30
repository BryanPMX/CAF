// api/handlers/archive.go
package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/BryanPMX/CAF/api/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// CompleteCaseInput defines the structure for completing a case
type CompleteCaseInput struct {
	CompletionNote string `json:"completionNote" binding:"required"`
}

// CompleteCase marks a case as completed and triggers auto-archiving
func CompleteCase(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		caseIDStr := c.Param("id")
		caseID, err := strconv.ParseUint(caseIDStr, 10, 32)
		if err != nil || caseID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ID de caso inválido"})
			return
		}

		// Get current user
		currentUser, _ := c.Get("currentUser")
		user := currentUser.(models.User)

		// Check permissions - only admins and office managers can complete cases
		userRole, _ := c.Get("userRole")
		if userRole != "admin" && userRole != "office_manager" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Solo administradores y gerentes de oficina pueden completar casos"})
			return
		}

		// Get the case
		var caseRecord models.Case
		if err := db.Preload("Client").Preload("Office").Preload("PrimaryStaff").First(&caseRecord, caseID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "Caso no encontrado"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Error interno del servidor"})
			}
			return
		}

		// Check if case is already completed/archived
		if caseRecord.IsArchived {
			c.JSON(http.StatusBadRequest, gin.H{"error": "El caso ya está completado y archivado"})
			return
		}

		// Parse completion input
		var input CompleteCaseInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Datos de entrada inválidos", "details": err.Error()})
			return
		}

		// Update case to completed status
		now := time.Now()
		caseRecord.Status = "closed"
		caseRecord.IsArchived = true
		caseRecord.ArchiveReason = "completed"
		caseRecord.ArchivedAt = &now
		caseRecord.ArchivedBy = &user.ID
		caseRecord.UpdatedBy = &user.ID

		// Save the case
		if err := db.Save(&caseRecord).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al completar el caso"})
			return
		}

		// Create a case event for the completion
		caseEvent := models.CaseEvent{
			CaseID:      caseRecord.ID,
			UserID:      user.ID,
			EventType:   "completion",
			Description: "Caso Completado",
			CommentText: input.CompletionNote,
			Visibility:  "internal",
			CreatedAt:   now,
			UpdatedAt:   now,
		}

		if err := db.Create(&caseEvent).Error; err != nil {
			// Log error but don't fail the completion
			// In production, you might want to use a proper logging system
			// log.Printf("Warning: Failed to create completion event for case %d: %v", caseID, err)
		}

		// Load relationships for response
		if err := db.Preload("Client").Preload("Office").Preload("PrimaryStaff").First(&caseRecord, caseRecord.ID).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al cargar los datos del caso completado"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Caso completado y archivado exitosamente",
			"data":    caseRecord,
		})
	}
}
