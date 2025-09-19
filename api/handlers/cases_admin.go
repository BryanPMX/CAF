// api/handlers/cases_admin.go
package handlers

import (
	"net/http"
	"strconv"

	"github.com/BryanPMX/CAF/api/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// UpdateCaseStage updates the stage of a case
func UpdateCaseStage(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		caseID := c.Param("id")
		if caseID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Case ID is required"})
			return
		}

		var request struct {
			Stage string `json:"stage" binding:"required"`
		}

		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request data", "details": err.Error()})
			return
		}

		// Validate stage
		validStages := map[string]bool{
			"intake":      true,
			"assessment":  true,
			"active":      true,
			"review":      true,
			"closed":      true,
			"archived":    true,
		}

		if !validStages[request.Stage] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid stage"})
			return
		}

		// Find and update case
		var caseData models.Case
		if err := db.First(&caseData, caseID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Case not found"})
			return
		}

		// Update stage and audit fields
		userID, _ := c.Get("userID")
		userIDUint := userID.(uint)
		
		caseData.CurrentStage = request.Stage
		caseData.UpdatedBy = &userIDUint

		if err := db.Save(&caseData).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update case stage"})
			return
		}

		// Load relationships for response
		if err := db.Preload("Client").Preload("Office").Preload("PrimaryStaff").First(&caseData, caseData.ID).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load case data"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Case stage updated successfully",
			"data":    caseData,
		})
	}
}

// AssignStaffToCase assigns staff member to a case
func AssignStaffToCase(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		caseID := c.Param("id")
		if caseID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Case ID is required"})
			return
		}

		var request struct {
			StaffID uint `json:"staffId" binding:"required"`
		}

		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request data", "details": err.Error()})
			return
		}

		// Verify staff member exists and has appropriate role
		var staff models.User
		if err := db.First(&staff, request.StaffID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Staff member not found"})
			return
		}

		if staff.Role != "staff" && staff.Role != "office_manager" && staff.Role != "admin" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "User cannot be assigned to cases"})
			return
		}

		// Find and update case
		var caseData models.Case
		if err := db.First(&caseData, caseID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Case not found"})
			return
		}

		// Update assignment and audit fields
		userID, _ := c.Get("userID")
		userIDUint := userID.(uint)
		
		caseData.PrimaryStaffID = &request.StaffID
		caseData.UpdatedBy = &userIDUint

		if err := db.Save(&caseData).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to assign staff to case"})
			return
		}

		// Load relationships for response
		if err := db.Preload("Client").Preload("Office").Preload("PrimaryStaff").First(&caseData, caseData.ID).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load case data"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Staff assigned to case successfully",
			"data":    caseData,
		})
	}
}

// GetCasesForClient retrieves all cases for a specific client
func GetCasesForClient(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		clientID := c.Param("clientId")
		if clientID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Client ID is required"})
			return
		}

		// Convert clientID to uint
		clientIDUint, err := strconv.ParseUint(clientID, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid client ID"})
			return
		}

		// Verify client exists
		var client models.User
		if err := db.First(&client, clientIDUint).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Client not found"})
			return
		}

		if client.Role != "client" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "User is not a client"})
			return
		}

		// Get pagination parameters
		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

		if page < 1 {
			page = 1
		}
		if limit < 1 || limit > 100 {
			limit = 20
		}

		offset := (page - 1) * limit

		// Get cases for client
		var cases []models.Case
		var total int64

		// Count total cases
		if err := db.Model(&models.Case{}).Where("client_id = ? AND is_archived = ?", clientIDUint, false).Count(&total).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count cases"})
			return
		}

		// Get cases with relationships
		query := db.Preload("Client").Preload("Office").Preload("PrimaryStaff").
			Where("client_id = ? AND is_archived = ?", clientIDUint, false).
			Order("created_at DESC").
			Offset(offset).
			Limit(limit)

		if err := query.Find(&cases).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve cases"})
			return
		}

		// Calculate pagination info
		totalPages := (total + int64(limit) - 1) / int64(limit)

		c.JSON(http.StatusOK, gin.H{
			"data":       cases,
			"total":      total,
			"page":       page,
			"limit":      limit,
			"totalPages": totalPages,
			"client":     client,
		})
	}
}
