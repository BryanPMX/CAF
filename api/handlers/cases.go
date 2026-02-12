// api/handlers/cases_enhanced_refactored.go
package handlers

import (
	"net/http"
	"strconv"

	"github.com/BryanPMX/CAF/api/models"
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
			"data": cases,
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
				"responseSize": len(cases),
			},
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

		// Return the case data directly (not wrapped in "data" field)
		// Frontend expects the case object directly
		c.JSON(http.StatusOK, caseData)
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

		link := "/app/cases/" + strconv.FormatUint(uint64(caseData.ID), 10)
		NotifyAdminsForCase(db, "creado", caseData.ID, caseData.Title, caseData.Category, caseData.Status, &link)
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

		link := "/app/cases/" + caseID
		NotifyAdminsForCase(db, "actualizado", caseData.ID, caseData.Title, caseData.Category, caseData.Status, &link)
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

		var caseData models.Case
		_ = db.First(&caseData, caseID).Error // best-effort for notification payload
		caseService := NewCaseService(db)
		err := caseService.DeleteCase(caseID, c)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "Failed to delete case",
				"message": err.Error(),
			})
			return
		}
		if caseData.ID != 0 {
			caseIDNum, _ := strconv.ParseUint(caseID, 10, 32)
			link := "/app/cases"
			NotifyAdminsForCase(db, "eliminado", uint(caseIDNum), caseData.Title, caseData.Category, caseData.Status, &link)
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
			"data": cases,
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
				"responseSize": len(cases),
			},
		})
	}
}

// UpdateCaseEnhanced is a wrapper for UpdateCase with enhanced functionality
func UpdateCaseEnhanced(db *gorm.DB) gin.HandlerFunc {
	return UpdateCase(db)
}

// DeleteCaseEnhanced is a wrapper for DeleteCase with enhanced functionality
func DeleteCaseEnhanced(db *gorm.DB) gin.HandlerFunc {
	return DeleteCase(db)
}
