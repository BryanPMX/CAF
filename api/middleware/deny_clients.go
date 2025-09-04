package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// DenyClients blocks requests from users with the 'client' role for protected staff/admin APIs
func DenyClients() gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole, _ := c.Get("userRole")
		if role, ok := userRole.(string); ok && role == "client" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Access denied for client role"})
			return
		}
		c.Next()
	}
}
