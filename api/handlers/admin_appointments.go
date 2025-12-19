// api/handlers/admin_appointments.go
package handlers

import (
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/BryanPMX/CAF/api/config"
	"github.com/BryanPMX/CAF/api/models"
	"github.com/BryanPMX/CAF/api/notifications"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// validAppointmentStatuses strictly limits appointment statuses allowed in the system
// DEPRECATED: Use config.IsValidAppointmentStatus() instead
var validAppointmentStatuses = map[string]bool{
	string(config.StatusPending):   true,
	string(config.StatusConfirmed): true,
	string(config.StatusCompleted): true,
	string(config.StatusCancelled): true,
	string(config.StatusNoShow):    true,
}

// SmartAppointmentInput defines the flexible structure for scheduling an appointment from the admin portal.
// It uses pointers and nested structs to handle different scenarios gracefully.
type SmartAppointmentInput struct {
	// --- Client Information (only one of these should be provided) ---
	ClientID  *uint     `json:"clientId"` // The ID of an existing client.
	NewClient *struct { // The details to create a new client on the fly.
		FirstName string `json:"firstName" binding:"required"`
		LastName  string `json:"lastName" binding:"required"`
		Email     string `json:"email" binding:"required,email"`
	} `json:"newClient"`

	// --- Case Information (only one of these should be provided) ---
	CaseID  *uint     `json:"caseId"` // The ID of an existing case.
	NewCase *struct { // The details to create a new case.
		Title       string `json:"title" binding:"required"`
		Description string `json:"description"`
		OfficeID    uint   `json:"officeId" binding:"required"`
	} `json:"newCase"`

	// --- Core Appointment Details (always required) ---
	StaffID   uint      `json:"staffId" binding:"required"`
	Title     string    `json:"title" binding:"required"`
	StartTime time.Time `json:"startTime" binding:"required"`
	EndTime   time.Time `json:"endTime" binding:"required"`
	Status    string    `json:"status" binding:"required"`

	// --- Department and Category Information ---
	Department string `json:"department" binding:"required"` // Department for case creation and appointment categorization
	Category   string `json:"category" binding:"required"`   // Category for appointment classification
}

// CreateAppointmentSmart is the new, intelligent handler for creating appointments.
// It handles the complex logic of creating clients and cases as needed.
func CreateAppointmentSmart(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input SmartAppointmentInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// CRITICAL FIX: Wrap entire operation in a database transaction
		// This ensures atomicity - either all operations succeed or all fail
		tx := db.Begin()
		if tx.Error != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start transaction"})
			return
		}

		// Defer rollback in case of any error
		defer func() {
			if r := recover(); r != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Transaction failed due to panic"})
			}
		}()

		var client models.User
		hasClient := false
		var caseRecord models.Case

		// --- Step 1: Determine the Client ---
		if input.ClientID != nil {
			// Scenario: Use an existing client. If not found, try falling back to case's client (if provided). If still not found, continue without client.
			if err := tx.First(&client, *input.ClientID).Error; err == nil {
				hasClient = true
			} else if input.CaseID != nil {
				if err := tx.First(&caseRecord, *input.CaseID).Error; err == nil && caseRecord.ClientID != nil {
					if err := tx.First(&client, *caseRecord.ClientID).Error; err == nil {
						hasClient = true
					}
				}
				// If client still not found, proceed without client
			}
		} else if input.NewClient != nil {
			// Scenario: Create a new client, but first check if ANY user already exists with the same email (including soft-deleted ones).
			var existingUser models.User
			if err := tx.Unscoped().Where("email = ?", input.NewClient.Email).First(&existingUser).Error; err == nil {
				// A user with this email already exists (possibly soft-deleted)
				if existingUser.DeletedAt.Valid {
					// User is soft-deleted, restore them for the appointment
					existingUser.DeletedAt = gorm.DeletedAt{} // Clear the soft delete
					existingUser.FirstName = input.NewClient.FirstName // Update with provided info
					existingUser.LastName = input.NewClient.LastName
					if err := tx.Unscoped().Save(&existingUser).Error; err != nil {
						tx.Rollback()
						c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to restore existing user: " + err.Error()})
						return
					}
					client = existingUser
					hasClient = true
				} else {
					// User exists and is active - cannot create duplicate
					tx.Rollback()
					c.JSON(http.StatusBadRequest, gin.H{
						"error": "A user with this email already exists. Please use the existing client or choose a different email.",
						"existingUser": gin.H{
							"id": existingUser.ID,
							"email": existingUser.Email,
							"role": existingUser.Role,
							"firstName": existingUser.FirstName,
							"lastName": existingUser.LastName,
						},
					})
					return
				}
			} else if err == gorm.ErrRecordNotFound {
				// No user with this email exists, create a new one
				tempPassword := "password123" // Placeholder password
				hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(tempPassword), bcrypt.DefaultCost)
				client = models.User{
					FirstName: input.NewClient.FirstName,
					LastName:  input.NewClient.LastName,
					Email:     input.NewClient.Email,
					Password:  string(hashedPassword),
					Role:      "client",
				}
				if err := tx.Create(&client).Error; err != nil {
					tx.Rollback()
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create new client: " + err.Error()})
					return
				}
				hasClient = true
			} else {
				// Database error
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check for existing user: " + err.Error()})
				return
			}
		} else if input.CaseID != nil {
			// No client provided, but an existing case might reference one. If not found, continue without client.
			if err := tx.First(&caseRecord, *input.CaseID).Error; err == nil && caseRecord.ClientID != nil {
				if err := tx.First(&client, *caseRecord.ClientID).Error; err == nil {
					hasClient = true
				}
			}
		} else {
			tx.Rollback()
			c.JSON(http.StatusBadRequest, gin.H{"error": "Client information (either clientId or newClient) is required."})
			return
		}

		// --- Step 2: Determine the Case ---
		if input.CaseID != nil {
			// Scenario: Use an existing case.
			if err := tx.First(&caseRecord, *input.CaseID).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusBadRequest, gin.H{"error": "Selected case not found: " + err.Error()})
				return
			}
		} else if input.NewCase != nil {
			// Scenario: Create a new case for the client.
			// Use the department from the frontend input instead of staff role
			var category string

			// Priority: Use department from input, then fallback to staff role
			if input.Department != "" {
				category = input.Department
			} else {
				// Fallback: determine from staff role
				var staff models.User
				if err := tx.First(&staff, input.StaffID).Error; err == nil {
					if staff.Role == "admin" {
						category = "General"
					} else {
						// Map staff role to proper department
						switch staff.Role {
						case "lawyer", "attorney", "senior_attorney", "paralegal", "associate":
							category = "Familiar" // Default to Familiar for legal staff
						case "psychologist":
							category = "Psicologia"
						case "social_worker":
							category = "Recursos"
						default:
							category = "General"
						}
					}
				} else {
					category = "General" // Default fallback
				}
			}

			// Get current user ID for CreatedBy field
			userID, _ := c.Get("userID")
			userIDUint, _ := strconv.ParseUint(userID.(string), 10, 32)

			caseRecord = models.Case{
				ClientID: func() *uint {
					if hasClient {
						return &client.ID
					}
					return nil
				}(),
				OfficeID:    input.NewCase.OfficeID,
				Title:       input.NewCase.Title,
				Description: input.NewCase.Description,
				Status:      "open",
				Category:    category,
				CurrentStage: func() string {
					if category == "Familiar" || category == "Civil" {
						return "etapa_inicial"
					}
					return "intake"
				}(),
				CreatedBy: uint(userIDUint),
			}
			if err := tx.Create(&caseRecord).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create new case: " + err.Error()})
				return
			}
			// If we created a new client in this flow, ensure their office is set to the case office
			if hasClient && client.OfficeID == nil {
				client.OfficeID = &caseRecord.OfficeID
				if err := tx.Model(&client).Update("office_id", caseRecord.OfficeID).Error; err != nil {
					tx.Rollback()
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update client office: " + err.Error()})
					return
				}
			}
		} else {
			tx.Rollback()
			c.JSON(http.StatusBadRequest, gin.H{"error": "Case information (either caseId or newCase) is required."})
			return
		}

		// --- Step 3: Create the Appointment ---
		// Determine appointment category and department
		var appointmentCategory, department string

		// Priority: Use department from input, then derive from case category
		if input.Department != "" {
			// If department is explicitly provided, use it
			department = input.Department
			appointmentCategory = input.Category // Use the provided category if available
			if appointmentCategory == "" {
				appointmentCategory = "General"
			}
		} else if caseRecord.Category != "" {
			// Derive department from case category
			appointmentCategory = caseRecord.Category // Appointment category is the case type (e.g., "Divorcios")

			// Map case category to department
			switch caseRecord.Category {
			case "Divorcios", "Guardia y Custodia", "Acto Prejudicial", "Adopcion", "Pension Alimenticia", "Rectificacion de Actas", "Reclamacion de Paternidad", "Prescripcion Positiva", "Reinvindicatorio", "Intestado", "Individual", "Pareja":
				department = "Familiar" // Legal department
			default:
				// For unknown case categories, try to determine from staff role
				var staff models.User
				if err := tx.First(&staff, input.StaffID).Error; err == nil {
					switch staff.Role {
					case "psychologist":
						department = "Psicologia"
					case "social_worker":
						department = "Recursos"
					default:
						department = "Familiar" // Default to legal for other staff
					}
				} else {
					department = "Familiar" // Default fallback
				}
			}
		} else {
			// No case category available, determine from staff role
			var staff models.User
			if err := tx.First(&staff, input.StaffID).Error; err == nil {
				if staff.Role == "admin" {
					appointmentCategory = "General"
					department = "General"
				} else {
					switch staff.Role {
					case "lawyer", "attorney", "senior_attorney", "paralegal", "associate":
						appointmentCategory = "Consulta Legal"
						department = "Familiar"
					case "psychologist":
						appointmentCategory = "Sesion de Psicologia"
						department = "Psicologia"
					case "social_worker":
						appointmentCategory = "Trabajo Social"
						department = "Recursos"
					default:
						appointmentCategory = "General"
						department = "General"
					}
				}
			} else {
				appointmentCategory = "General"
				department = "General"
			}
		}

		appointment := models.Appointment{
			CaseID:     caseRecord.ID,
			StaffID:    input.StaffID,
			OfficeID:   caseRecord.OfficeID, // Set the office ID from the case
			Title:      input.Title,
			StartTime:  input.StartTime,
			EndTime:    input.EndTime,
			Status:     config.AppointmentStatus(input.Status), // Convert string to AppointmentStatus type
			Category:   appointmentCategory,
			Department: department,
		}
		if err := tx.Create(&appointment).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create appointment: " + err.Error()})
			return
		}

		// CRITICAL FIX: Commit the transaction only after all operations succeed
		if err := tx.Commit().Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction: " + err.Error()})
			return
		}

		// --- Step 4: Send Notification (Async) ---
		// Only send notification if a client exists
		if hasClient {
			go func() {
				notifications.SendAppointmentConfirmation(appointment, client)
			}()
		}

		// Return success response with minimal data
		c.JSON(http.StatusCreated, gin.H{
			"id":        appointment.ID,
			"title":     appointment.Title,
			"startTime": appointment.StartTime,
			"status":    appointment.Status,
			"message":   "Appointment created successfully",
		})
	}
}

// AdminAppointmentInput is used for the simpler Update operation.
type AdminAppointmentInput struct {
	CaseID    uint      `json:"caseId" binding:"required"`
	StaffID   uint      `json:"staffId" binding:"required"`
	Title     string    `json:"title" binding:"required"`
	StartTime time.Time `json:"startTime" binding:"required"`
	EndTime   time.Time `json:"endTime" binding:"required"`
	Status    string    `json:"status" binding:"required"`
}

// UpdateAppointmentAdmin modifies an existing appointment.
func UpdateAppointmentAdmin(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var appointment models.Appointment
		if err := db.Where("id = ?", c.Param("id")).First(&appointment).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Appointment not found"})
			return
		}

		var input AdminAppointmentInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Validate the provided status using centralized configuration
		if !config.IsValidAppointmentStatus(input.Status) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid appointment status specified. Allowed values: pending, confirmed, completed, cancelled, no_show"})
			return
		}

		// Update the model fields and save to the database.
		appointment.CaseID = input.CaseID
		appointment.StaffID = input.StaffID
		appointment.Title = input.Title
		appointment.StartTime = input.StartTime
		appointment.EndTime = input.EndTime
		appointment.Status = config.AppointmentStatus(input.Status) // Convert string to AppointmentStatus type
		db.Save(&appointment)

		// Generate notification for client if appointment status is changed to "confirmed"
		if input.Status == "confirmed" && appointment.CaseID > 0 {
			// Get the case to find the client
			var caseRecord models.Case
			if err := db.First(&caseRecord, appointment.CaseID).Error; err == nil && caseRecord.ClientID != nil {
				// Format the appointment date and time
				formattedDateTime := appointment.StartTime.Format("02/01/2006 a las 15:04")

				// Create notification message in Spanish
				notificationMessage := "Su cita ha sido confirmada para el " + formattedDateTime + "."

				// Create link to the appointment
				appointmentLink := "/app/appointments/" + strconv.FormatUint(uint64(appointment.ID), 10)

				// Create notification for the client
				if err := CreateNotification(db, *caseRecord.ClientID, notificationMessage, "success", &appointmentLink); err != nil {
					// Log error but don't fail the appointment update
					_ = err // Suppress unused variable warning
				}
			}
		}

		c.JSON(http.StatusOK, appointment)
	}
}

// FixExistingAppointmentCategories fixes existing appointments that have incorrect category/department values
func FixExistingAppointmentCategories(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get all appointments that need fixing
		var appointments []models.Appointment
		if err := db.Preload("Case").Where("deleted_at IS NULL").Find(&appointments).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch appointments"})
			return
		}

		fixed := 0
		for _, appointment := range appointments {
			if appointment.Case.ID != 0 && appointment.Case.Category != "" {
				// Determine correct department based on case category
				var correctDepartment string
				switch appointment.Case.Category {
				case "Divorcios", "Guardia y Custodia", "Acto Prejudicial", "Adopcion", "Pension Alimenticia", "Rectificacion de Actas", "Reclamacion de Paternidad", "Prescripcion Positiva", "Reinvindicatorio", "Intestado", "Individual", "Pareja":
					correctDepartment = "Familiar"
				default:
					// Check staff role for other cases
					var staff models.User
					if err := db.First(&staff, appointment.StaffID).Error; err == nil {
						switch staff.Role {
						case "psychologist":
							correctDepartment = "Psicologia"
						case "social_worker":
							correctDepartment = "Recursos"
						default:
							correctDepartment = "Familiar"
						}
					} else {
						correctDepartment = "Familiar"
					}
				}

				// Update appointment with correct values
				updates := map[string]interface{}{
					"category":   appointment.Case.Category, // Case type (e.g., "Divorcios")
					"department": correctDepartment,         // Department (e.g., "Familiar")
				}

				if err := db.Model(&appointment).Updates(updates).Error; err != nil {
					log.Printf("Failed to update appointment %d: %v", appointment.ID, err)
					continue
				}
				fixed++
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"message": fmt.Sprintf("Fixed %d appointments", fixed),
			"total":   len(appointments),
		})
	}
}

// DeleteAppointmentAdmin removes an appointment with enhanced security and audit logging
func DeleteAppointmentAdmin(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		appointmentID := c.Param("id")

		// Get current user context for audit logging
		currentUser, _ := c.Get("currentUser")
		user := currentUser.(models.User)

		var appointment models.Appointment
		if err := db.Preload("Case").Preload("Staff").First(&appointment, appointmentID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Cita no encontrada"})
			return
		}

		// Professional Security Checks for non-admin users only
		if user.Role != "admin" {
			// Prevent deletion of completed appointments
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

			// Prevent deletion of past appointments
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
		}

		// Professional Security Check 3: Create audit log before deletion
		auditLog := models.CaseEvent{
			CaseID:     appointment.CaseID,
			UserID:     user.ID,
			EventType:  "appointment_deletion_admin",
			Visibility: "internal",
			CommentText: fmt.Sprintf("Cita eliminada por administrador %s %s (ID: %d). Cita: %s programada para %s",
				user.FirstName, user.LastName, user.ID, appointment.Title, appointment.StartTime.Format("02/01/2006 15:04")),
		}

		if err := db.Create(&auditLog).Error; err != nil {
			log.Printf("WARNING: Failed to create audit log for admin appointment deletion: %v", err)
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
			"message":     "Cita cancelada exitosamente por administrador",
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

// GetAppointmentByIDAdmin retrieves a single appointment by its ID with all critical nested data
func GetAppointmentByIDAdmin(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		appointmentID := c.Param("id")
		var appointment models.Appointment

		// Use Preload to efficiently load appointment with all related data
		query := db.Preload("Case").Preload("Case.Client").Preload("Staff").Where("id = ? AND deleted_at IS NULL", appointmentID)

		if err := query.First(&appointment).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "Appointment not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve appointment"})
			return
		}

		// Build comprehensive response with all nested data
		response := gin.H{
			"appointment": appointment,
			"case": func() gin.H {
				if appointment.Case.ID != 0 {
					return gin.H{
						"id":          appointment.Case.ID,
						"title":       appointment.Case.Title,
						"description": appointment.Case.Description,
						"status":      appointment.Case.Status,
					}
				}
				return gin.H{"id": appointment.CaseID}
			}(),
			"staff": func() gin.H {
				if appointment.Staff.ID != 0 {
					return gin.H{
						"id":        appointment.Staff.ID,
						"firstName": appointment.Staff.FirstName,
						"lastName":  appointment.Staff.LastName,
						"email":     appointment.Staff.Email,
					}
				}
				return gin.H{"id": appointment.StaffID}
			}(),
			"client": func() gin.H {
				if appointment.Case.ID != 0 && appointment.Case.Client != nil {
					return gin.H{
						"id":        appointment.Case.Client.ID,
						"firstName": appointment.Case.Client.FirstName,
						"lastName":  appointment.Case.Client.LastName,
						"email":     appointment.Case.Client.Email,
					}
				}
				return gin.H{}
			}(),
			"office": gin.H{
				"id": appointment.OfficeID,
			},
		}

		c.JSON(http.StatusOK, response)
	}
}

// GetClientCasesForAppointment returns all existing cases for a client when setting up an appointment
// This endpoint is used to populate the case dropdown in the appointment creation form
//
// Frontend Usage:
// 1. When a client is selected in the appointment creation form
// 2. Call GET /api/v1/admin/clients/{clientId}/cases-for-appointment
// 3. Use the returned cases array to populate the case dropdown
// 4. If no cases exist, show option to create a new case
//
// Response format:
//
//	{
//	  "client": { "id": 1, "firstName": "John", "lastName": "Doe", "email": "john@example.com" },
//	  "cases": [
//	    { "id": 1, "title": "Divorce Case", "category": "Familiar", "status": "open", "currentStage": "etapa_inicial", "createdAt": "2025-09-02T..." }
//	  ],
//	  "count": 1
//	}
func GetClientCasesForAppointment(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		clientIDStr := c.Param("clientId")
		clientID, err := strconv.ParseUint(clientIDStr, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid client ID"})
			return
		}

		// Verify the client exists
		var client models.User
		if err := db.Where("id = ? AND role = ?", uint(clientID), "client").First(&client).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "Client not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve client"})
			return
		}

		// Get all cases appropriate for appointment scheduling
		// Initialize with empty slice to prevent null JSON response
		cases := make([]models.Case, 0)
		query := db.Model(&models.Case{}).
			Where("client_id = ?", client.ID).
			Where("deleted_at IS NULL").                                  // Not soft-deleted
			Where("is_archived = ?", false).                              // Not archived
			Where("status NOT IN (?)", []string{"deleted", "cancelled"}). // Exclude deleted/cancelled, but allow closed/resolved cases
			Order("created_at DESC")

		if err := query.Find(&cases).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve client cases"})
			return
		}

		// Return cases with minimal data for dropdown
		var caseOptions []gin.H
		for _, caseItem := range cases {
			caseOptions = append(caseOptions, gin.H{
				"id":           caseItem.ID,
				"title":        caseItem.Title,
				"category":     caseItem.Category,
				"status":       caseItem.Status,
				"currentStage": caseItem.CurrentStage,
				"createdAt":    caseItem.CreatedAt,
			})
		}

		c.JSON(http.StatusOK, gin.H{
			"client": gin.H{
				"id":        client.ID,
				"firstName": client.FirstName,
				"lastName":  client.LastName,
				"email":     client.Email,
			},
			"cases": caseOptions,
			"count": len(caseOptions),
			"debug": gin.H{
				"clientId":        client.ID,
				"query":           "client_id = " + clientIDStr + " AND deleted_at IS NULL AND is_archived = false AND status NOT IN ('deleted', 'cancelled')",
				"totalCasesFound": len(cases),
			},
		})
	}
}

// GetClientCasesForAppointmentScoped returns cases for a client filtered by the user's office scope
// This is used by office managers who should only see cases within their office
func GetClientCasesForAppointmentScoped(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		clientIDStr := c.Param("clientId")
		clientID, err := strconv.ParseUint(clientIDStr, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid client ID"})
			return
		}

		// Get office scope from middleware
		officeScopeID, hasOfficeScope := c.Get("officeScopeID")

		// Verify the client exists
		var client models.User
		if err := db.Where("id = ? AND role = ?", uint(clientID), "client").First(&client).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "Client not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve client"})
			return
		}

		// Get cases appropriate for appointment scheduling, scoped by office
		cases := make([]models.Case, 0)
		query := db.Model(&models.Case{}).
			Where("client_id = ?", client.ID).
			Where("deleted_at IS NULL").
			Where("is_archived = ?", false).
			Where("status NOT IN (?)", []string{"deleted", "cancelled"})

		// Apply office scoping if the user has an office scope
		if hasOfficeScope && officeScopeID != nil {
			query = query.Where("office_id = ?", officeScopeID)
		}

		query = query.Order("created_at DESC")

		if err := query.Find(&cases).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve client cases"})
			return
		}

		// Return cases with minimal data for dropdown
		var caseOptions []gin.H
		for _, caseItem := range cases {
			caseOptions = append(caseOptions, gin.H{
				"id":           caseItem.ID,
				"title":        caseItem.Title,
				"category":     caseItem.Category,
				"status":       caseItem.Status,
				"currentStage": caseItem.CurrentStage,
				"createdAt":    caseItem.CreatedAt,
			})
		}

		c.JSON(http.StatusOK, gin.H{
			"client": gin.H{
				"id":        client.ID,
				"firstName": client.FirstName,
				"lastName":  client.LastName,
				"email":     client.Email,
			},
			"cases": caseOptions,
			"count": len(caseOptions),
		})
	}
}