// api/handlers/admin_appointments.go
package handlers

import (
	"net/http"
	"time"

	"github.com/BryanPMX/CAF/api/models"
	"github.com/BryanPMX/CAF/api/utils/notifications"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

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

		var client models.User
		var caseRecord models.Case

		// --- Step 1: Determine the Client ---
		if input.ClientID != nil {
			// Scenario: Use an existing client.
			if err := db.First(&client, *input.ClientID).Error; err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Selected client not found."})
				return
			}
		} else if input.NewClient != nil {
			// Scenario: Create a new client.
			tempPassword := "password123" // Placeholder password
			hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(tempPassword), bcrypt.DefaultCost)
			client = models.User{
				FirstName: input.NewClient.FirstName,
				LastName:  input.NewClient.LastName,
				Email:     input.NewClient.Email,
				Password:  string(hashedPassword),
				Role:      "client",
			}
			if err := db.Create(&client).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create new client. Email may be in use."})
				return
			}
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Client information (either clientId or newClient) is required."})
			return
		}

		// --- Step 2: Determine the Case ---
		if input.CaseID != nil {
			// Scenario: Use an existing case.
			if err := db.First(&caseRecord, *input.CaseID).Error; err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Selected case not found."})
				return
			}
		} else if input.NewCase != nil {
			// Scenario: Create a new case for the client.
			caseRecord = models.Case{
				ClientID:    client.ID,
				OfficeID:    input.NewCase.OfficeID,
				Title:       input.NewCase.Title,
				Description: input.NewCase.Description,
				Status:      "open",
			}
			if err := db.Create(&caseRecord).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create new case."})
				return
			}
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Case information (either caseId or newCase) is required."})
			return
		}

		// --- Step 3: Create the Appointment ---
		appointment := models.Appointment{
			CaseID:    caseRecord.ID,
			StaffID:   input.StaffID,
			Title:     input.Title,
			StartTime: input.StartTime,
			EndTime:   input.EndTime,
			Status:    input.Status,
		}
		if err := db.Create(&appointment).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create appointment."})
			return
		}

		// --- Step 4: Send Notification (Async) ---
		// Trigger the placeholder notification function asynchronously for better performance
		go func() {
			notifications.SendAppointmentConfirmation(appointment, client)
		}()

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

		// Update the model fields and save to the database.
		appointment.CaseID = input.CaseID
		appointment.StaffID = input.StaffID
		appointment.Title = input.Title
		appointment.StartTime = input.StartTime
		appointment.EndTime = input.EndTime
		appointment.Status = input.Status
		db.Save(&appointment)

		c.JSON(http.StatusOK, appointment)
	}
}

// DeleteAppointmentAdmin removes an appointment (soft delete).
func DeleteAppointmentAdmin(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var appointment models.Appointment
		if err := db.Where("id = ?", c.Param("id")).First(&appointment).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Appointment not found"})
			return
		}
		db.Delete(&appointment)
		c.Status(http.StatusNoContent)
	}
}
