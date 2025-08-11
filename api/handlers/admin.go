// api/handlers/admin.go
package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/BryanPMX/CAF/api/models"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// CreateUserInput defines the structure for an admin creating a new user.
type CreateUserInput struct {
	FirstName string `json:"firstName" binding:"required"`
	LastName  string `json:"lastName" binding:"required"`
	Email     string `json:"email" binding:"required,email"`
	Password  string `json:"password" binding:"required,min=8"`
	Role      string `json:"role" binding:"required"`
	OfficeID  *uint  `json:"officeId"`
}

// validRoles defines the list of roles an admin is permitted to create.
var validRoles = map[string]bool{
	"client": true, "receptionist": true, "lawyer": true, "psychologist": true,
	"office_manager": true, "event_coordinator": true, "admin": true,
}

// CreateUser handles the creation of a new user by an administrator.
func CreateUser(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input CreateUserInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Validate the provided role against our allowed list.
		if _, ok := validRoles[input.Role]; !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role specified."})
			return
		}

		// Enforce that all non-client users must be assigned to an office.
		if input.Role != "client" && input.OfficeID == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "An office must be assigned to all staff members."})
			return
		}

		// Securely hash the temporary password.
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
			return
		}

		// Create the new user model.
		user := models.User{
			FirstName: input.FirstName,
			LastName:  input.LastName,
			Email:     input.Email,
			Password:  string(hashedPassword),
			Role:      input.Role,
			OfficeID:  input.OfficeID,
		}

		// Check if a soft-deleted user with the same email exists
		var existingUser models.User
		if err := db.Unscoped().Where("email = ?", input.Email).First(&existingUser).Error; err == nil {
			// User exists but might be soft-deleted
			if existingUser.DeletedAt.Valid {
				// Reactivate the soft-deleted user
				existingUser.FirstName = input.FirstName
				existingUser.LastName = input.LastName
				existingUser.Password = string(hashedPassword)
				existingUser.Role = input.Role
				existingUser.OfficeID = input.OfficeID
				existingUser.DeletedAt = gorm.DeletedAt{} // Clear the soft delete

				if err := db.Unscoped().Save(&existingUser).Error; err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reactivate user."})
					return
				}
				c.JSON(http.StatusOK, existingUser)
				return
			} else {
				// User exists and is not deleted
				c.JSON(http.StatusConflict, gin.H{"error": "User with this email already exists."})
				return
			}
		}

		// Save the new user to the database.
		if err := db.Create(&user).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user."})
			return
		}

		// Return the newly created user (password hash is excluded by the model's JSON tags).
		c.JSON(http.StatusCreated, user)
	}
}

// GetUsers retrieves a list of all users in the system.
func GetUsers(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var users []models.User
		query := db.Preload("Office").Order("created_at desc")

		// Filter by role if specified
		if role := c.Query("role"); role != "" {
			query = query.Where("role = ?", role)
		}

		// Apply limit if specified (for recent clients)
		if limit := c.Query("limit"); limit != "" {
			if limitInt, err := strconv.Atoi(limit); err == nil && limitInt > 0 {
				query = query.Limit(limitInt)
			}
		}

		if err := query.Find(&users).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve users"})
			return
		}
		c.JSON(http.StatusOK, users)
	}
}

// UpdateUserInput defines the structure for updating a user's details.
// Password is intentionally omitted; password resets should be a separate, secure process.
type UpdateUserInput struct {
	FirstName string `json:"firstName" binding:"required"`
	LastName  string `json:"lastName" binding:"required"`
	Email     string `json:"email" binding:"required,email"`
	Role      string `json:"role" binding:"required"`
	OfficeID  *uint  `json:"officeId"`
}

// UpdateUser handles modifying an existing user's details.
func UpdateUser(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var user models.User
		// Find the user by their ID from the URL parameter (e.g., /users/10).
		if err := db.Where("id = ?", c.Param("id")).First(&user).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found."})
			return
		}

		// Validate the incoming JSON data.
		var input UpdateUserInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Perform the same role and office validation as in CreateUser.
		if _, ok := validRoles[input.Role]; !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role specified."})
			return
		}
		if input.Role != "client" && input.OfficeID == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "An office must be assigned to all staff members."})
			return
		}

		// Check if email is being changed and if it conflicts with another user
		if user.Email != input.Email {
			var existingUser models.User
			if err := db.Where("email = ? AND id != ?", input.Email, user.ID).First(&existingUser).Error; err == nil {
				c.JSON(http.StatusConflict, gin.H{"error": "Email is already in use by another user."})
				return
			}
		}

		// Update the user model with the new data from the input.
		user.FirstName = input.FirstName
		user.LastName = input.LastName
		user.Email = input.Email
		user.Role = input.Role
		user.OfficeID = input.OfficeID

		// Save the changes to the database.
		if err := db.Save(&user).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user."})
			return
		}

		c.JSON(http.StatusOK, user)
	}
}

// DeleteUser handles deactivating a user account.
// This performs a "soft delete" by setting the `deleted_at` timestamp.
func DeleteUser(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var user models.User
		if err := db.Where("id = ?", c.Param("id")).First(&user).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found."})
			return
		}

		// Check if this is the admin user (prevent deleting the last admin)
		if user.Role == "admin" {
			var adminCount int64
			db.Model(&models.User{}).Where("role = ? AND deleted_at IS NULL", "admin").Count(&adminCount)
			if adminCount <= 1 {
				c.JSON(http.StatusForbidden, gin.H{"error": "Cannot delete the last admin user."})
				return
			}
		}

		// GORM's Delete method automatically performs a soft delete
		// because the User model has a `gorm.DeletedAt` field.
		if err := db.Delete(&user).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete user."})
			return
		}

		// A 204 No Content response is standard for a successful deletion.
		c.Status(http.StatusNoContent)
	}
}

// SearchClients finds clients by name or email.
func SearchClients(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get the search query from the URL (e.g., /search?q=John)
		query := c.Query("q")
		if strings.TrimSpace(query) == "" {
			c.JSON(http.StatusOK, []models.User{})
			return
		}

		var clients []models.User
		// Search for clients where the name or email contains the query text.
		searchPattern := "%" + strings.ToLower(query) + "%"
		db.Where("role = ? AND (LOWER(first_name || ' ' || last_name) LIKE ? OR LOWER(email) LIKE ?)", "client", searchPattern, searchPattern).
			Limit(10). // Limit to 10 results for performance
			Find(&clients)

		c.JSON(http.StatusOK, clients)
	}
}

// PermanentDeleteUser handles permanently removing a user from the database.
// This is a hard delete that completely removes the record.
func PermanentDeleteUser(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var user models.User
		if err := db.Unscoped().Where("id = ?", c.Param("id")).First(&user).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found."})
			return
		}

		// Check if this is the admin user (prevent deleting the last admin)
		if user.Role == "admin" {
			var adminCount int64
			db.Model(&models.User{}).Where("role = ? AND deleted_at IS NULL", "admin").Count(&adminCount)
			if adminCount <= 1 {
				c.JSON(http.StatusForbidden, gin.H{"error": "Cannot permanently delete the last admin user."})
				return
			}
		}

		// Perform a hard delete using Unscoped()
		if err := db.Unscoped().Delete(&user).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to permanently delete user."})
			return
		}

		// A 204 No Content response is standard for a successful deletion.
		c.Status(http.StatusNoContent)
	}
}
