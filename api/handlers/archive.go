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

// ArchiveCaseInput defines the structure for manually archiving a case
type ArchiveCaseInput struct {
	ArchiveReason string `json:"archiveReason" binding:"required"`
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

		// Check if case is already completed
		if caseRecord.IsCompleted {
			c.JSON(http.StatusBadRequest, gin.H{"error": "El caso ya está completado"})
			return
		}

		// Parse input
		var input CompleteCaseInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Complete the case
		caseRecord.Complete(user.ID, input.CompletionNote)

		// Save the case
		if err := db.Save(&caseRecord).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al completar el caso"})
			return
		}

		// Auto-archive the case
		caseRecord.Archive(user.ID, "completed")
		if err := db.Save(&caseRecord).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al archivar el caso"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Caso completado y archivado exitosamente",
			"case":    caseRecord,
		})
	}
}

// GetArchivedCases retrieves all archived cases with filtering
func GetArchivedCases(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Check permissions - only admins and office managers can view archives
		userRole, _ := c.Get("userRole")
		if userRole != "admin" && userRole != "office_manager" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Solo administradores y gerentes de oficina pueden acceder a los archivos"})
			return
		}

		// Parse query parameters
		archiveType := c.Query("type") // "completed", "deleted", or "all"
		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
		search := c.Query("search")

		// Build query
		query := db.Model(&models.Case{}).Where("is_archived = ?", true)

		// Apply filters
		switch archiveType {
		case "completed":
			query = query.Where("archive_reason = ?", "completed")
		case "deleted":
			query = query.Where("archive_reason = ?", "manual_deletion")
		case "all":
			// No additional filter
		default:
			query = query.Where("archive_reason = ?", "completed") // Default to completed
		}

		// Apply search
		if search != "" {
			query = query.Where(
				"title ILIKE ? OR docket_number ILIKE ? OR court ILIKE ?",
				"%"+search+"%", "%"+search+"%", "%"+search+"%",
			)
		}

		// Get total count
		var total int64
		query.Count(&total)

		// Apply pagination
		offset := (page - 1) * limit
		query = query.Offset(offset).Limit(limit)

		// Preload relationships
		query = query.Preload("Client").Preload("Office").Preload("PrimaryStaff")

		// Execute query
		// Initialize with empty slice to prevent null JSON response
		cases := make([]models.Case, 0)
		if err := query.Order("archived_at DESC").Find(&cases).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al obtener los casos archivados"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"cases": cases,
			"pagination": gin.H{
				"page":  page,
				"limit": limit,
				"total": total,
				"pages": (total + int64(limit) - 1) / int64(limit),
			},
		})
	}
}

// RestoreArchivedCase restores a case from the archive
func RestoreArchivedCase(db *gorm.DB) gin.HandlerFunc {
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

		// Check permissions - only admins can restore cases
		userRole, _ := c.Get("userRole")
		if userRole != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Solo administradores pueden restaurar casos"})
			return
		}

		// Get the case
		var caseRecord models.Case
		if err := db.First(&caseRecord, caseID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "Caso no encontrado"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Error interno del servidor"})
			}
			return
		}

		// Check if case is archived
		if !caseRecord.IsArchived {
			c.JSON(http.StatusBadRequest, gin.H{"error": "El caso no está archivado"})
			return
		}

		// Restore the case
		caseRecord.IsArchived = false
		caseRecord.ArchivedAt = nil
		caseRecord.ArchivedBy = &user.ID
		caseRecord.ArchiveReason = ""

		// If it was manually deleted, also restore it
		if caseRecord.DeletedAt != nil && caseRecord.ArchiveReason == "manual_deletion" {
			caseRecord.DeletedAt = nil
			caseRecord.DeletedBy = nil
			caseRecord.DeletionReason = ""
		}

		// Save the case
		if err := db.Save(&caseRecord).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al restaurar el caso"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Caso restaurado exitosamente",
			"case":    caseRecord,
		})
	}
}

// PermanentlyDeleteArchivedCase permanently deletes an archived case
func PermanentlyDeleteArchivedCase(db *gorm.DB) gin.HandlerFunc {
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

		// Check permissions - only admins can permanently delete
		userRole, _ := c.Get("userRole")
		if userRole != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Solo administradores pueden eliminar permanentemente casos"})
			return
		}

		// Get the case
		var caseRecord models.Case
		if err := db.First(&caseRecord, caseID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "Caso no encontrado"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Error interno del servidor"})
			}
			return
		}

		// Check if case is archived
		if !caseRecord.IsArchived {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Solo se pueden eliminar casos archivados"})
			return
		}

		// Permanently delete the case and all related data
		tx := db.Begin()
		defer func() {
			if r := recover(); r != nil {
				tx.Rollback()
			}
		}()

		// Delete related records first
		if err := tx.Where("case_id = ?", caseID).Delete(&models.CaseEvent{}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al eliminar eventos del caso"})
			return
		}

		if err := tx.Where("case_id = ?", caseID).Delete(&models.Appointment{}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al eliminar citas del caso"})
			return
		}

		if err := tx.Where("case_id = ?", caseID).Delete(&models.Task{}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al eliminar tareas del caso"})
			return
		}

		// Delete case assignments
		if err := tx.Exec("DELETE FROM user_case_assignments WHERE case_id = ?", caseID).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al eliminar asignaciones del caso"})
			return
		}

		// Finally, delete the case
		if err := tx.Unscoped().Delete(&caseRecord).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al eliminar el caso"})
			return
		}

		// Commit transaction
		if err := tx.Commit().Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al confirmar la eliminación"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Caso eliminado permanentemente",
			"deletedBy": user.ID,
		})
	}
}

// GetArchiveStats returns statistics about archived cases
func GetArchiveStats(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Check permissions - only admins and office managers can view stats
		userRole, _ := c.Get("userRole")
		if userRole != "admin" && userRole != "office_manager" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Solo administradores y gerentes de oficina pueden ver estadísticas"})
			return
		}

		var stats struct {
			TotalArchived     int64 `json:"totalArchived"`
			CompletedArchived int64 `json:"completedArchived"`
			ManuallyDeleted   int64 `json:"manuallyDeleted"`
			ThisMonth         int64 `json:"thisMonth"`
			LastMonth         int64 `json:"lastMonth"`
		}

		// Get total archived
		db.Model(&models.Case{}).Where("is_archived = ?", true).Count(&stats.TotalArchived)

		// Get completed archived
		db.Model(&models.Case{}).Where("is_archived = ? AND archive_reason = ?", true, "completed").Count(&stats.CompletedArchived)

		// Get manually deleted
		db.Model(&models.Case{}).Where("is_archived = ? AND archive_reason = ?", true, "manual_deletion").Count(&stats.ManuallyDeleted)

		// Get this month
		now := time.Now()
		startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		db.Model(&models.Case{}).Where("is_archived = ? AND archived_at >= ?", true, startOfMonth).Count(&stats.ThisMonth)

		// Get last month
		lastMonth := now.AddDate(0, -1, 0)
		startOfLastMonth := time.Date(lastMonth.Year(), lastMonth.Month(), 1, 0, 0, 0, 0, lastMonth.Location())
		endOfLastMonth := startOfLastMonth.AddDate(0, 1, 0).Add(-time.Second)
		db.Model(&models.Case{}).Where("is_archived = ? AND archived_at >= ? AND archived_at <= ?", true, startOfLastMonth, endOfLastMonth).Count(&stats.LastMonth)

		c.JSON(http.StatusOK, stats)
	}
}
