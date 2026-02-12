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
		// Include both soft-deleted cases (deleted_at IS NOT NULL) and
		// completed/archived cases (is_archived = true) to capture all records
		query := db.Model(&models.Case{}).Where("deleted_at IS NOT NULL OR is_archived = ?", true)

		// Apply search filter
		if search != "" {
			query = query.Where("(title ILIKE ? OR docket_number ILIKE ?)",
				"%"+search+"%", "%"+search+"%")
		}

		// Apply archive type filter
		switch archiveType {
		case "completed":
			query = query.Where("is_completed = ? AND is_archived = ?", true, true)
		case "deleted":
			query = query.Where("deleted_at IS NOT NULL AND (is_completed = ? OR archive_reason = ?)", false, "manual_deletion")
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

		// Transform cases to match frontend interface expectations
		var transformedCases []gin.H
		for _, caseData := range cases {
			// Determine the correct archive timestamp and user:
			// Completed cases use ArchivedAt/ArchivedBy; deleted cases use DeletedAt/DeletedBy
			var archivedAt interface{} = caseData.ArchivedAt
			var archivedBy interface{} = caseData.ArchivedBy
			if archivedAt == nil && caseData.DeletedAt != nil {
				archivedAt = caseData.DeletedAt
				archivedBy = caseData.DeletedBy
			}

			// Determine archive reason
			archiveReason := caseData.ArchiveReason
			if archiveReason == "" {
				if caseData.IsCompleted {
					archiveReason = "completed"
				} else if caseData.DeletedAt != nil {
					archiveReason = "manual_deletion"
				}
			}

			transformedCase := gin.H{
				"id":             caseData.ID,
				"title":          caseData.Title,
				"docketNumber":   caseData.DocketNumber,
				"court":          caseData.Court,
				"status":         caseData.Status,
				"isCompleted":    caseData.IsCompleted,
				"isArchived":     caseData.IsArchived,
				"archiveReason":  archiveReason,
				"archivedAt":     archivedAt,
				"archivedBy":     archivedBy,
				"completedAt":    caseData.CompletedAt,
				"completedBy":    caseData.CompletedBy,
				"completionNote": caseData.CompletionNote,
			}

			// Add client data if exists
			if caseData.Client != nil {
				transformedCase["client"] = gin.H{
					"firstName": caseData.Client.FirstName,
					"lastName":  caseData.Client.LastName,
				}
			}

			// Add office data if exists
			if caseData.Office != nil {
				transformedCase["office"] = gin.H{
					"name": caseData.Office.Name,
				}
			}

			// Add primary staff data if exists
			if caseData.PrimaryStaff != nil {
				transformedCase["primaryStaff"] = gin.H{
					"firstName": caseData.PrimaryStaff.FirstName,
					"lastName":  caseData.PrimaryStaff.LastName,
				}
			}

			transformedCases = append(transformedCases, transformedCase)
		}

		// Calculate pagination info
		totalPages := int((total + int64(limit) - 1) / int64(limit))

		c.JSON(http.StatusOK, gin.H{
			"cases": transformedCases,
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

		if page < 1 {
			page = 1
		}
		if limit < 1 || limit > 100 {
			limit = 20
		}

		offset := (page - 1) * limit

		// Count archived appointments using raw SQL to bypass GORM soft-delete filter
		search := c.Query("search")
		archiveType := c.DefaultQuery("type", "all")

		countSQL := `SELECT COUNT(*) FROM appointments WHERE deleted_at IS NOT NULL`
		countArgs := []interface{}{}

		if search != "" {
			countSQL += ` AND title ILIKE ?`
			countArgs = append(countArgs, "%"+search+"%")
		}

		switch archiveType {
		case "completed":
			countSQL += ` AND status = 'completed'`
		case "deleted":
			countSQL += ` AND status = 'cancelled'`
		}

		var total int64
		if err := db.Raw(countSQL, countArgs...).Scan(&total).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to count archived appointments",
				"message": err.Error(),
			})
			return
		}

		// Build the select query with proper joins for relationships
		selectSQL := `
			SELECT a.id, a.title, a.start_time, a.end_time, a.status, a.deleted_at,
			       a.case_id, a.staff_id, a.office_id
			FROM appointments a
			WHERE a.deleted_at IS NOT NULL
		`
		selectArgs := []interface{}{}

		if search != "" {
			selectSQL += ` AND a.title ILIKE ?`
			selectArgs = append(selectArgs, "%"+search+"%")
		}

		switch archiveType {
		case "completed":
			selectSQL += ` AND a.status = 'completed'`
		case "deleted":
			selectSQL += ` AND a.status = 'cancelled'`
		}

		selectSQL += ` ORDER BY a.deleted_at DESC LIMIT ? OFFSET ?`
		selectArgs = append(selectArgs, limit, offset)

		var appointments []models.Appointment
		err := db.Raw(selectSQL, selectArgs...).Scan(&appointments).Error

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to fetch archived appointments",
				"message": err.Error(),
			})
			return
		}

		// Manually load relationships since raw SQL doesn't support Preload
		var transformedAppointments []gin.H
		for _, appointment := range appointments {
			transformedAppointment := gin.H{
				"id":            appointment.ID,
				"title":         appointment.Title,
				"description":   "",
				"startTime":     appointment.StartTime,
				"endTime":       appointment.EndTime,
				"status":        appointment.Status,
				"isArchived":    true,
				"archiveReason": "manual_deletion",
				"archivedAt":    appointment.DeletedAt,
				"archivedBy":    nil,
			}

			// Load client data through the case relationship
			if appointment.CaseID != 0 {
				var caseRecord models.Case
				if err := db.Unscoped().Preload("Client").First(&caseRecord, appointment.CaseID).Error; err == nil {
					if caseRecord.Client != nil {
						transformedAppointment["client"] = gin.H{
							"firstName": caseRecord.Client.FirstName,
							"lastName":  caseRecord.Client.LastName,
						}
					}
				}
			}

			// Load office data
			if appointment.OfficeID != 0 {
				var office models.Office
				if err := db.First(&office, appointment.OfficeID).Error; err == nil {
					transformedAppointment["office"] = gin.H{
						"name": office.Name,
					}
				}
			}

			// Load staff data
			if appointment.StaffID != 0 {
				var staff models.User
				if err := db.First(&staff, appointment.StaffID).Error; err == nil {
					transformedAppointment["staff"] = gin.H{
						"firstName": staff.FirstName,
						"lastName":  staff.LastName,
					}
				}
			}

			transformedAppointments = append(transformedAppointments, transformedAppointment)
		}

		// Calculate pagination info
		totalPages := int((total + int64(limit) - 1) / int64(limit))

		c.JSON(http.StatusOK, gin.H{
			"appointments": transformedAppointments,
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

		// Count total archived cases (both soft-deleted and completed/archived)
		if err := db.Model(&models.Case{}).Where("deleted_at IS NOT NULL OR is_archived = ?", true).Count(&stats.TotalArchived).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to count total archived cases",
				"message": err.Error(),
			})
			return
		}

		// Count completed archived cases
		if err := db.Model(&models.Case{}).Where("is_completed = ? AND is_archived = ?", true, true).Count(&stats.CompletedArchived).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to count completed archived cases",
				"message": err.Error(),
			})
			return
		}

		// Count manually deleted cases (soft-deleted but not completed)
		if err := db.Model(&models.Case{}).Where("deleted_at IS NOT NULL AND is_completed = ?", false).Count(&stats.ManuallyDeleted).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to count manually deleted cases",
				"message": err.Error(),
			})
			return
		}

		// Count this month's archives (using both deleted_at and archived_at)
		now := time.Now()
		startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		if err := db.Model(&models.Case{}).Where(
			"(deleted_at IS NOT NULL AND deleted_at >= ?) OR (archived_at IS NOT NULL AND archived_at >= ?)",
			startOfMonth, startOfMonth,
		).Count(&stats.ThisMonth).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to count this month's archives",
				"message": err.Error(),
			})
			return
		}

		// Count last month's archives
		startOfLastMonth := startOfMonth.AddDate(0, -1, 0)
		endOfLastMonth := startOfMonth.Add(-time.Nanosecond)
		if err := db.Model(&models.Case{}).Where(
			"(deleted_at IS NOT NULL AND deleted_at >= ? AND deleted_at <= ?) OR (archived_at IS NOT NULL AND archived_at >= ? AND archived_at <= ?)",
			startOfLastMonth, endOfLastMonth, startOfLastMonth, endOfLastMonth,
		).Count(&stats.LastMonth).Error; err != nil {
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

		// Delete appointments associated with the case
		if err := tx.Unscoped().Where("case_id = ?", caseID).Delete(&models.Appointment{}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to delete case appointments",
				"message": err.Error(),
			})
			return
		}

		// Delete task comments first (they reference tasks)
		if err := tx.Unscoped().Where("task_id IN (SELECT id FROM tasks WHERE case_id = ?)", caseID).Delete(&models.TaskComment{}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to delete task comments",
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

		// Delete user case assignments (many-to-many relationship)
		if err := tx.Unscoped().Where("case_id = ?", caseID).Delete(&models.UserCaseAssignment{}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to delete user case assignments",
				"message": err.Error(),
			})
			return
		}

		// Delete audit logs related to this case
		if err := tx.Unscoped().Where("entity_type = ? AND entity_id = ?", "case", caseID).Delete(&models.AuditLog{}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to delete case audit logs",
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
				"caseId":  caseID,
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
