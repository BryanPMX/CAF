// api/handlers/appointments.go
package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/BryanPMX/CAF/api/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// CreateAppointmentInput defines the expected JSON from the Flutter app.
type CreateAppointmentInput struct {
	Category    string `json:"category" binding:"required"`
	Description string `json:"description" binding:"required"`
}

// CreateAppointment is a protected handler for creating a new service request from the client app.
func CreateAppointment(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input CreateAppointmentInput

		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		userIDStr, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		clientID, err := strconv.ParseUint(userIDStr.(string), 10, 32)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID format"})
			return
		}

		// Create the new Case for the client.
		newCase := models.Case{
			ClientID:    uint(clientID),
			OfficeID:    1, // Defaulting to the main office for now
			Title:       "Consulta Inicial - " + input.Category,
			Description: input.Description,
			Status:      "open",
		}

		if err := db.Create(&newCase).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create case for appointment"})
			return
		}

		// Create the initial Appointment and link it to the new Case.
		appointment := models.Appointment{
			CaseID:    newCase.ID,
			StaffID:   1, // Defaulting to the main admin (user ID 1) for now
			Title:     "Consulta Inicial",
			StartTime: time.Now().Add(24 * time.Hour),
			EndTime:   time.Now().Add(25 * time.Hour),
			Status:    "confirmed",
		}

		if err := db.Create(&appointment).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create appointment"})
			return
		}

		c.JSON(http.StatusCreated, gin.H{"message": "Appointment request and case created successfully", "caseId": newCase.ID})
	}
}

// GetAppointments retrieves a list of appointments. It is "scope-aware".
// An admin will see all appointments, while a staff member will only see those for their office.
func GetAppointments(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var appointments []models.Appointment

		// Start building the base query with optimized ordering
		query := db.Order("start_time desc").Limit(100) // Limit results for performance

		// Preload nested data with optimized queries
		query = query.Preload("Staff", func(db *gorm.DB) *gorm.DB {
			return db.Select("id, first_name, last_name, role") // Only select needed fields
		}).Preload("Case", func(db *gorm.DB) *gorm.DB {
			return db.Preload("Client", func(db *gorm.DB) *gorm.DB {
				return db.Select("id, first_name, last_name") // Only select needed fields
			})
		})

		// Apply office-based data scoping for non-admin users with optimized join
		officeID, exists := c.Get("officeScopeID")
		if exists {
			// Use INNER JOIN for better performance when filtering
			query = query.Joins("INNER JOIN cases ON cases.id = appointments.case_id AND cases.office_id = ?", officeID)
		}

		// Execute the final query with error handling
		result := query.Find(&appointments)
		if result.Error != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve appointments"})
			return
		}

		// Add cache headers for better performance
		c.Header("Cache-Control", "private, max-age=30") // Cache for 30 seconds
		c.JSON(http.StatusOK, appointments)
	}
}
