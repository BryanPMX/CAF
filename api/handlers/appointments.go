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
	securityutil "github.com/BryanPMX/CAF/api/security"
	"github.com/BryanPMX/CAF/api/services"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// GetAppointmentsEnhanced returns appointments based on user permissions and department
func GetAppointmentsEnhanced(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Initialize with empty slice to prevent null JSON response
		appointments := make([]models.Appointment, 0)
		query := db.Preload("Client").Order("start_time desc").Limit(100)

		// Preload nested data with optimized queries
		query = query.Preload("Staff", func(db *gorm.DB) *gorm.DB {
			return db.Select("id, first_name, last_name, role, department")
		}).Preload("Case", func(db *gorm.DB) *gorm.DB {
			return db.Preload("Client", func(db *gorm.DB) *gorm.DB {
				return db.Select("id, first_name, last_name")
			})
		})

		// Apply access control based on user role and department
		userRole := c.GetString("userRole")
		userDepartment, _ := c.Get("userDepartment")
		officeScopeID, _ := c.Get("officeScopeID")

		// Admins see all appointments - no filtering needed
		// Office managers see ALL appointments in their office (they manage the entire office)
		if userRole == config.RoleOfficeManager || userRole == config.RoleAdmin {
			query = query.Where("appointments.office_id = ?", officeScopeID)
		} else if !config.CanAccessAllOffices(userRole) && userRole != "client" {
			// Staff users: build a compound condition for access control
			// They can see appointments they're assigned to OR appointments from their office/department
			userID, _ := c.Get("userID")
			userIDUint, _ := strconv.ParseUint(userID.(string), 10, 32)

			// Build access conditions as a group
			accessConditions := db.Where("appointments.staff_id = ?", userIDUint)

			// Add office/department scoped appointments
			if officeScopeID != nil && userDepartment != nil {
				accessConditions = accessConditions.Or(
					db.Where("appointments.office_id = ?", officeScopeID).
						Where("appointments.department = ?", userDepartment),
				)
			} else if officeScopeID != nil {
				accessConditions = accessConditions.Or("appointments.office_id = ?", officeScopeID)
			} else if userDepartment != nil {
				accessConditions = accessConditions.Or("appointments.department = ?", userDepartment)
			}

			query = query.Where(accessConditions)
		}

		if clientID := c.Query("clientId"); clientID != "" {
			query = query.Where("(appointments.client_id = ? OR appointments.case_id IN (SELECT id FROM cases WHERE client_id = ?))", clientID, clientID)
		}
		// Apply additional filters from query parameters
		if status := c.Query("status"); status != "" {
			query = query.Where("appointments.status = ?", status)
		}
		if category := c.Query("category"); category != "" {
			// Filter by case category since category equals type of case
			query = query.Where("(appointments.case_id IN (SELECT id FROM cases WHERE category = ?) OR (appointments.case_id IS NULL AND appointments.category = ?))", category, category)
		}
		if department := c.Query("department"); department != "" {
			query = query.Where("appointments.department = ?", department)
		}
		// Handle date filtering (single date or date range)
		if date := c.Query("date"); date != "" {
			// Parse date and filter by start_time
			if parsedDate, err := time.Parse("2006-01-02", date); err == nil {
				nextDay := parsedDate.Add(24 * time.Hour)
				query = query.Where("appointments.start_time >= ? AND appointments.start_time < ?", parsedDate, nextDay)
			}
		} else if dateFrom := c.Query("dateFrom"); dateFrom != "" {
			// Handle date range filtering
			var whereClause string
			var args []interface{}

			if parsedDateFrom, err := time.Parse("2006-01-02", dateFrom); err == nil {
				if dateTo := c.Query("dateTo"); dateTo != "" {
					if parsedDateTo, err := time.Parse("2006-01-02", dateTo); err == nil {
						// Include the end date (add one day to make it inclusive)
						endDate := parsedDateTo.Add(24 * time.Hour)
						whereClause = "appointments.start_time >= ? AND appointments.start_time < ?"
						args = []interface{}{parsedDateFrom, endDate}
					}
				} else {
					// Only dateFrom specified
					whereClause = "appointments.start_time >= ?"
					args = []interface{}{parsedDateFrom}
				}

				if whereClause != "" {
					query = query.Where(whereClause, args...)
				}
			}
		}

		// Execute the final query
		if err := query.Find(&appointments).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve appointments"})
			return
		}

		// Debug logging

		// Calculate pagination info
		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		limit, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
		total := int64(len(appointments))
		totalPages := (total + int64(limit) - 1) / int64(limit)

		// Disable caching for real-time appointment data
		c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
		c.Header("Pragma", "no-cache")
		c.Header("Expires", "0")
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

		query := db.Preload("Staff").Preload("Client").Preload("Case.Client").Preload("Case.Office")

		// Apply access control
		userRole := c.GetString("userRole")
		userDepartment, _ := c.Get("userDepartment")
		officeScopeID, _ := c.Get("officeScopeID")

		// Admins see all appointments - no filtering needed
		// Office managers can access ALL appointments in their office
		if userRole == config.RoleOfficeManager || userRole == config.RoleAdmin {
			query = query.Where("appointments.office_id = ?", officeScopeID)
		} else if !config.CanAccessAllOffices(userRole) && userRole != "client" {
			// Staff users: they can access appointments assigned to them OR from their office/department
			userID, _ := c.Get("userID")
			userIDUint, _ := strconv.ParseUint(userID.(string), 10, 32)

			// Build access conditions as a group
			accessConditions := db.Where("appointments.staff_id = ?", userIDUint)

			if officeScopeID != nil && userDepartment != nil {
				accessConditions = accessConditions.Or(
					db.Where("appointments.office_id = ?", officeScopeID).
						Where("appointments.department = ?", userDepartment),
				)
			} else if officeScopeID != nil {
				accessConditions = accessConditions.Or("appointments.office_id = ?", officeScopeID)
			} else if userDepartment != nil {
				accessConditions = accessConditions.Or("appointments.department = ?", userDepartment)
			}

			query = query.Where(accessConditions)
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
		if err := validateSchedulingTime(input.StartTime, input.EndTime, time.Now(), input.TimeZone); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		currentUser, _ := c.Get("currentUser")
		user := currentUser.(models.User)

		var caseRecord models.Case
		if err := db.First(&caseRecord, input.CaseID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Case not found"})
			return
		}
		allowed, err := middleware.CanAccessCase(db, user, caseRecord.ID)
		if err != nil || !allowed {
			c.JSON(http.StatusForbidden, gin.H{"error": "Case outside your access scope"})
			return
		}
		var employee models.User
		if err := db.First(&employee, input.StaffID).Error; err != nil || !canScheduleEmployee(user, employee) {
			c.JSON(http.StatusForbidden, gin.H{"error": "Employee outside your scheduling scope"})
			return
		}
		if input.NewClient != nil && caseRecord.ClientID != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Case already has a client"})
			return
		}
		if input.ClientID != nil {
			var client models.User
			if err := db.First(&client, *input.ClientID).Error; err != nil || client.Role != "client" || (!config.CanAccessAllOffices(user.Role) && (client.OfficeID == nil || *client.OfficeID != caseRecord.OfficeID)) {
				c.JSON(http.StatusForbidden, gin.H{"error": "Client outside your office"})
				return
			}
		}

		// Handle new client creation if provided
		var clientID uint
		if input.NewClient != nil {

			// Hash default password for new client
			hashedPassword, err := securityutil.HashRandomPassword()
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
				return
			}

			newClient := models.User{
				FirstName: input.NewClient.FirstName,
				LastName:  input.NewClient.LastName,
				Email:     input.NewClient.Email,
				Password:  hashedPassword,
				Role:      "client",
				IsActive:  true,
			}

			// Assign to same office as the creating user
			if user.OfficeID != nil {
				newClient.OfficeID = user.OfficeID
			}

			// Create the client
			if err := db.Create(&newClient).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create client", "details": err.Error()})
				return
			}
			clientID = newClient.ID
		} else if input.ClientID != nil {
			clientID = *input.ClientID
		}

		// Validate department compatibility for staff users (office managers can create appointments for any department)
		if middleware.IsStaffRole(user.Role) && user.Role != config.RoleOfficeManager && user.Department != nil {
			if input.Department != *user.Department {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Appointment department must match your department"})
				return
			}
		}

		// The case was authorized before any new client was created.
		if input.NewClient != nil && caseRecord.ClientID == nil {
			if err := db.Model(&caseRecord).Update("client_id", clientID).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to assign client"})
				return
			}
		}

		// Create the appointment with centralized status
		appointment := models.Appointment{
			CaseID:     input.CaseID,
			OfficeID:   caseRecord.OfficeID,
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

		// Load relationships for response
		if err := db.Preload("Staff").Preload("Client").Preload("Case.Client").First(&appointment, appointment.ID).Error; err != nil {
			log.Printf("CreateAppointment: Failed to load relationships: %v", err)
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

		if !config.CanAccessAllOffices(user.Role) {
			// Office managers can update all appointments in their office
			if (user.Role == config.RoleAdmin || user.Role == config.RoleOfficeManager) && user.OfficeID != nil {
				query = query.Where("appointments.office_id = ?", *user.OfficeID)
			} else {
				// Other staff users can only update appointments they're assigned to or from their department
				if user.Department != nil {
					query = query.Where("department = ?", user.Department)
				}
				query = query.Or("staff_id = ?", user.ID)
			}
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
		if !input.StartTime.IsZero() || !input.EndTime.IsZero() {
			start, end := appointment.StartTime, appointment.EndTime
			if !input.StartTime.IsZero() {
				start = input.StartTime
			}
			if !input.EndTime.IsZero() {
				end = input.EndTime
			}
			if err := validateSchedulingTime(start, end, time.Now(), input.TimeZone); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
		}
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
			var selectedStaff models.User
			if err := db.First(&selectedStaff, input.StaffID).Error; err != nil || !canScheduleEmployee(user, selectedStaff) {
				c.JSON(http.StatusForbidden, gin.H{"error": "Staff member is outside your scheduling scope"})
				return
			}
			if appointment.CaseID == 0 && appointment.ClientID != nil && (selectedStaff.OfficeID == nil || *selectedStaff.OfficeID != appointment.OfficeID) {
				c.JSON(400, gin.H{"error": "El personal debe pertenecer a la oficina de la cita"})
				return
			}
			updates["staff_id"] = input.StaffID
		}

		err := db.Transaction(func(tx *gorm.DB) error {
			if appointment.CaseID == 0 && appointment.ClientID != nil && (!input.StartTime.IsZero() || !input.EndTime.IsZero() || input.StaffID != 0) {
				staffID := appointment.StaffID
				if input.StaffID != 0 {
					staffID = input.StaffID
				}
				var employee models.User
				if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&employee, staffID).Error; err != nil {
					return err
				}
				start, end := appointment.StartTime, appointment.EndTime
				if !input.StartTime.IsZero() {
					start = input.StartTime
				}
				if !input.EndTime.IsZero() {
					end = input.EndTime
				}
				busy, err := employeeBusyIntervals(tx, staffID, start, end, appointment.ID)
				if err != nil {
					return err
				}
				if len(busy) > 0 {
					return services.InvalidOrganization("El personal no está disponible en ese horario")
				}
			}
			return tx.Model(&appointment).Updates(updates).Error
		})
		if err != nil {
			organizationFailure(c, err)
			return
		}
		// Reload to get updated fields for notifications
		_ = db.First(&appointment, appointment.ID).Error

		BroadcastNotification(gin.H{"entityType": "appointment", "action": "refresh"})

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

		if !config.CanAccessAllOffices(user.Role) {
			// Office managers can delete all appointments in their office
			if (user.Role == config.RoleAdmin || user.Role == config.RoleOfficeManager) && user.OfficeID != nil {
				query = query.Where("appointments.office_id = ?", *user.OfficeID)
			} else {
				// Other staff users can only delete appointments they're assigned to or from their department
				if user.Department != nil {
					query = query.Where("department = ?", user.Department)
				}
				query = query.Or("staff_id = ?", user.ID)
			}
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
			Preload("Client").Preload("Case.Client").
			Preload("Case.Office").
			Order("start_time desc")

		// Apply additional filters
		if status := c.Query("status"); status != "" {
			query = query.Where("status = ?", status)
		}
		if category := c.Query("category"); category != "" {
			// Filter by case category since category equals type of case
			query = query.Where("(appointments.case_id IN (SELECT id FROM cases WHERE category = ?) OR (appointments.case_id IS NULL AND appointments.category = ?))", category, category)
		}
		// Handle date filtering (single date or date range)
		if date := c.Query("date"); date != "" {
			if parsedDate, err := time.Parse("2006-01-02", date); err == nil {
				nextDay := parsedDate.Add(24 * time.Hour)
				query = query.Where("start_time >= ? AND start_time < ?", parsedDate, nextDay)
			}
		} else if dateFrom := c.Query("dateFrom"); dateFrom != "" {
			// Handle date range filtering
			var whereClause string
			var args []interface{}

			if parsedDateFrom, err := time.Parse("2006-01-02", dateFrom); err == nil {
				if dateTo := c.Query("dateTo"); dateTo != "" {
					if parsedDateTo, err := time.Parse("2006-01-02", dateTo); err == nil {
						// Include the end date (add one day to make it inclusive)
						endDate := parsedDateTo.Add(24 * time.Hour)
						whereClause = "start_time >= ? AND start_time < ?"
						args = []interface{}{parsedDateFrom, endDate}
					}
				} else {
					// Only dateFrom specified
					whereClause = "start_time >= ?"
					args = []interface{}{parsedDateFrom}
				}

				if whereClause != "" {
					query = query.Where(whereClause, args...)
				}
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
	TimeZone   string             `json:"timeZone"`
	CaseID     uint               `json:"caseId" binding:"required"`
	StaffID    uint               `json:"staffId" binding:"required"`
	Title      string             `json:"title" binding:"required"`
	StartTime  time.Time          `json:"startTime" binding:"required"`
	EndTime    time.Time          `json:"endTime" binding:"required"`
	Category   string             `json:"category" binding:"required"`
	Department string             `json:"department" binding:"required"`
	NewClient  *CreateClientInput `json:"newClient,omitempty"`
	ClientID   *uint              `json:"clientId,omitempty"`
}

// CreateClientInput defines the structure for creating a new client
type CreateClientInput struct {
	FirstName string `json:"firstName" binding:"required"`
	LastName  string `json:"lastName" binding:"required"`
	Email     string `json:"email" binding:"required,email"`
}

// UpdateAppointmentInput defines the structure for updating appointments
type UpdateAppointmentInput struct {
	TimeZone   string    `json:"timeZone,omitempty"`
	Title      string    `json:"title,omitempty"`
	StartTime  time.Time `json:"startTime,omitempty"`
	EndTime    time.Time `json:"endTime,omitempty"`
	Status     string    `json:"status,omitempty"`
	Category   string    `json:"category,omitempty"`
	Department string    `json:"department,omitempty"`
	StaffID    uint      `json:"staffId,omitempty"`
}
