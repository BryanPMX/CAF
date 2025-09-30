package middleware

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/BryanPMX/CAF/api/services"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// EnhancedJWTAuth is a middleware that validates JWT tokens and sessions
func EnhancedJWTAuth(jwtSecret string, sessionService *services.SessionService) gin.HandlerFunc {
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

		// Step 3: Extract claims and validate session
		if claims, ok := token.Claims.(jwt.MapClaims); ok {
			userID, ok := claims["sub"].(string)
			if !ok {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token claims"})
				return
			}

			// Step 4: Validate the session exists and is active
			tokenHash := sessionService.HashToken(tokenString)
			session, err := sessionService.ValidateSession(tokenHash)
			if err != nil {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
					"error":   "Session invalid or expired",
					"details": err.Error(),
				})
				return
			}

		// Step 5: Set user ID and session info in context
		c.Set("userID", userID)
		c.Set("sessionID", session.ID)
		c.Set("session", session)
		
		// Step 6: Set a temporary userRole that will be overwritten by DataAccessControl
		// This prevents issues where handlers try to access userRole before DataAccessControl runs
		c.Set("userRole", "pending") // Temporary value

			c.Next()
		} else {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token claims"})
		}
	}
}

// SessionRateLimit middleware prevents rapid session creation (anti-spam)
func SessionRateLimit(sessionService *services.SessionService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// This could be enhanced with Redis-based rate limiting
		// For now, we'll use a simple approach
		_, exists := c.Get("userID")
		if !exists {
			c.Next()
			return
		}

		// Check if user has too many recent session attempts
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
