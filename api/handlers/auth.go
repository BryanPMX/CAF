/*
Package handlers contains the HTTP handler functions for the API.
Each handler is responsible for receiving a request, processing it,
and returning a response. This package acts as the "controller" layer
in a typical MVC (Model-View-Controller) architecture, connecting API
routes to the underlying business logic and database operations.
*/
package handlers

import (
	"net/http"
	"strconv" // Used to convert the user ID (uint) to a string for the JWT
	"time"

	"github.com/BryanPMX/CAF/api/models" // Note: Update with your GitHub username
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// RegisterInput defines the data structure for a new user registration.
// The `binding:"required"` tags are used by Gin's validation middleware
// to ensure that these fields are present in the incoming JSON request.
type RegisterInput struct {
	FirstName string `json:"firstName" binding:"required"`
	LastName  string `json:"lastName" binding:"required"`
	Email     string `json:"email" binding:"required,email"`
	Password  string `json:"password" binding:"required,min=8"`
}

// Register is a higher-order function that returns a Gin handler for creating a new user.
// By accepting the database connection (`db`) as an argument, we use dependency injection,
// which makes the handler more testable and decoupled from global state.
func Register(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input RegisterInput

		// Step 1: Validate Input
		// Gin's ShouldBindJSON method parses the request body into the 'input' struct.
		// It automatically checks for the validation rules defined in the struct tags.
		// If validation fails, it returns a 400 Bad Request with a descriptive error.
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Step 2: Hash the Password
		// Storing passwords in plain text is a critical security vulnerability.
		// We use bcrypt to generate a secure, one-way hash of the user's password.
		// The "cost" parameter determines how computationally expensive the hashing is.
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
		if err != nil {
			// This is an internal server error because the hashing process itself failed.
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error: failed to hash password"})
			return
		}

		// Step 3: Create User Model
		// We map the validated input to our GORM User model, ready for database insertion.
		user := models.User{
			FirstName: input.FirstName,
			LastName:  input.LastName,
			Email:     input.Email,
			Password:  string(hashedPassword),
			Role:      "client", // All new registrations default to the 'client' role.
		}

		// Step 4: Save to Database
		// GORM's Create method handles the SQL INSERT statement.
		// We check for errors, the most common of which will be a violation of the
		// 'unique' constraint on the email field, which we handle gracefully.
		if err := db.Create(&user).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user. The email address may already be registered."})
			return
		}

		// Step 5: Return Success Response
		// On successful creation, we return a 201 Created status.
		// We send a simple message instead of the user object to avoid exposing any data unnecessarily.
		c.JSON(http.StatusCreated, gin.H{"message": "User registered successfully"})
	}
}

// LoginInput defines the data structure for a user login request.
type LoginInput struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// Login is a higher-order function that returns a Gin handler for user authentication.
// It accepts the database connection and the JWT secret key as dependencies.
func Login(db *gorm.DB, jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input LoginInput
		var user models.User

		// Step 1: Validate Input
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Step 2: Find User in Database
		// We query for the first user matching the provided email address.
		// If GORM returns an error (e.g., gorm.ErrRecordNotFound), it means the user doesn't exist.
		// We return a generic "Unauthorized" error to avoid revealing whether the email was valid or not (timing attack prevention).
		if err := db.Where("email = ?", input.Email).First(&user).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
			return
		}

		// Step 3: Compare Passwords
		// bcrypt.CompareHashAndPassword securely compares the plain-text password from the input
		// with the stored hash from the database. It's designed to be slow to prevent brute-force attacks.
		if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(input.Password)); err != nil {
			// If the passwords don't match, return the same generic "Unauthorized" error.
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
			return
		}

		// Step 4: Generate JSON Web Token (JWT)
		// If credentials are valid, we create a new JWT. This token will act as a temporary
		// passport for the user to access protected routes.
		expirationTime := time.Now().Add(24 * time.Hour) // Token is valid for 24 hours.

		// The "claims" are the pieces of information encoded in the token.
		// We include the user's ID (as a string) as the "Subject" and set the expiration time.
		claims := &jwt.RegisteredClaims{
			Subject:   strconv.FormatUint(uint64(user.ID), 10),
			ExpiresAt: jwt.NewNumericDate(expirationTime),
		}

		// Create the token using the HS256 signing algorithm and our claims.
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

		// Sign the token with the secret key from our environment variables.
		// This signature ensures that the token cannot be tampered with.
		tokenString, err := token.SignedString([]byte(jwtSecret))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error: could not create token"})
			return
		}

		// Step 5: Return the Token
		// Send the signed token string back to the client in a JSON response.
		// The client application will then store this token and send it in the
		// Authorization header of subsequent requests.
		c.JSON(http.StatusOK, gin.H{"token": tokenString})
	}
}
