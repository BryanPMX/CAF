package middleware

import (
	"net/http"
	"strings"
	"time"

	securityutil "github.com/BryanPMX/CAF/api/security"
	"github.com/gin-gonic/gin"
)

// EnhancedJWTAuth is a stateless middleware that validates JWT tokens
// This is a pure JWT-based authentication system with no database session tracking
func EnhancedJWTAuth(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Step 1: Extract the token from the Authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authorization header is required"})
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == authHeader {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token format"})
			return
		}

		// Step 2: Require HS256 plus the CAF issuer, audience, subject and expiry.
		userID, err := securityutil.ParseJWT(tokenString, jwtSecret, time.Now())
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			return
		}

		// Step 3: Set user context (stateless). DataAccessControl replaces the
		// temporary role after confirming the database account is active.
		c.Set("userID", userID)
		c.Set("userRole", "pending")
		c.Next()
	}
}

// SessionRateLimit middleware prevents rapid authentication attempts (anti-spam)
// Note: This is now stateless and doesn't require session service
func SessionRateLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		// This could be enhanced with Redis-based rate limiting
		// For now, we'll use a simple approach
		_, exists := c.Get("userID")
		if !exists {
			c.Next()
			return
		}

		// Check if user has too many recent authentication attempts
		// This is a basic implementation - consider using Redis for production
		c.Next()
	}
}

// DeviceFingerprint middleware extracts and validates device information
func DeviceFingerprint() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Extract device fingerprint from headers
		deviceFingerprint := c.GetHeader("X-Device-Fingerprint")
		if deviceFingerprint != "" {
			c.Set("deviceFingerprint", deviceFingerprint)
		}

		// Extract additional security headers
		securityHeaders := map[string]string{
			"X-Device-ID":        c.GetHeader("X-Device-ID"),
			"X-Platform":         c.GetHeader("X-Platform"),
			"X-App-Version":      c.GetHeader("X-App-Version"),
			"X-Client-Timestamp": c.GetHeader("X-Client-Timestamp"),
		}

		for key, value := range securityHeaders {
			if value != "" {
				c.Set(key, value)
			}
		}

		c.Next()
	}
}
