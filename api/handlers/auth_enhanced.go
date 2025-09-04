package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/BryanPMX/CAF/api/models"
	"github.com/BryanPMX/CAF/api/services"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// EnhancedLoginInput includes device information for session tracking
type EnhancedLoginInput struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
	DeviceID string `json:"deviceId,omitempty"` // Optional device identifier
}

// EnhancedLogin handles user authentication with session management
func EnhancedLogin(db *gorm.DB, jwtSecret string, sessionService *services.SessionService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input EnhancedLoginInput
		var user models.User

		// Step 1: Validate Input
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Step 2: Find User in Database
		if err := db.Where("email = ?", input.Email).First(&user).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
			return
		}

		// Step 3: Compare Passwords
		if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(input.Password)); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
			return
		}

		// Step 4: Generate JWT Token
		expirationTime := time.Now().Add(24 * time.Hour)
		claims := &jwt.RegisteredClaims{
			Subject:   strconv.FormatUint(uint64(user.ID), 10),
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		}

		token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
		tokenString, err := token.SignedString([]byte(jwtSecret))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error: could not create token"})
			return
		}

		// Step 5: Mark last login and Create Session
		now := time.Now()
		_ = db.Model(&user).Update("last_login", &now).Error
		session, err := sessionService.CreateSession(user.ID, tokenString, c)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create session"})
			return
		}

		// Step 6: Return Token and Session Info
		c.JSON(http.StatusOK, gin.H{
			"token": tokenString,
			"session": gin.H{
				"id":           session.ID,
				"deviceInfo":   session.DeviceInfo,
				"ipAddress":    session.IPAddress,
				"expiresAt":    session.ExpiresAt,
				"lastActivity": session.LastActivity,
			},
			"user": gin.H{
				"id":    user.ID,
				"email": user.Email,
				"role":  user.Role,
			},
		})
	}
}

// LogoutInput defines the data structure for logout requests
type LogoutInput struct {
	SessionID uint `json:"sessionId" binding:"required"`
}

// Logout handles user logout and session revocation
func Logout(sessionService *services.SessionService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input LogoutInput
		userID, _ := c.Get("userID")
		userIDUint, _ := strconv.ParseUint(userID.(string), 10, 32)

		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Revoke the specific session
		if err := sessionService.RevokeSession(input.SessionID, uint(userIDUint)); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
	}
}

// LogoutAll handles logout from all devices
func LogoutAll(sessionService *services.SessionService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDUint, _ := strconv.ParseUint(userID.(string), 10, 32)

		if err := sessionService.RevokeAllUserSessions(uint(userIDUint)); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to logout from all devices"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Logged out from all devices successfully"})
	}
}

// GetActiveSessions returns all active sessions for the authenticated user
func GetActiveSessions(sessionService *services.SessionService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDUint, _ := strconv.ParseUint(userID.(string), 10, 32)

		sessions, err := sessionService.GetActiveSessions(uint(userIDUint))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch sessions"})
			return
		}

		// Convert sessions to response format (exclude sensitive data)
		var sessionResponses []gin.H
		for _, session := range sessions {
			sessionResponses = append(sessionResponses, gin.H{
				"id":           session.ID,
				"deviceInfo":   session.DeviceInfo,
				"ipAddress":    session.IPAddress,
				"userAgent":    session.UserAgent,
				"lastActivity": session.LastActivity,
				"expiresAt":    session.ExpiresAt,
				"createdAt":    session.CreatedAt,
			})
		}

		c.JSON(http.StatusOK, gin.H{
			"sessions": sessionResponses,
			"count":    len(sessionResponses),
		})
	}
}

// RefreshTokenInput defines the data structure for token refresh requests
type RefreshTokenInput struct {
	SessionID uint `json:"sessionId" binding:"required"`
}

// RefreshToken extends the session and returns a new token
func RefreshToken(db *gorm.DB, jwtSecret string, sessionService *services.SessionService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input RefreshTokenInput
		userID, _ := c.Get("userID")
		userIDUint, _ := strconv.ParseUint(userID.(string), 10, 32)

		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Validate the session exists and is active
		sessions, err := sessionService.GetActiveSessions(uint(userIDUint))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate session"})
			return
		}

		// Find the specific session
		var targetSession *models.Session
		for _, session := range sessions {
			if session.ID == input.SessionID {
				targetSession = &session
				break
			}
		}

		if targetSession == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Session not found"})
			return
		}

		// Generate new token
		expirationTime := time.Now().Add(24 * time.Hour)
		claims := &jwt.RegisteredClaims{
			Subject:   strconv.FormatUint(uint64(userIDUint), 10),
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		}

		token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
		tokenString, err := token.SignedString([]byte(jwtSecret))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate new token"})
			return
		}

		// Update session with new token hash and extended expiration
		targetSession.TokenHash = sessionService.HashToken(tokenString)
		targetSession.ExpiresAt = expirationTime
		targetSession.LastActivity = time.Now()

		if err := db.Save(targetSession).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update session"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"token":     tokenString,
			"expiresAt": expirationTime,
		})
	}
}

// RegisterInput defines the data structure for user registration
type RegisterInput struct {
	FirstName string `json:"firstName" binding:"required"`
	LastName  string `json:"lastName" binding:"required"`
	Email     string `json:"email" binding:"required,email"`
	Password  string `json:"password" binding:"required,min=6"`
	Role      string `json:"role" binding:"required,oneof=admin staff client"`
	OfficeID  *uint  `json:"officeId,omitempty"`
}

// Register handles user registration
func Register(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input RegisterInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Check if user already exists
		var existingUser models.User
		if err := db.Where("email = ?", input.Email).First(&existingUser).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "User with this email already exists"})
			return
		}

		// Hash password
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
			return
		}

		// Create user
		user := models.User{
			FirstName: input.FirstName,
			LastName:  input.LastName,
			Email:     input.Email,
			Password:  string(hashedPassword),
			Role:      input.Role,
			OfficeID:  input.OfficeID,
		}

		if err := db.Create(&user).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
			return
		}

		// Return user info (without password)
		c.JSON(http.StatusCreated, gin.H{
			"message": "User registered successfully",
			"user": gin.H{
				"id":        user.ID,
				"firstName": user.FirstName,
				"lastName":  user.LastName,
				"email":     user.Email,
				"role":      user.Role,
				"officeId":  user.OfficeID,
			},
		})
	}
}
