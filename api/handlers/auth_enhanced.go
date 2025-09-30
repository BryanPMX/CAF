package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/BryanPMX/CAF/api/models"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// EnhancedLoginInput includes device information for stateless authentication
type EnhancedLoginInput struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
	DeviceID string `json:"deviceId,omitempty"` // Optional device identifier
}

// EnhancedLogin handles user authentication with stateless JWT tokens
func EnhancedLogin(db *gorm.DB, jwtSecret string) gin.HandlerFunc {
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

		// Step 4: Generate JWT Token with explicit UTC time (24-hour expiration)
		expirationTime := time.Now().UTC().Add(24 * time.Hour)
		claims := &jwt.RegisteredClaims{
			Subject:   strconv.FormatUint(uint64(user.ID), 10),
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now().UTC()),
		}

		token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
		tokenString, err := token.SignedString([]byte(jwtSecret))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error: could not create token"})
			return
		}

		// Step 5: Mark last login (no session creation needed)
		now := time.Now().UTC()
		_ = db.Model(&user).Update("last_login", &now).Error

		// Step 6: Return Token and User Info (stateless)
		c.JSON(http.StatusOK, gin.H{
			"token":     tokenString,
			"expiresAt": expirationTime,
			"user": gin.H{
				"id":        user.ID,
				"email":     user.Email,
				"role":      user.Role,
				"firstName": user.FirstName,
				"lastName":  user.LastName,
			},
		})
	}
}

// Logout handles user logout (stateless - client should discard token)
func Logout() gin.HandlerFunc {
	return func(c *gin.Context) {
		// In a stateless JWT system, logout is handled client-side
		// The client simply discards the token
		// We can optionally maintain a token blacklist for enhanced security
		c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
	}
}

// LogoutAll handles logout from all devices (stateless - client should discard token)
func LogoutAll() gin.HandlerFunc {
	return func(c *gin.Context) {
		// In a stateless JWT system, logout is handled client-side
		// The client simply discards the token
		// We can optionally maintain a token blacklist for enhanced security
		c.JSON(http.StatusOK, gin.H{"message": "Logged out from all devices successfully"})
	}
}

// GetActiveSessions returns token information for the authenticated user (stateless)
func GetActiveSessions() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		
		// In a stateless system, we return basic token info
		// The client manages its own token state
		c.JSON(http.StatusOK, gin.H{
			"message": "Stateless authentication - client manages token state",
			"userId":  userID,
		})
	}
}

// RefreshTokenInput defines the data structure for token refresh requests
type RefreshTokenInput struct {
	// No session ID needed in stateless system
}

// RefreshToken generates a new token for the authenticated user (stateless)
func RefreshToken(db *gorm.DB, jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDUint, _ := strconv.ParseUint(userID.(string), 10, 32)

		// Verify user still exists in database
		var user models.User
		if err := db.First(&user, userIDUint).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
			return
		}

		// Generate new token with explicit UTC time (24-hour expiration)
		expirationTime := time.Now().UTC().Add(24 * time.Hour)
		claims := &jwt.RegisteredClaims{
			Subject:   strconv.FormatUint(uint64(userIDUint), 10),
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now().UTC()),
		}

		token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
		tokenString, err := token.SignedString([]byte(jwtSecret))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate new token"})
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
