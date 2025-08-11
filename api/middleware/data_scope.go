// api/middleware/data_scope.go
package middleware

import (
	"net/http"

	"github.com/BryanPMX/CAF/api/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// DataScope is a middleware that applies office-based data scoping for non-admin users.
// It fetches the user's role and office, and injects the office ID into the context
// for handlers to use in their database queries.
func DataScope(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("userID")
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "User ID not found in context"})
			return
		}

		var user models.User
		if err := db.First(&user, "id = ?", userID).Error; err != nil {
			c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}

		// The core of the logic: if the user is NOT an admin, scope their data.
		if user.Role != "admin" {
			if user.OfficeID == nil {
				// This is a critical check. A non-admin staff member MUST be assigned to an office.
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Access denied: User is not assigned to an office."})
				return
			}
			// Inject the user's office ID into the context for downstream handlers.
			c.Set("officeScopeID", *user.OfficeID)
		}

		// If the user IS an admin, we do nothing, allowing them to see all data.
		c.Next()
	}
}
