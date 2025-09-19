// api/handlers/cases_enhanced_refactored.go
package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// GetCasesEnhanced returns cases based on user permissions and assignments
func GetCasesEnhanced(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		caseService := NewCaseService(db)
		
		cases, total, err := caseService.GetCases(c)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to retrieve cases",
				"message": err.Error(),
			})
			return
		}

		// Calculate pagination info
		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
		totalPages := (total + int64(limit) - 1) / int64(limit)

		c.JSON(http.StatusOK, gin.H{
			"data":       cases,
			"total":      total,
			"page":       page,
			"limit":      limit,
			"totalPages": totalPages,
		})
	}
}

// GetCaseByIDEnhanced returns a single case by ID with enhanced data
func GetCaseByIDEnhanced(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		caseID := c.Param("id")
		if caseID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Case ID is required"})
			return
		}

		caseService := NewCaseService(db)
		
		// Check if light mode is requested
		light := c.Query("light") == "true"
		
		caseData, err := caseService.GetCaseByID(caseID, light)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{
				"error":   "Case not found",
				"message": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{"data": caseData})
	}
}

// CreateCaseEnhanced creates a new case
func CreateCaseEnhanced(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		caseService := NewCaseService(db)
		
		caseData, err := caseService.CreateCase(c)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "Failed to create case",
				"message": err.Error(),
			})
			return
		}

		c.JSON(http.StatusCreated, gin.H{"data": caseData})
	}
}

// UpdateCase updates an existing case
func UpdateCase(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		caseID := c.Param("id")
		if caseID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Case ID is required"})
			return
		}

		caseService := NewCaseService(db)
		
		caseData, err := caseService.UpdateCase(caseID, c)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "Failed to update case",
				"message": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{"data": caseData})
	}
}

// DeleteCase soft deletes a case
func DeleteCase(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		caseID := c.Param("id")
		if caseID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Case ID is required"})
			return
		}

		caseService := NewCaseService(db)
		
		err := caseService.DeleteCase(caseID, c)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "Failed to delete case",
				"message": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Case deleted successfully"})
	}
}

// GetMyCases returns cases assigned to the current user
func GetMyCases(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		caseService := NewCaseService(db)
		
		cases, total, err := caseService.GetMyCases(c)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to retrieve cases",
				"message": err.Error(),
			})
			return
		}

		// Calculate pagination info
		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
		totalPages := (total + int64(limit) - 1) / int64(limit)

		c.JSON(http.StatusOK, gin.H{
			"data":       cases,
			"total":      total,
			"page":       page,
			"limit":      limit,
			"totalPages": totalPages,
		})
	}
}
