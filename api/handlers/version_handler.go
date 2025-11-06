// api/handlers/version_handler.go
package handlers

import (
	"net/http"
	"strconv"

	"github.com/BryanPMX/CAF/api/middleware"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// VersionHandler provides version-aware request handling
// This allows different API versions to have different behavior while maintaining backward compatibility
type VersionHandler struct {
	version string
	db      *gorm.DB
}

// NewVersionHandler creates a new version-aware handler
func NewVersionHandler(version string, db *gorm.DB) *VersionHandler {
	return &VersionHandler{
		version: version,
		db:      db,
	}
}

// GetCases handles case retrieval with version-specific logic
func (vh *VersionHandler) GetCases(c *gin.Context) {
	switch vh.version {
	case "v1":
		vh.handleGetCasesV1(c)
	default:
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Unsupported API version for cases endpoint",
			"version": vh.version,
		})
	}
}

// handleGetCasesV1 implements V1 case retrieval logic
func (vh *VersionHandler) handleGetCasesV1(c *gin.Context) {
	caseService := NewCaseService(vh.db)

	cases, total, err := caseService.GetCases(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to retrieve cases",
			"message": err.Error(),
			"version": vh.version,
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
			"queryTime":    "optimized",
			"cacheHit":     false,
			"responseSize": len(cases),
		},
		"version": vh.version,
	})
}

// GetAppointments handles appointment retrieval with version-specific logic
func (vh *VersionHandler) GetAppointments(c *gin.Context) {
	switch vh.version {
	case "v1":
		vh.handleGetAppointmentsV1(c)
	default:
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Unsupported API version for appointments endpoint",
			"version": vh.version,
		})
	}
}

// handleGetAppointmentsV1 implements V1 appointment retrieval logic
func (vh *VersionHandler) handleGetAppointmentsV1(c *gin.Context) {
	// Use existing enhanced appointment handler
	GetAppointmentsEnhanced(vh.db)(c)
}

// CreateCase handles case creation with version-specific logic
func (vh *VersionHandler) CreateCase(c *gin.Context) {
	switch vh.version {
	case "v1":
		vh.handleCreateCaseV1(c)
	default:
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Unsupported API version for case creation",
			"version": vh.version,
		})
	}
}

// handleCreateCaseV1 implements V1 case creation logic
func (vh *VersionHandler) handleCreateCaseV1(c *gin.Context) {
	CreateCaseEnhanced(vh.db)(c)
}

// UpdateCase handles case updates with version-specific logic
func (vh *VersionHandler) UpdateCase(c *gin.Context) {
	switch vh.version {
	case "v1":
		vh.handleUpdateCaseV1(c)
	default:
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Unsupported API version for case updates",
			"version": vh.version,
		})
	}
}

// handleUpdateCaseV1 implements V1 case update logic
func (vh *VersionHandler) handleUpdateCaseV1(c *gin.Context) {
	UpdateCase(vh.db)(c)
}

// GetDashboardSummary handles dashboard summary with version-specific logic
func (vh *VersionHandler) GetDashboardSummary(c *gin.Context) {
	switch vh.version {
	case "v1":
		vh.handleGetDashboardSummaryV1(c)
	default:
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Unsupported API version for dashboard summary",
			"version": vh.version,
		})
	}
}

// handleGetDashboardSummaryV1 implements V1 dashboard summary logic
func (vh *VersionHandler) handleGetDashboardSummaryV1(c *gin.Context) {
	GetDashboardSummary(vh.db)(c)
}

// GetUsers handles user retrieval with version-specific logic
func (vh *VersionHandler) GetUsers(c *gin.Context) {
	switch vh.version {
	case "v1":
		vh.handleGetUsersV1(c)
	default:
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Unsupported API version for user retrieval",
			"version": vh.version,
		})
	}
}

// handleGetUsersV1 implements V1 user retrieval logic
func (vh *VersionHandler) handleGetUsersV1(c *gin.Context) {
	GetUsers(vh.db)(c)
}

// CreateUser handles user creation with version-specific logic
func (vh *VersionHandler) CreateUser(c *gin.Context) {
	switch vh.version {
	case "v1":
		vh.handleCreateUserV1(c)
	default:
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Unsupported API version for user creation",
			"version": vh.version,
		})
	}
}

// handleCreateUserV1 implements V1 user creation logic
func (vh *VersionHandler) handleCreateUserV1(c *gin.Context) {
	CreateUser(vh.db)(c)
}

// =============================================
// UTILITY FUNCTIONS
// =============================================

// GetVersionHandler returns a version-aware handler for the current request
func GetVersionHandler(c *gin.Context, db *gorm.DB) *VersionHandler {
	version := middleware.GetAPIVersion(c)
	return NewVersionHandler(version, db)
}

// VersionedResponse adds version information to API responses
func VersionedResponse(c *gin.Context, statusCode int, data interface{}) {
	version := middleware.GetAPIVersion(c)

	// If data is a gin.H (map), add version info
	if responseMap, ok := data.(gin.H); ok {
		responseMap["api_version"] = version
		c.JSON(statusCode, responseMap)
	} else {
		c.JSON(statusCode, data)
	}
}

// VersionedError adds version information to error responses
func VersionedError(c *gin.Context, statusCode int, message string, details interface{}) {
	version := middleware.GetAPIVersion(c)

	errorResponse := gin.H{
		"error":       message,
		"api_version": version,
	}

	if details != nil {
		errorResponse["details"] = details
	}

	c.JSON(statusCode, errorResponse)
}
