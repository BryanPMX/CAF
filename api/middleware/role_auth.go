// api/middleware/role_auth.go
package middleware

import (
	"net/http"

	"github.com/BryanPMX/CAF/api/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// RoleAuth is a middleware that checks if the authenticated user has a specific role.
// It should be used AFTER the JWTAuth middleware.
func RoleAuth(db *gorm.DB, requiredRole string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Step 1: Get the user ID from the context.
		// The JWTAuth middleware must have run first to set this value.
		userID, exists := c.Get("userID")
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "User ID not found in context"})
			return
		}

		// Step 2: Fetch the user from the database.
		var user models.User
		if err := db.First(&user, "id = ?", userID).Error; err != nil {
			c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}

		// Step 3: Compare the user's role with the required role.
		if user.Role != requiredRole {
			// If the roles do not match, the user is forbidden from accessing this resource.
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Access denied: insufficient permissions"})
			return
		}

		// Step 4: If the role matches, allow the request to proceed.
		c.Next()
	}
}
