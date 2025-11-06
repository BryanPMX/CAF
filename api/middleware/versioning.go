// api/middleware/versioning.go
package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

const (
	// CurrentAPIVersion represents the current stable API version
	CurrentAPIVersion = "v1"

	// DefaultAPIVersion is used when no version is specified
	DefaultAPIVersion = "v1"
)

// SupportedVersions contains all supported API versions
var SupportedVersions = []string{
	"v1", // Current version
}

// APIVersionMiddleware handles API versioning via headers with URL fallback
// Supports both Accept-Version header and URL-based versioning for backward compatibility
func APIVersionMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Step 1: Extract version from Accept-Version header (preferred method)
		version := c.GetHeader("Accept-Version")

		// Step 2: Fallback to URL-based versioning if no header provided
		if version == "" {
			if strings.HasPrefix(c.Request.URL.Path, "/api/v1/") {
				version = "v1"
			} else {
				version = DefaultAPIVersion
			}
		}

		// Step 3: Validate version
		if !isValidVersion(version) {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":             "Unsupported API version",
				"supported_versions": SupportedVersions,
				"current_version":    CurrentAPIVersion,
				"message":            "Please use Accept-Version header or ensure URL starts with /api/v1/",
			})
			c.Abort()
			return
		}

		// Step 4: Set version in context for downstream handlers
		c.Set("api_version", version)

		// Step 5: Add version information to response headers
		c.Header("X-API-Version", version)
		c.Header("X-API-Current-Version", CurrentAPIVersion)

		// Step 6: Continue processing
		c.Next()
	}
}

// isValidVersion checks if the provided version is supported
func isValidVersion(version string) bool {
	for _, supported := range SupportedVersions {
		if version == supported {
			return true
		}
	}
	return false
}

// GetAPIVersion retrieves the API version from the request context
func GetAPIVersion(c *gin.Context) string {
	if version, exists := c.Get("api_version"); exists {
		return version.(string)
	}
	return DefaultAPIVersion
}

// RequireAPIVersion creates a middleware that requires a specific API version
func RequireAPIVersion(requiredVersion string) gin.HandlerFunc {
	return func(c *gin.Context) {
		currentVersion := GetAPIVersion(c)
		if currentVersion != requiredVersion {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":           "API version mismatch",
				"required_version": requiredVersion,
				"current_version":  currentVersion,
				"message":          "This endpoint requires a specific API version",
			})
			c.Abort()
			return
		}
		c.Next()
	}
}

// VersionInfo returns version information for health checks
func VersionInfo() gin.HandlerFunc {
	return func(c *gin.Context) {
		version := GetAPIVersion(c)
		c.JSON(http.StatusOK, gin.H{
			"api_version":       version,
			"current_version":   CurrentAPIVersion,
			"supported_versions": SupportedVersions,
			"versioning_method": "header-based with URL fallback",
		})
	}
}
