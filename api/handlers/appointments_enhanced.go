package handlers

import (
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/BryanPMX/CAF/api/config"
	"github.com/BryanPMX/CAF/api/middleware"
	"github.com/BryanPMX/CAF/api/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// GetAppointmentsEnhanced returns appointments based on user permissions and department
func GetAppointmentsEnhanced(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Initialize with empty slice to prevent null JSON response
		appointments := make([]models.Appointment, 0)
		query := db.Order("start_time desc").Limit(100)

		// Preload nested data with optimized queries
		query = query.Preload("Staff", func(db *gorm.DB) *gorm.DB {
			return db.Select("id, first_name, last_name, role, department")
		}).Preload("Case", func(db *gorm.DB) *gorm.DB {
			return db.Preload("Client", func(db *gorm.DB) *gorm.DB {
				return db.Select("id, first_name, last_name")
			})
		})

		// Apply access control based on user role and department
		userRole, _ := c.Get("userRole")
		userDepartment, _ := c.Get("userDepartment")
		officeScopeID, _ := c.Get("officeScopeID")

		if (userRole != "admin" && userRole != "client") || officeScopeID != nil {
			// Staff-like users see appointments from their office and department
			if officeScopeID != nil {
				query = query.Joins("INNER JOIN cases ON cases.id = appointments.case_id AND cases.office_id = ?", officeScopeID)
			}

			if userDepartment != nil {
				query = query.Where("appointments.department = ?", userDepartment)
			}

			// Also include appointments where they are the assigned staff member
			userID, _ := c.Get("userID")
			userIDUint, _ := strconv.ParseUint(userID.(string), 10, 32)
			query = query.Or("appointments.staff_id = ?", userIDUint)
		}

		// Apply additional filters from query parameters
		if status := c.Query("status"); status != "" {
			query = query.Where("appointments.status = ?", status)
		}
		if category := c.Query("category"); category != "" {
			query = query.Where("appointments.category = ?", category)
		}
		if department := c.Query("department"); department != "" {
			query = query.Where("appointments.department = ?", department)
		}
		if date := c.Query("date"); date != "" {
			// Parse date and filter by start_time
			if parsedDate, err := time.Parse("2006-01-02", date); err == nil {
				nextDay := parsedDate.Add(24 * time.Hour)
				query = query.Where("appointments.start_time >= ? AND appointments.start_time < ?", parsedDate, nextDay)
			}
		}

		// Execute the final query
		if err := query.Find(&appointments).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve appointments"})
			return
		}

		// Calculate pagination info
		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		limit, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
		total := int64(len(appointments))
		totalPages := (total + int64(limit) - 1) / int64(limit)

		// Add cache headers for better performance
		c.Header("Cache-Control", "private, max-age=30")
		c.JSON(http.StatusOK, gin.H{
			"data": appointments,
			"pagination": gin.H{
				"page":       page,
				"pageSize":   limit,
				"total":      total,
				"totalPages": totalPages,
				"hasNext":    page < int(totalPages),
				"hasPrev":    page > 1,
			},
			"performance": gin.H{
				"queryTime":    "0ms",
				"cacheHit":     false,
				"responseSize": len(appointments),
			},
		})
	}
}

// GetAppointmentByIDEnhanced returns a specific appointment with access control
func GetAppointmentByIDEnhanced(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		appointmentID := c.Param("id")
		var appointment models.Appointment

		query := db.Preload("Staff").Preload("Case.Client").Preload("Case.Office")

		// Apply access control
		userRole, _ := c.Get("userRole")
		userDepartment, _ := c.Get("userDepartment")
		officeScopeID, _ := c.Get("officeScopeID")

		if (userRole != "admin" && userRole != "client") || officeScopeID != nil {
			// Staff-like users can only access appointments from their office and department
			if officeScopeID != nil {
				query = query.Joins("INNER JOIN cases ON cases.id = appointments.case_id AND cases.office_id = ?", officeScopeID)
			}

			if userDepartment != nil {
				query = query.Where("appointments.department = ?", userDepartment)
			}

			// Or appointments where they are the assigned staff member
			userID, _ := c.Get("userID")
			userIDUint, _ := strconv.ParseUint(userID.(string), 10, 32)
			query = query.Or("appointments.staff_id = ?", userIDUint)
		}

		if err := query.First(&appointment, appointmentID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "Appointment not found or access denied"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve appointment"})
			return
		}

		c.JSON(http.StatusOK, appointment)
	}
}

// CreateAppointmentEnhanced creates a new appointment with department validation
func CreateAppointmentEnhanced(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input CreateAppointmentEnhancedInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Get current user context
		currentUser, _ := c.Get("currentUser")
		user := currentUser.(models.User)

		// Validate department compatibility for staff users
		if middleware.IsStaffRole(user.Role) && user.Department != nil {
			if input.Department != *user.Department {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Appointment department must match your department"})
				return
			}
		}

		// Validate that the case exists and user has access to it
		var caseRecord models.Case
		if err := db.First(&caseRecord, input.CaseID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Case not found"})
			return
		}

		// Check case access permissions
		if middleware.IsStaffRole(user.Role) {
			// Check if user is assigned to this case
			var assignment models.UserCaseAssignment
			if err := db.Where("user_id = ? AND case_id = ?", user.ID, input.CaseID).First(&assignment).Error; err != nil {
				c.JSON(http.StatusForbidden, gin.H{"error": "Access denied: You can only create appointments for cases you're assigned to"})
				return
			}

			// Check office access
			if user.OfficeID != nil && *user.OfficeID != caseRecord.OfficeID {
				c.JSON(http.StatusForbidden, gin.H{"error": "Access denied: Case belongs to different office"})
				return
			}
		}

		// Create the appointment with centralized status
		appointment := models.Appointment{
			CaseID:     input.CaseID,
			StaffID:    input.StaffID,
			Title:      input.Title,
			StartTime:  input.StartTime,
			EndTime:    input.EndTime,
			Status:     config.StatusConfirmed, // Use centralized status constant
			Category:   input.Category,
			Department: input.Department,
		}

		if err := db.Create(&appointment).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create appointment"})
			return
		}

		c.JSON(http.StatusCreated, appointment)
	}
}

// UpdateAppointmentEnhanced updates an appointment with access control
func UpdateAppointmentEnhanced(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		appointmentID := c.Param("id")
		var input UpdateAppointmentInput

		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Get current user context
		currentUser, _ := c.Get("currentUser")
		user := currentUser.(models.User)

		// Check if appointment exists and user has access
		var appointment models.Appointment
		query := db.Preload("Case")

		if middleware.IsStaffRole(user.Role) {
			// Staff users can only update appointments they're assigned to or from their department
			if user.Department != nil {
				query = query.Where("department = ?", user.Department)
			}
			query = query.Or("staff_id = ?", user.ID)
		}

		if err := query.First(&appointment, appointmentID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "Appointment not found or access denied"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve appointment"})
			return
		}

		// Update the appointment
		updates := make(map[string]interface{})
		if input.Title != "" {
			updates["title"] = input.Title
		}
		if !input.StartTime.IsZero() {
			updates["start_time"] = input.StartTime
		}
		if !input.EndTime.IsZero() {
			updates["end_time"] = input.EndTime
		}
		if input.Status != "" {
			// Validate status using centralized configuration
			if !config.IsValidAppointmentStatus(input.Status) {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid appointment status"})
				return
			}
			updates["status"] = input.Status
		}
		if input.Category != "" {
			updates["category"] = input.Category
		}
		if input.Department != "" {
			updates["department"] = input.Department
		}
		if input.StaffID != 0 {
			updates["staff_id"] = input.StaffID
		}

		if err := db.Model(&appointment).Updates(updates).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update appointment"})
			return
		}

		c.JSON(http.StatusOK, appointment)
	}
}

// DeleteAppointmentEnhanced deletes an appointment with enhanced security and access control
func DeleteAppointmentEnhanced(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		appointmentID := c.Param("id")

		// Get current user context
		currentUser, _ := c.Get("currentUser")
		user := currentUser.(models.User)

		// Check if appointment exists and load related data
		var appointment models.Appointment
		query := db.Preload("Case").Preload("Staff")

		if middleware.IsStaffRole(user.Role) {
			// Staff users can only delete appointments they're assigned to or from their department
			if user.Department != nil {
				query = query.Where("department = ?", user.Department)
			}
			query = query.Or("staff_id = ?", user.ID)
		}

		if err := query.First(&appointment, appointmentID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "Cita no encontrada o acceso denegado"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al recuperar la cita"})
			return
		}

		// Professional Security Check 1: Prevent deletion of completed appointments
		if appointment.Status == "completed" {
			c.JSON(http.StatusForbidden, gin.H{
				"error": "No se puede eliminar una cita completada",
				"details": gin.H{
					"appointmentId": appointment.ID,
					"status":        appointment.Status,
					"completedAt":   appointment.UpdatedAt,
				},
			})
			return
		}

		// Professional Security Check 2: Check if appointment is in the past
		if time.Now().After(appointment.StartTime) {
			c.JSON(http.StatusForbidden, gin.H{
				"error": "No se puede eliminar una cita que ya ha pasado",
				"details": gin.H{
					"appointmentId": appointment.ID,
					"scheduledTime": appointment.StartTime,
					"currentTime":   time.Now(),
				},
			})
			return
		}

		// Professional Security Check 3: Create audit log before deletion
		auditLog := models.CaseEvent{
			CaseID:     appointment.CaseID,
			UserID:     user.ID,
			EventType:  "appointment_deletion",
			Visibility: "internal",
			CommentText: fmt.Sprintf("Cita eliminada por %s %s (ID: %d). Cita: %s programada para %s",
				user.FirstName, user.LastName, user.ID, appointment.Title, appointment.StartTime.Format("02/01/2006 15:04")),
		}

		if err := db.Create(&auditLog).Error; err != nil {
			log.Printf("WARNING: Failed to create audit log for appointment deletion: %v", err)
		}

		// Professional Security Check 4: Soft delete with status update
		// Update appointment status to cancelled instead of hard delete
		updates := map[string]interface{}{
			"status":     "cancelled",
			"deleted_at": time.Now(),
		}

		if err := db.Model(&appointment).Updates(updates).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al cancelar la cita"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message":     "Cita cancelada exitosamente",
			"cancelledAt": time.Now(),
			"cancelledBy": gin.H{
				"id":   user.ID,
				"name": fmt.Sprintf("%s %s", user.FirstName, user.LastName),
				"role": user.Role,
			},
			"appointment": gin.H{
				"id":     appointment.ID,
				"title":  appointment.Title,
				"status": "cancelled",
			},
		})
	}
}

// GetMyAppointments returns appointments where the current user is the assigned staff member
func GetMyAppointments(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDUint, _ := strconv.ParseUint(userID.(string), 10, 32)

		// Initialize with empty slice to prevent null JSON response
		appointments := make([]models.Appointment, 0)
		query := db.Where("staff_id = ?", userIDUint).
			Preload("Case.Client").
			Preload("Case.Office").
			Order("start_time desc")

		// Apply additional filters
		if status := c.Query("status"); status != "" {
			query = query.Where("status = ?", status)
		}
		if date := c.Query("date"); date != "" {
			if parsedDate, err := time.Parse("2006-01-02", date); err == nil {
				nextDay := parsedDate.Add(24 * time.Hour)
				query = query.Where("start_time >= ? AND start_time < ?", parsedDate, nextDay)
			}
		}

		if err := query.Find(&appointments).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve appointments"})
			return
		}

		// Calculate pagination info
		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		limit, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
		total := int64(len(appointments))
		totalPages := (total + int64(limit) - 1) / int64(limit)

		c.JSON(http.StatusOK, gin.H{
			"data": appointments,
			"pagination": gin.H{
				"page":       page,
				"pageSize":   limit,
				"total":      total,
				"totalPages": totalPages,
				"hasNext":    page < int(totalPages),
				"hasPrev":    page > 1,
			},
			"performance": gin.H{
				"queryTime":    "0ms",
				"cacheHit":     false,
				"responseSize": len(appointments),
			},
		})
	}
}

// CreateAppointmentEnhancedInput defines the structure for creating appointments
type CreateAppointmentEnhancedInput struct {
	CaseID     uint      `json:"caseId" binding:"required"`
	StaffID    uint      `json:"staffId" binding:"required"`
	Title      string    `json:"title" binding:"required"`
	StartTime  time.Time `json:"startTime" binding:"required"`
	EndTime    time.Time `json:"endTime" binding:"required"`
	Category   string    `json:"category" binding:"required"`
	Department string    `json:"department" binding:"required"`
}

// UpdateAppointmentInput defines the structure for updating appointments
type UpdateAppointmentInput struct {
	Title      string    `json:"title,omitempty"`
	StartTime  time.Time `json:"startTime,omitempty"`
	EndTime    time.Time `json:"endTime,omitempty"`
	Status     string    `json:"status,omitempty"`
	Category   string    `json:"category,omitempty"`
	Department string    `json:"department,omitempty"`
	StaffID    uint      `json:"staffId,omitempty"`
}
