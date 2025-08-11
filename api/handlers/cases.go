// api/handlers/cases.go
package handlers

import (
	"net/http"

	"github.com/BryanPMX/CAF/api/config" // Import the new config package
	"github.com/BryanPMX/CAF/api/models"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// CreateCaseInput defines the flexible structure for creating a case from the admin portal.
type CreateCaseInput struct {
	// For an existing client
	ClientID *uint `json:"clientId"` // Pointer to allow for null/omitted value

	// For a new client
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	Email     string `json:"email"`

	// Case Details
	OfficeID    uint   `json:"officeId" binding:"required"`
	Title       string `json:"title" binding:"required"`
	Description string `json:"description"`
}

// CreateCase is an admin-only handler for creating a new case,
// potentially creating a new client at the same time.
func CreateCase(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input CreateCaseInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		var clientID uint

		// --- Smart Client Handling Logic ---
		if input.ClientID != nil {
			// Scenario 1: Use an existing client.
			// Verify the client actually exists in the database.
			var client models.User
			if err := db.First(&client, *input.ClientID).Error; err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "The selected client does not exist."})
				return
			}
			clientID = *input.ClientID
		} else {
			// Scenario 2: Create a new client.
			// Validate that the required fields for a new client are present.
			if input.FirstName == "" || input.LastName == "" || input.Email == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "First name, last name, and email are required for a new client."})
				return
			}

			// For security, we generate a temporary random password.
			// In a real system, you would email this to the client.
			tempPassword := "password123" // TODO: Replace with a secure random string generator
			hashedPassword, err := bcrypt.GenerateFromPassword([]byte(tempPassword), bcrypt.DefaultCost)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password for new client"})
				return
			}

			newClient := models.User{
				FirstName: input.FirstName,
				LastName:  input.LastName,
				Email:     input.Email,
				Password:  string(hashedPassword),
				Role:      "client",
			}

			if err := db.Create(&newClient).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create new client account. Email may already be in use."})
				return
			}
			clientID = newClient.ID
		}

		// --- Create the Case ---
		newCase := models.Case{
			ClientID:    clientID,
			OfficeID:    input.OfficeID,
			Title:       input.Title,
			Description: input.Description,
			Status:      "open",
		}

		if err := db.Create(&newCase).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create the case."})
			return
		}

		c.JSON(http.StatusCreated, newCase)
	}
}

// GetCases is an admin-only handler to retrieve a list of all cases.
func GetCases(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var cases []models.Case
		if err := db.Preload("Client").Preload("Office").Order("created_at desc").Find(&cases).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve cases"})
			return
		}
		c.JSON(http.StatusOK, cases)
	}
}

// GetCaseByID is an admin-only handler to retrieve the full details of a single case.
func GetCaseByID(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var caseDetail models.Case
		caseID := c.Param("id")

		// This is a deep query that fetches the case and all its related data.
		// It's the query that powers the "digital folder" view.
		query := db.Preload("Client").
			Preload("Office").
			Preload("Appointments.Staff"). // For appointments, also get the assigned staff member.
			Preload("Tasks.AssignedTo").   // For tasks, get the assigned staff member.
			Preload("CaseEvents.User").    // For comments on tasks, get the user who wrote them.
			First(&caseDetail, caseID)

		if query.Error != nil {
			if query.Error == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "Case not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve case details"})
			return
		}

		c.JSON(http.StatusOK, caseDetail)
	}
}

// UpdateCaseStageInput defines the structure for updating a case's stage.
type UpdateCaseStageInput struct {
	Stage string `json:"stage" binding:"required"`
}

// UpdateCaseStage is an admin-only handler to change the workflow stage of a case.
func UpdateCaseStage(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var caseRecord models.Case
		caseID := c.Param("id")

		if err := db.First(&caseRecord, caseID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Case not found"})
			return
		}

		var input UpdateCaseStageInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		if !config.IsValidStage(input.Stage) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid stage value"})
			return
		}

		// Update the case's stage.
		db.Model(&caseRecord).Update("current_stage", input.Stage)

		// --- NEW: AUTOMATION LOGIC ---
		// If the new stage is "closed", automatically update the case's overall status to "closed".
		if input.Stage == "closed" {
			db.Model(&caseRecord).Update("status", "closed")
		} else {
			// Optional: If a case is re-opened, set its status back to "open".
			if caseRecord.Status == "closed" {
				db.Model(&caseRecord).Update("status", "open")
			}
		}

		c.JSON(http.StatusOK, caseRecord)
	}
}

// GetCasesForClient retrieves all cases associated with a specific client ID.
func GetCasesForClient(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		clientID := c.Param("clientId")
		var cases []models.Case

		if err := db.Where("client_id = ?", clientID).Order("created_at desc").Find(&cases).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve cases for client"})
			return
		}

		c.JSON(http.StatusOK, cases)
	}
}
