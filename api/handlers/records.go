// api/handlers/records.go
package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/BryanPMX/CAF/api/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// GetRecordsArchivedCases retrieves all archived cases with pagination and filtering
func GetRecordsArchivedCases(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Parse pagination parameters
		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
		search := c.Query("search")
		archiveType := c.DefaultQuery("type", "all")

		if page < 1 {
			page = 1
		}
		if limit < 1 || limit > 100 {
			limit = 20
		}

		offset := (page - 1) * limit

		// Build query for archived cases
		query := db.Model(&models.Case{}).Where("deleted_at IS NOT NULL")

		// Apply search filter
		if search != "" {
			query = query.Where("title ILIKE ? OR docket_number ILIKE ?",
				"%"+search+"%", "%"+search+"%")
		}

		// Apply archive type filter
		switch archiveType {
		case "completed":
			query = query.Where("is_completed = ?", true)
		case "deleted":
			query = query.Where("is_completed = ?", false)
		}

		// Get total count
		var total int64
		if err := query.Count(&total).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to count archived cases",
				"message": err.Error(),
			})
			return
		}

		// Get archived cases with relationships
		var cases []models.Case
		err := query.Preload("Client").
			Preload("Office").
			Preload("PrimaryStaff").
			Order("deleted_at DESC").
			Offset(offset).
			Limit(limit).
			Find(&cases).Error

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to fetch archived cases",
				"message": err.Error(),
			})
			return
		}

		// Calculate pagination info
		totalPages := int((total + int64(limit) - 1) / int64(limit))

		c.JSON(http.StatusOK, gin.H{
			"cases": cases,
			"pagination": gin.H{
				"page":    page,
				"limit":   limit,
				"total":   total,
				"pages":   totalPages,
				"hasNext": page < totalPages,
				"hasPrev": page > 1,
			},
		})
	}
}

// GetArchivedAppointments retrieves all archived appointments with pagination and filtering
func GetArchivedAppointments(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Parse pagination parameters
		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
		search := c.Query("search")
		archiveType := c.DefaultQuery("type", "all")

		if page < 1 {
			page = 1
		}
		if limit < 1 || limit > 100 {
			limit = 20
		}

		offset := (page - 1) * limit

		// Build query for archived appointments
		query := db.Model(&models.Appointment{}).Where("deleted_at IS NOT NULL")

		// Apply search filter
		if search != "" {
			query = query.Where("title ILIKE ? OR description ILIKE ?",
				"%"+search+"%", "%"+search+"%")
		}

		// Apply archive type filter (appointments don't have is_completed, so we use status)
		switch archiveType {
		case "completed":
			query = query.Where("status = ?", "completed")
		case "deleted":
			query = query.Where("status != ?", "completed")
		}

		// Get total count
		var total int64
		if err := query.Count(&total).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to count archived appointments",
				"message": err.Error(),
			})
			return
		}

		// Get archived appointments with relationships
		var appointments []models.Appointment
		err := query.Preload("Case.Client").
			Preload("Office").
			Preload("Staff").
			Preload("Case").
			Order("deleted_at DESC").
			Offset(offset).
			Limit(limit).
			Find(&appointments).Error

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to fetch archived appointments",
				"message": err.Error(),
			})
			return
		}

		// Calculate pagination info
		totalPages := int((total + int64(limit) - 1) / int64(limit))

		c.JSON(http.StatusOK, gin.H{
			"appointments": appointments,
			"pagination": gin.H{
				"page":    page,
				"limit":   limit,
				"total":   total,
				"pages":   totalPages,
				"hasNext": page < totalPages,
				"hasPrev": page > 1,
			},
		})
	}
}

// GetRecordsArchiveStats retrieves statistics about archived records
func GetRecordsArchiveStats(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var stats struct {
			TotalArchived     int64 `json:"totalArchived"`
			CompletedArchived int64 `json:"completedArchived"`
			ManuallyDeleted   int64 `json:"manuallyDeleted"`
			ThisMonth         int64 `json:"thisMonth"`
			LastMonth         int64 `json:"lastMonth"`
		}

		// Count total archived cases
		if err := db.Model(&models.Case{}).Where("deleted_at IS NOT NULL").Count(&stats.TotalArchived).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to count total archived cases",
				"message": err.Error(),
			})
			return
		}

		// Count completed archived cases
		if err := db.Model(&models.Case{}).Where("deleted_at IS NOT NULL AND is_completed = ?", true).Count(&stats.CompletedArchived).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to count completed archived cases",
				"message": err.Error(),
			})
			return
		}

		// Count manually deleted cases (not completed)
		if err := db.Model(&models.Case{}).Where("deleted_at IS NOT NULL AND is_completed = ?", false).Count(&stats.ManuallyDeleted).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to count manually deleted cases",
				"message": err.Error(),
			})
			return
		}

		// Count this month's archives
		now := time.Now()
		startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		if err := db.Model(&models.Case{}).Where("deleted_at IS NOT NULL AND deleted_at >= ?", startOfMonth).Count(&stats.ThisMonth).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to count this month's archives",
				"message": err.Error(),
			})
			return
		}

		// Count last month's archives
		startOfLastMonth := startOfMonth.AddDate(0, -1, 0)
		endOfLastMonth := startOfMonth.Add(-time.Nanosecond)
		if err := db.Model(&models.Case{}).Where("deleted_at IS NOT NULL AND deleted_at >= ? AND deleted_at <= ?",
			startOfLastMonth, endOfLastMonth).Count(&stats.LastMonth).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to count last month's archives",
				"message": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, stats)
	}
}

// RestoreCase restores a soft-deleted case
func RestoreCase(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		caseID := c.Param("id")
		if caseID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Case ID is required"})
			return
		}

		// Find the archived case using Unscoped() to include soft-deleted records
		var caseData models.Case
		if err := db.Unscoped().First(&caseData, caseID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "Archived case not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to find archived case",
				"message": err.Error(),
			})
			return
		}

		// Check if the case is actually archived
		if caseData.DeletedAt == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Case is not archived"})
			return
		}

		// Restore the case by setting DeletedAt to nil
		caseData.DeletedAt = nil
		caseData.DeletedBy = nil
		caseData.DeletionReason = ""

		if err := db.Unscoped().Save(&caseData).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to restore case",
				"message": err.Error(),
			})
			return
		}

		// Load relationships for response
		if err := db.Preload("Client").Preload("Office").Preload("PrimaryStaff").First(&caseData, caseData.ID).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to load case relationships",
				"message": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Case restored successfully",
			"data":    caseData,
		})
	}
}

// RestoreAppointment restores a soft-deleted appointment
func RestoreAppointment(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		appointmentID := c.Param("id")
		if appointmentID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Appointment ID is required"})
			return
		}

		// Find the archived appointment using Unscoped() to include soft-deleted records
		var appointment models.Appointment
		if err := db.Unscoped().First(&appointment, appointmentID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "Archived appointment not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to find archived appointment",
				"message": err.Error(),
			})
			return
		}

		// Check if the appointment is actually archived
		if !appointment.DeletedAt.Valid {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Appointment is not archived"})
			return
		}

		// Restore the appointment by setting DeletedAt to nil
		appointment.DeletedAt = gorm.DeletedAt{}

		if err := db.Unscoped().Save(&appointment).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to restore appointment",
				"message": err.Error(),
			})
			return
		}

		// Load relationships for response
		if err := db.Preload("Case.Client").Preload("Office").Preload("Staff").Preload("Case").First(&appointment, appointment.ID).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to load appointment relationships",
				"message": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Appointment restored successfully",
			"data":    appointment,
		})
	}
}

// PermanentlyDeleteCase permanently deletes an archived case
func PermanentlyDeleteCase(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		caseID := c.Param("id")
		if caseID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Case ID is required"})
			return
		}

		// Find the archived case using Unscoped() to include soft-deleted records
		var caseData models.Case
		if err := db.Unscoped().First(&caseData, caseID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "Archived case not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to find archived case",
				"message": err.Error(),
			})
			return
		}

		// Check if the case is actually archived
		if caseData.DeletedAt == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Case is not archived"})
			return
		}

		// Permanently delete the case and all its related records
		tx := db.Begin()
		defer func() {
			if r := recover(); r != nil {
				tx.Rollback()
			}
		}()

		// Delete case events first (foreign key constraint)
		if err := tx.Unscoped().Where("case_id = ?", caseID).Delete(&models.CaseEvent{}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to delete case events",
				"message": err.Error(),
			})
			return
		}

		// Delete tasks associated with the case
		if err := tx.Unscoped().Where("case_id = ?", caseID).Delete(&models.Task{}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to delete case tasks",
				"message": err.Error(),
			})
			return
		}

		// Finally, permanently delete the case
		if err := tx.Unscoped().Delete(&caseData).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to permanently delete case",
				"message": err.Error(),
			})
			return
		}

		if err := tx.Commit().Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to commit permanent deletion",
				"message": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Case permanently deleted successfully",
		})
	}
}

// PermanentlyDeleteAppointment permanently deletes an archived appointment
func PermanentlyDeleteAppointment(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		appointmentID := c.Param("id")
		if appointmentID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Appointment ID is required"})
			return
		}

		// Find the archived appointment using Unscoped() to include soft-deleted records
		var appointment models.Appointment
		if err := db.Unscoped().First(&appointment, appointmentID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "Archived appointment not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to find archived appointment",
				"message": err.Error(),
			})
			return
		}

		// Check if the appointment is actually archived
		if !appointment.DeletedAt.Valid {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Appointment is not archived"})
			return
		}

		// Permanently delete the appointment
		if err := db.Unscoped().Delete(&appointment).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to permanently delete appointment",
				"message": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Appointment permanently deleted successfully",
		})
	}
}
