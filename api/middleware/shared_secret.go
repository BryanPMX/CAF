package middleware

import (
	"crypto/subtle"
	"net/http"

	"github.com/gin-gonic/gin"
)

func RequireSharedSecret(expected, headerName string) gin.HandlerFunc {
	return func(c *gin.Context) {
		provided := c.GetHeader(headerName)
		if expected == "" || len(provided) != len(expected) || subtle.ConstantTimeCompare([]byte(provided), []byte(expected)) != 1 {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized request"})
			return
		}
		c.Next()
	}
}
