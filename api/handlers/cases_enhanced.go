package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/BryanPMX/CAF/api/config"
	"github.com/BryanPMX/CAF/api/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// Simple in-memory cache for case details
var (
	caseCache    = make(map[string]*models.Case)
	caseCacheMux sync.RWMutex
	cacheTTL     = 5 * time.Minute // Cache for 5 minutes
)

// cacheKey generates a cache key for a case
func cacheKey(caseID string, light bool) string {
	if light {
		return "light:" + caseID
	}
	return "full:" + caseID
}

// getFromCache retrieves a case from cache if it exists and is not expired
func getFromCache(caseID string, light bool) (*models.Case, bool) {
	key := cacheKey(caseID, light)
	caseCacheMux.RLock()
	defer caseCacheMux.RUnlock()

	if cached, exists := caseCache[key]; exists {
		// Check if cache is still valid (simple TTL check)
		if time.Since(cached.UpdatedAt) < cacheTTL {
			return cached, true
		}
		// Remove expired cache entry
		delete(caseCache, key)
	}
	return nil, false
}

// setCache stores a case in cache
func setCache(caseID string, light bool, caseData *models.Case) {
	key := cacheKey(caseID, light)
	caseCacheMux.Lock()
	defer caseCacheMux.Unlock()

	// Limit cache size to prevent memory issues
	if len(caseCache) > 1000 {
		// Remove oldest entries (simple cleanup)
		for k := range caseCache {
			delete(caseCache, k)
			break
		}
	}

	caseCache[key] = caseData
}

// invalidateCache removes all cached entries for a specific case
func invalidateCache(caseID string) {
	caseCacheMux.Lock()
	defer caseCacheMux.Unlock()

	delete(caseCache, "light:"+caseID)
	delete(caseCache, "full:"+caseID)
}

// GetCasesEnhanced returns cases based on user permissions and assignments
func GetCasesEnhanced(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Initialize with empty slice to prevent null JSON response
		cases := make([]models.Case, 0)
		query := db.Preload("Client").Preload("Office").Preload("PrimaryStaff")

		// Exclude archived cases from main view
		query = query.Where("is_archived = ?", false)

		// Apply access control based on user role and department
		userRole, _ := c.Get("userRole")
		userDepartment, _ := c.Get("userDepartment")
		officeScopeID, _ := c.Get("officeScopeID")

		if (userRole != "admin" && userRole != "client") || officeScopeID != nil {
			// Staff-like users see cases from their office and department
			if officeScopeID != nil {
				query = query.Where("office_id = ?", officeScopeID)
			}

			if userDepartment != nil {
				query = query.Where("category = ?", userDepartment)
			}

			// Also include cases where the user is assigned
			userID, _ := c.Get("userID")
			userIDUint, _ := strconv.ParseUint(userID.(string), 10, 32)
			query = query.Or("id IN (SELECT case_id FROM user_case_assignments WHERE user_id = ?)", userIDUint)
		}

		// Apply additional filters from query parameters
		if status := c.Query("status"); status != "" {
			query = query.Where("status = ?", status)
		}
		if category := c.Query("category"); category != "" {
			query = query.Where("category = ?", category)
		}
		if stage := c.Query("stage"); stage != "" {
			query = query.Where("current_stage = ?", stage)
		}

		// Exclude soft-deleted/archived cases from listings
		query = query.Where("deleted_at IS NULL AND (is_archived = FALSE OR is_archived IS NULL) AND status <> ?", "deleted")

		// Execute query with ordering
		if err := query.Order("created_at desc").Find(&cases).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve cases"})
			return
		}

		c.JSON(http.StatusOK, cases)
	}
}

// GetCaseByIDEnhanced returns a specific case with access control
func GetCaseByIDEnhanced(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		caseID := c.Param("id")
		var caseDetail models.Case

		// Support lightweight mode for faster initial UI load
		light := c.Query("light") == "true"

		// Check cache first for better performance
		if cached, found := getFromCache(caseID, light); found {
			c.JSON(http.StatusOK, cached)
			return
		}

		// Build base query with minimal preloading for fast response
		query := db.Model(&caseDetail).Where("id = ?", caseID)

		// Always preload essential relations with minimal fields
		query = query.Preload("Client", func(db *gorm.DB) *gorm.DB {
			return db.Unscoped().Select("id, first_name, last_name")
		}).Preload("Office", func(db *gorm.DB) *gorm.DB {
			return db.Select("id, name")
		})

		// Apply access control early to avoid unnecessary preloading
		userRole, _ := c.Get("userRole")
		userDepartment, _ := c.Get("userDepartment")
		officeScopeID, _ := c.Get("officeScopeID")

		if (userRole != "admin" && userRole != "client") || officeScopeID != nil {
			// Staff-like users can only access cases from their office and department
			if officeScopeID != nil {
				query = query.Where("office_id = ?", officeScopeID)
			}

			if userDepartment != nil {
				query = query.Where("category = ?", userDepartment)
			}

			// Or cases where they are assigned
			userID, _ := c.Get("userID")
			userIDUint, _ := strconv.ParseUint(userID.(string), 10, 32)
			query = query.Or("id IN (SELECT case_id FROM user_case_assignments WHERE user_id = ?)", userIDUint)
		}

		// Exclude soft-deleted/archived cases
		query = query.Where("deleted_at IS NULL AND (is_archived = FALSE OR is_archived IS NULL) AND status <> ?", "deleted")

		// For lightweight mode, only load essential data
		if light {
			// Minimal preloading for fast response
			query = query.Preload("PrimaryStaff", func(db *gorm.DB) *gorm.DB {
				return db.Select("id, first_name, last_name")
			})
		} else {
			// Full preloading only when explicitly requested
			query = query.
				Preload("PrimaryStaff", func(db *gorm.DB) *gorm.DB {
					return db.Select("id, first_name, last_name")
				}).
				Preload("AssignedStaff", func(db *gorm.DB) *gorm.DB {
					return db.Select("users.id, users.first_name, users.last_name")
				}).
				Preload("Appointments.Staff", func(db *gorm.DB) *gorm.DB {
					return db.Select("id, first_name, last_name, role, department")
				}).
				Preload("Tasks.AssignedTo", func(db *gorm.DB) *gorm.DB {
					return db.Select("id, first_name, last_name")
				}).
				Preload("CaseEvents.User", func(db *gorm.DB) *gorm.DB {
					return db.Select("id, first_name, last_name")
				})
		}

		if err := query.First(&caseDetail, caseID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "Case not found or access denied"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve case details"})
			return
		}

		// Cache the result for future requests
		setCache(caseID, light, &caseDetail)

		c.JSON(http.StatusOK, caseDetail)
	}
}

// getDefaultStage returns the appropriate default stage based on case category
func getDefaultStage(category string) string {
	switch category {
	case "Familiar", "Civil":
		return "etapa_inicial" // Legal cases start with "Etapa Inicial"
	default:
		return "intake" // Non-legal cases start with "intake"
	}
}

// CreateCaseEnhanced creates a new case with proper department assignment
func CreateCaseEnhanced(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input CreateCaseInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Get current user context
		currentUser, _ := c.Get("currentUser")
		user := currentUser.(models.User)

		// Validate department compatibility for staff users
		if user.Role == "staff" && user.Department != nil {
			if input.Category != *user.Department {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Case category must match your department"})
				return
			}
		}

		// Create the case
		newCase := models.Case{
			OfficeID:       input.OfficeID,
			Title:          input.Title,
			Description:    input.Description,
			Status:         "open",
			CurrentStage:   getDefaultStage(input.Category), // Set appropriate default stage
			Category:       input.Category,
			PrimaryStaffID: &user.ID, // Assign the creating user as primary staff
			CreatedBy:      user.ID,  // Set the creating user
		}

		// Handle ClientID safely - only set if provided
		if input.ClientID != nil {
			newCase.ClientID = input.ClientID
		} else if input.FirstName != "" && input.LastName != "" && input.Email != "" {
			// Create new client if provided
			newClient := models.User{
				FirstName: input.FirstName,
				LastName:  input.LastName,
				Email:     input.Email,
				Role:      "client",
				Password:  "temp-password-" + time.Now().Format("20060102150405"), // Temporary password for new clients
				OfficeID:  &input.OfficeID,
			}

			if err := db.Create(&newClient).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create new client"})
				return
			}

			newCase.ClientID = &newClient.ID
		}

		// Assign fee if provided
		if input.Fee != nil {
			newCase.Fee = *input.Fee
		}

		// Set legal metadata if provided
		if strings.TrimSpace(input.Court) != "" {
			newCase.Court = input.Court
		}
		if strings.TrimSpace(input.DocketNumber) != "" {
			newCase.DocketNumber = input.DocketNumber
		}

		// Use transaction to ensure data consistency
		err := db.Transaction(func(tx *gorm.DB) error {
			// Create the case
			if err := tx.Create(&newCase).Error; err != nil {
				return err
			}

			// Create assignment record for the creating user
			assignment := models.UserCaseAssignment{
				UserID:     user.ID,
				CaseID:     newCase.ID,
				Role:       "primary",
				AssignedAt: time.Now(),
			}

			if err := tx.Create(&assignment).Error; err != nil {
				return err
			}

			return nil
		})

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create case and assignment"})
			return
		}

		c.JSON(http.StatusCreated, newCase)
	}
}

// AssignStaffToCase assigns additional staff members to a case
func AssignStaffToCase(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		caseID := c.Param("id")
		var input struct {
			UserID uint   `json:"userId" binding:"required"`
			Role   string `json:"role" binding:"required"`
		}

		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Check if user has permission to assign staff to this case
		currentUser, _ := c.Get("currentUser")
		user := currentUser.(models.User)

		// Convert caseID string to uint
		caseIDUint, err := strconv.ParseUint(caseID, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid case ID"})
			return
		}

		if user.Role == "staff" {
			// Staff can only assign to cases they're assigned to
			var assignment models.UserCaseAssignment
			if err := db.Where("user_id = ? AND case_id = ?", user.ID, caseIDUint).First(&assignment).Error; err != nil {
				c.JSON(http.StatusForbidden, gin.H{"error": "Access denied: You can only assign staff to cases you're assigned to"})
				return
			}
		}

		// Check if the target user exists and is staff
		var targetUser models.User
		if err := db.Where("id = ? AND role = ?", input.UserID, "staff").First(&targetUser).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Target user not found or is not staff"})
			return
		}

		// Create the assignment
		assignment := models.UserCaseAssignment{
			UserID: input.UserID,
			CaseID: uint(caseIDUint),
			Role:   input.Role,
		}

		if err := db.Create(&assignment).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to assign staff to case"})
			return
		}

		c.JSON(http.StatusCreated, gin.H{"message": "Staff assigned successfully", "assignment": assignment})
	}
}

// GetMyCases returns cases assigned to the current user
func GetMyCases(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDUint, _ := strconv.ParseUint(userID.(string), 10, 32)

		var cases []models.Case = make([]models.Case, 0)
		query := db.Preload("Client").Preload("Office").Preload("PrimaryStaff")

		// Get cases where user is assigned and exclude soft-deleted/archived
		query = query.Joins("INNER JOIN user_case_assignments ON user_case_assignments.case_id = cases.id").
			Where("user_case_assignments.user_id = ?", userIDUint).
			Where("cases.deleted_at IS NULL AND (cases.is_archived = FALSE OR cases.is_archived IS NULL) AND cases.status <> ?", "deleted")

		if err := query.Order("cases.created_at desc").Find(&cases).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve assigned cases"})
			return
		}

		c.JSON(http.StatusOK, cases)
	}
}

// CreateCaseInput defines the structure for creating a new case
type CreateCaseInput struct {
	ClientID    *uint    `json:"clientId,omitempty"`
	OfficeID    uint     `json:"officeId" binding:"required"`
	Title       string   `json:"title" binding:"required"`
	Description string   `json:"description" binding:"required"`
	Category    string   `json:"category" binding:"required"` // e.g., "Legal", "Psychology"
	Fee         *float64 `json:"fee,omitempty"`

	// Fields for creating new clients
	FirstName string `json:"firstName,omitempty"`
	LastName  string `json:"lastName,omitempty"`
	Email     string `json:"email,omitempty"`

	// Optional legal fields
	Court        string `json:"court,omitempty"`
	DocketNumber string `json:"docketNumber,omitempty"`
}

// UpdateCaseStage updates the current stage of a case with automatic status synchronization
func UpdateCaseStage(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		caseID := c.Param("id")
		var input struct {
			Stage string `json:"stage" binding:"required"`
		}

		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Convert caseID string to uint
		caseIDUint, err := strconv.ParseUint(caseID, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ID de caso inválido"})
			return
		}

		// Check if case exists
		var caseRecord models.Case
		if err := db.First(&caseRecord, caseIDUint).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Caso no encontrado"})
			return
		}

		// Professional Security Check: Validate stage transition
		currentStageIndex := -1
		newStageIndex := -1

		// Get the appropriate stage set based on case category
		caseStages := config.GetCaseStages(caseRecord.Category)

		for i, stage := range caseStages {
			if stage == caseRecord.CurrentStage {
				currentStageIndex = i
			}
			if stage == input.Stage {
				newStageIndex = i
			}
		}

		// Prevent backward stage transitions (except for admin users)
		currentUser, _ := c.Get("currentUser")
		user := currentUser.(models.User)

		if currentStageIndex != -1 && newStageIndex != -1 && newStageIndex < currentStageIndex {
			if user.Role != "admin" {
				c.JSON(http.StatusBadRequest, gin.H{
					"error":          "No se puede retroceder a una etapa anterior sin autorización de administrador",
					"currentStage":   caseRecord.CurrentStage,
					"requestedStage": input.Stage,
				})
				return
			}
		}

		// Use transaction to ensure data consistency
		tx := db.Begin()
		defer func() {
			if r := recover(); r != nil {
				tx.Rollback()
			}
		}()

		// Update the case stage
		if err := tx.Model(&caseRecord).Update("current_stage", input.Stage).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al actualizar la etapa del caso"})
			return
		}

		// Professional Feature: Automatic status synchronization based on stage
		var newStatus string
		var statusReason string

		// Handle both default and legal case stages
		switch input.Stage {
		// Default stages
		case "intake":
			newStatus = "open"
			statusReason = "Caso en proceso de recepción"
		case "initial_consultation":
			newStatus = "active"
			statusReason = "Consulta inicial programada"
		case "document_review":
			newStatus = "active"
			statusReason = "Revisión de documentos en curso"
		case "action_plan":
			newStatus = "active"
			statusReason = "Plan de acción en desarrollo"
		case "resolution":
			newStatus = "resolved"
			statusReason = "Resolución alcanzada"
		case "closed":
			newStatus = "closed"
			statusReason = "Caso cerrado exitosamente"

		// Legal case stages
		case "etapa_inicial":
			newStatus = "open"
			statusReason = "Caso en etapa inicial"
		case "notificacion":
			newStatus = "active"
			statusReason = "Proceso de notificación en curso"
		case "audiencia_preliminar":
			newStatus = "active"
			statusReason = "Audiencia preliminar programada"
		case "audiencia_juicio":
			newStatus = "active"
			statusReason = "Audiencia de juicio en curso"
		case "sentencia":
			newStatus = "resolved"
			statusReason = "Sentencia emitida"

		default:
			newStatus = "open"
			statusReason = "Etapa actualizada"
		}

		// Update case status if it has changed
		if caseRecord.Status != newStatus {
			if err := tx.Model(&caseRecord).Update("status", newStatus).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al actualizar el estado del caso"})
				return
			}
		}

		// Professional Feature: Synchronize appointment statuses based on case stage
		var appointments []models.Appointment = make([]models.Appointment, 0)
		if err := tx.Where("case_id = ?", caseIDUint).Find(&appointments).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al recuperar citas del caso"})
			return
		}

		// Update appointment statuses based on case stage
		for _, appointment := range appointments {
			var appointmentStatus string

			switch input.Stage {
			case "closed":
				// If case is closed, mark all appointments as completed
				appointmentStatus = "completed"
			case "resolution":
				// If case is resolved, mark future appointments as cancelled
				if time.Now().Before(appointment.StartTime) {
					appointmentStatus = "cancelled"
				} else {
					appointmentStatus = "completed"
				}
			case "action_plan":
				// If case is in action plan, keep appointments as confirmed
				if appointment.Status == "pending" {
					appointmentStatus = "confirmed"
				}
			default:
				// For other stages, maintain current appointment status
				continue
			}

			if appointmentStatus != "" && appointment.Status != appointmentStatus {
				if err := tx.Model(&appointment).Update("status", appointmentStatus).Error; err != nil {
					tx.Rollback()
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al sincronizar estado de citas"})
					return
				}
			}
		}

		// Create audit log for stage change
		auditLog := models.CaseEvent{
			CaseID:     uint(caseIDUint),
			UserID:     user.ID,
			EventType:  "stage_change",
			Visibility: "internal",
			CommentText: fmt.Sprintf("Etapa del caso cambiada de '%s' a '%s' por %s %s. Estado: %s. Razón: %s",
				caseRecord.CurrentStage, input.Stage, user.FirstName, user.LastName, newStatus, statusReason),
		}

		if err := tx.Create(&auditLog).Error; err != nil {
			log.Printf("WARNING: Failed to create audit log for stage change: %v", err)
		}

		// Commit transaction
		if err := tx.Commit().Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al confirmar los cambios"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Etapa del caso actualizada exitosamente",
			"case": gin.H{
				"id":           caseRecord.ID,
				"currentStage": input.Stage,
				"status":       newStatus,
				"updatedAt":    time.Now(),
			},
			"changes": gin.H{
				"stageChange": gin.H{
					"from": caseRecord.CurrentStage,
					"to":   input.Stage,
				},
				"statusChange": gin.H{
					"from": caseRecord.Status,
					"to":   newStatus,
				},
				"appointmentsUpdated": len(appointments),
				"reason":              statusReason,
			},
		})
	}
}

// UpdateCaseInput defines the structure for updating a case
type UpdateCaseInput struct {
	Title        string `json:"title,omitempty"`
	Description  string `json:"description,omitempty"`
	Category     string `json:"category,omitempty"`
	Status       string `json:"status,omitempty"`
	Court        string `json:"court,omitempty"`
	DocketNumber string `json:"docketNumber,omitempty"`
}

// UpdateCase updates general case information with status synchronization
func UpdateCase(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		caseID := c.Param("id")
		var input UpdateCaseInput

		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Convert caseID string to uint
		caseIDUint, err := strconv.ParseUint(caseID, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ID de caso inválido"})
			return
		}

		// Check if case exists
		var caseRecord models.Case
		if err := db.First(&caseRecord, caseIDUint).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Caso no encontrado"})
			return
		}

		// Get current user context for audit logging
		currentUser, _ := c.Get("currentUser")
		user := currentUser.(models.User)

		// Use transaction to ensure data consistency
		tx := db.Begin()
		defer func() {
			if r := recover(); r != nil {
				tx.Rollback()
			}
		}()

		// Build updates map
		updates := make(map[string]interface{})
		var changes []string

		if input.Title != "" && input.Title != caseRecord.Title {
			updates["title"] = input.Title
			changes = append(changes, fmt.Sprintf("título: '%s' → '%s'", caseRecord.Title, input.Title))
		}
		if input.Description != "" && input.Description != caseRecord.Description {
			updates["description"] = input.Description
			changes = append(changes, "descripción actualizada")
		}
		if input.Category != "" && input.Category != caseRecord.Category {
			updates["category"] = input.Category
			changes = append(changes, fmt.Sprintf("categoría: '%s' → '%s'", caseRecord.Category, input.Category))
		}
		if input.Status != "" && input.Status != caseRecord.Status {
			updates["status"] = input.Status
			changes = append(changes, fmt.Sprintf("estado: '%s' → '%s'", caseRecord.Status, input.Status))
		}
		// Allow clearing court field (empty string is valid)
		if input.Court != caseRecord.Court {
			updates["court"] = input.Court
			if input.Court == "" {
				changes = append(changes, "juzgado: eliminado")
			} else {
				changes = append(changes, fmt.Sprintf("juzgado: '%s' → '%s'", caseRecord.Court, input.Court))
			}
		}
		// Allow clearing docket number field (empty string is valid)
		if input.DocketNumber != caseRecord.DocketNumber {
			updates["docket_number"] = input.DocketNumber
			if input.DocketNumber == "" {
				changes = append(changes, "expediente: eliminado")
			} else {
				changes = append(changes, fmt.Sprintf("expediente: '%s' → '%s'", caseRecord.DocketNumber, input.DocketNumber))
			}
		}

		// If no changes, return early
		if len(updates) == 0 {
			c.JSON(http.StatusOK, gin.H{
				"message": "No se realizaron cambios en el caso",
				"case":    caseRecord,
			})
			return
		}

		// Update the case
		if err := tx.Model(&caseRecord).Updates(updates).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al actualizar el caso"})
			return
		}

		// Invalidate cache for this case to ensure fresh data
		invalidateCache(caseID)

		// Professional Feature: Status synchronization with appointments
		if input.Status != "" && input.Status != caseRecord.Status {
			var appointments []models.Appointment = make([]models.Appointment, 0)
			if err := tx.Where("case_id = ?", caseIDUint).Find(&appointments).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al recuperar citas del caso"})
				return
			}

			// Update appointment statuses based on case status change
			for _, appointment := range appointments {
				var appointmentStatus string

				switch input.Status {
				case "closed":
					// If case is closed, mark all appointments as completed
					appointmentStatus = "completed"
				case "resolved":
					// If case is resolved, mark future appointments as cancelled
					if time.Now().Before(appointment.StartTime) {
						appointmentStatus = "cancelled"
					} else {
						appointmentStatus = "completed"
					}
				case "cancelled":
					// If case is cancelled, mark all appointments as cancelled
					appointmentStatus = "cancelled"
				case "active":
					// If case is active, keep appointments as confirmed
					if appointment.Status == "pending" {
						appointmentStatus = "confirmed"
					}
				default:
					// For other statuses, maintain current appointment status
					continue
				}

				if appointmentStatus != "" && appointment.Status != appointmentStatus {
					if err := tx.Model(&appointment).Update("status", appointmentStatus).Error; err != nil {
						tx.Rollback()
						c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al sincronizar estado de citas"})
						return
					}
				}
			}
		}

		// Create audit log for case update
		auditLog := models.CaseEvent{
			CaseID:     uint(caseIDUint),
			UserID:     user.ID,
			EventType:  "case_update",
			Visibility: "internal",
			CommentText: fmt.Sprintf("Caso actualizado por %s %s. Cambios: %s",
				user.FirstName, user.LastName, strings.Join(changes, ", ")),
		}

		if err := tx.Create(&auditLog).Error; err != nil {
			log.Printf("WARNING: Failed to create audit log for case update: %v", err)
		}

		// Commit transaction
		if err := tx.Commit().Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al confirmar los cambios"})
			return
		}

		// Reload case data to get updated information
		if err := db.First(&caseRecord, caseIDUint).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al recuperar datos actualizados del caso"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Caso actualizado exitosamente",
			"case":    caseRecord,
			"changes": gin.H{
				"modifiedFields": changes,
				"updatedAt":      time.Now(),
				"updatedBy": gin.H{
					"id":   user.ID,
					"name": fmt.Sprintf("%s %s", user.FirstName, user.LastName),
					"role": user.Role,
				},
			},
		})
	}
}

// DeleteCase deletes a case with enhanced security and professional access control
func DeleteCase(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		caseID := c.Param("id")

		// Convert caseID string to uint
		caseIDUint, err := strconv.ParseUint(caseID, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ID de caso inválido"})
			return
		}

		// Get current user context
		currentUser, _ := c.Get("currentUser")
		user := currentUser.(models.User)

		// Check if case exists and load related data
		var caseRecord models.Case
		if err := db.Preload("Appointments").Preload("Tasks").First(&caseRecord, caseIDUint).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Caso no encontrado"})
			return
		}

		// Professional Security Check 1: Prevent deletion of active cases
		if caseRecord.Status == "active" || caseRecord.Status == "open" {
			// Check if case has active appointments or pending tasks
			var activeAppointments int64
			var pendingTasks int64

			db.Model(&models.Appointment{}).Where("case_id = ? AND status IN (?)", caseIDUint, []string{"confirmed", "pending"}).Count(&activeAppointments)
			db.Model(&models.Task{}).Where("case_id = ? AND status = ?", caseIDUint, "pending").Count(&pendingTasks)

			if activeAppointments > 0 || pendingTasks > 0 {
				c.JSON(http.StatusForbidden, gin.H{
					"error": "No se puede eliminar un caso activo con citas o tareas pendientes",
					"details": gin.H{
						"activeAppointments": activeAppointments,
						"pendingTasks":       pendingTasks,
					},
				})
				return
			}
		}

		// Professional Security Check 2: Apply role-based access control
		if user.Role == "staff" {
			// Staff users can only delete cases they're assigned to
			var assignment models.UserCaseAssignment
			if err := db.Where("user_id = ? AND case_id = ?", user.ID, caseIDUint).First(&assignment).Error; err != nil {
				c.JSON(http.StatusForbidden, gin.H{"error": "Acceso denegado: Solo puede eliminar casos asignados a usted"})
				return
			}

			// Check office access
			if user.OfficeID != nil && *user.OfficeID != caseRecord.OfficeID {
				c.JSON(http.StatusForbidden, gin.H{"error": "Acceso denegado: El caso pertenece a una oficina diferente"})
				return
			}

			// Check department compatibility
			if user.Department != nil && *user.Department != caseRecord.Category {
				c.JSON(http.StatusForbidden, gin.H{"error": "Acceso denegado: Categoría del caso no compatible con su departamento"})
				return
			}
		}

		// Professional Security Check 3: Admin override with confirmation
		if user.Role == "admin" {
			// For admin users, check if this is a high-impact deletion
			var totalAppointments int64
			var totalTasks int64
			var totalComments int64

			db.Model(&models.Appointment{}).Where("case_id = ?", caseIDUint).Count(&totalAppointments)
			db.Model(&models.Task{}).Where("case_id = ?", caseIDUint).Count(&totalTasks)
			db.Model(&models.CaseEvent{}).Where("case_id = ?", caseIDUint).Count(&totalComments)

			// If case has significant data, require additional confirmation
			if totalAppointments > 5 || totalTasks > 3 || totalComments > 10 {
				// Check if admin provided force delete confirmation
				forceDelete := c.Query("force") == "true"
				if !forceDelete {
					c.JSON(http.StatusBadRequest, gin.H{
						"error": "Este caso contiene datos significativos y requiere confirmación de eliminación forzada",
						"details": gin.H{
							"totalAppointments": totalAppointments,
							"totalTasks":        totalTasks,
							"totalComments":     totalComments,
						},
						"confirmation": "Agregue ?force=true al URL para confirmar la eliminación",
					})
					return
				}
			}
		}

		// Professional Security Check 4: Create comprehensive audit log before deletion
		deletionReason := c.Query("reason")
		if deletionReason == "" {
			deletionReason = "No se proporcionó razón"
		}

		// Create audit log entry
		auditLog := models.AuditLog{
			EntityType:     "case",
			EntityID:       uint(caseIDUint),
			Action:         "delete",
			UserID:         user.ID,
			UserRole:       user.Role,
			UserOfficeID:   user.OfficeID,
			UserDepartment: user.Department,
			OldValues:      getCaseJSON(caseRecord),
			NewValues:      nil, // Case is being deleted
			ChangedFields:  []string{"status", "deleted_at", "deleted_by", "deletion_reason"},
			IPAddress:      c.ClientIP(),
			UserAgent:      c.GetHeader("User-Agent"),
			SessionID:      c.GetHeader("X-Session-ID"),
			Reason:         deletionReason,
			Tags:           []string{"case_deletion", "security", "audit"},
			Severity:       "critical",
		}

		if err := db.Create(&auditLog).Error; err != nil {
			log.Printf("WARNING: Failed to create audit log for case deletion: %v", err)
		}

		// Professional Security Check 5: Soft delete with cascade protection
		// Use transaction to ensure data consistency
		tx := db.Begin()
		defer func() {
			if r := recover(); r != nil {
				tx.Rollback()
			}
		}()

		// Archive related data before deletion
		if err := tx.Model(&models.Appointment{}).Where("case_id = ?", caseIDUint).Update("status", "cancelled").Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al archivar citas relacionadas"})
			return
		}

		if err := tx.Model(&models.Task{}).Where("case_id = ?", caseIDUint).Update("status", "cancelled").Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al archivar tareas relacionadas"})
			return
		}

		// Update case with soft delete information
		now := time.Now()
		updates := map[string]interface{}{
			"deleted_at":      &now,
			"deleted_by":      user.ID,
			"deletion_reason": deletionReason,
			"is_archived":     true,
			"status":          "deleted",
		}

		if err := tx.Model(&caseRecord).Updates(updates).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al marcar el caso como eliminado"})
			return
		}

		// Commit transaction
		if err := tx.Commit().Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al confirmar la eliminación"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message":   "Caso eliminado exitosamente",
			"deletedAt": time.Now(),
			"deletedBy": gin.H{
				"id":   user.ID,
				"name": fmt.Sprintf("%s %s", user.FirstName, user.LastName),
				"role": user.Role,
			},
		})
	}
}

// GetCasesForClient returns all cases for a specific client
func GetCasesForClient(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		clientID := c.Param("clientId")

		// Convert clientID string to uint
		clientIDUint, err := strconv.ParseUint(clientID, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid client ID"})
			return
		}

		var cases []models.Case = make([]models.Case, 0)
		query := db.Preload("Client").Preload("Office").Preload("PrimaryStaff").Preload("AssignedStaff")

		// Get cases for the specific client
		if err := query.Where("client_id = ?", clientIDUint).Find(&cases).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve cases"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"cases": cases,
			"count": len(cases),
		})
	}
}

// Helper function to convert case to JSON for audit logging
func getCaseJSON(caseRecord models.Case) *string {
	jsonData, err := json.Marshal(caseRecord)
	if err != nil {
		jsonStr := "{}"
		return &jsonStr
	}
	jsonStr := string(jsonData)
	return &jsonStr
}
