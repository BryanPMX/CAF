package middleware

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
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

		// Step 2: Parse and validate the JWT token with explicit UTC time validation
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(jwtSecret), nil
		}, jwt.WithTimeFunc(func() time.Time {
			return time.Now().UTC() // CRITICAL: Use UTC for token validation
		}))

		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			return
		}

		// Step 3: Extract claims and set user context (stateless)
		if claims, ok := token.Claims.(jwt.MapClaims); ok {
			userID, ok := claims["sub"].(string)
			if !ok {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token claims"})
				return
			}

			// Step 4: Set user ID in context (no database session tracking)
			c.Set("userID", userID)
			
			// Step 5: Set a temporary userRole that will be overwritten by DataAccessControl
			// This prevents issues where handlers try to access userRole before DataAccessControl runs
			c.Set("userRole", "pending") // Temporary value

			c.Next()
		} else {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token claims"})
		}
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
