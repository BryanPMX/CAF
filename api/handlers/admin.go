// api/handlers/admin.go
package handlers

import (
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/BryanPMX/CAF/api/config"
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

// CreateUser handles the creation of a new user by an administrator.
func CreateUser(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input CreateUserInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Validate the provided role against our centralized role configuration
		if err := config.ValidateRole(input.Role); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Enforce that all non-client users must be assigned to an office, except admins
		if input.Role != "client" && input.Role != config.RoleAdmin && input.OfficeID == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "An office must be assigned to all staff members (admins are exempt)."})
			return
		}

		// For employees (non-clients), auto-generate corporate email if missing
		if input.Role != "client" && strings.TrimSpace(input.Email) == "" {
			if strings.TrimSpace(input.FirstName) == "" || strings.TrimSpace(input.LastName) == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "First name and last name are required to generate email."})
				return
			}
			base := generateCorpEmailLocalPart(input.FirstName, input.LastName)
			domain := "@caf.org"
			email := base + domain
			suffix := 1
			for {
				var exists models.User
				if err := db.Unscoped().Where("email = ?", email).First(&exists).Error; err == gorm.ErrRecordNotFound {
					break
				}
				email = base + strconv.Itoa(suffix) + domain
				suffix++
			}
			input.Email = email
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

// generateCorpEmailLocalPart builds a normalized local-part like jsmith from first/last names
func generateCorpEmailLocalPart(firstName, lastName string) string {
	fn := strings.TrimSpace(firstName)
	ln := strings.TrimSpace(lastName)
	local := ""
	if fn != "" {
		r := []rune(fn)
		if len(r) > 0 {
			local += strings.ToLower(string(r[0]))
		}
	}
	for _, ch := range ln {
		if (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') {
			local += strings.ToLower(string(ch))
		}
	}
	if local == "" {
		local = "user"
	}
	return local
}

// GetUsers retrieves a list of all users in the system.
func GetUsers(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Initialize with empty slice to prevent null JSON response
		users := make([]models.User, 0)
		// CRITICAL FIX: Use Joins instead of Preload to eliminate N+1 query problem
		query := db.Joins("LEFT JOIN offices ON users.office_id = offices.id").
			Select("users.*, offices.id as office_id, offices.name as office_name, offices.address as office_address").
			Order("users.created_at desc")
		countQ := db.Model(&models.User{})

		// Restrict to requester's office for non-admin roles when office scope is available
		if roleVal, exists := c.Get("userRole"); exists {
			if role, ok := roleVal.(string); ok && !config.CanAccessAllOffices(role) {
				if officeScopeVal, ok2 := c.Get("officeScopeID"); ok2 {
					if officeID, ok3 := officeScopeVal.(uint); ok3 {
						query = query.Where("office_id = ?", officeID)
						countQ = countQ.Where("office_id = ?", officeID)
					}
				}
			}
		}

		// Filter by role if specified
		if role := c.Query("role"); role != "" {
			query = query.Where("role = ?", role)
			countQ = countQ.Where("role = ?", role)
		}

		// Optional filter by officeId (primarily for admin; for non-admin it will still remain within their scoped office)
		if officeIDParam := c.Query("officeId"); officeIDParam != "" {
			if officeIDUint, err := strconv.ParseUint(officeIDParam, 10, 32); err == nil && officeIDUint > 0 {
				query = query.Where("office_id = ?", uint(officeIDUint))
				countQ = countQ.Where("office_id = ?", uint(officeIDUint))
			}
		}

		// Optional activity filter: active (last_login within 24h), inactive (last_login null or >30d)
		if activity := c.Query("activity"); activity != "" {
			now := time.Now()
			switch strings.ToLower(activity) {
			case "active":
				query = query.Where("last_login > ?", now.Add(-24*time.Hour))
				countQ = countQ.Where("last_login > ?", now.Add(-24*time.Hour))
			case "inactive":
				query = query.Where("last_login IS NULL OR last_login <= ?", now.Add(-30*24*time.Hour))
				countQ = countQ.Where("last_login IS NULL OR last_login <= ?", now.Add(-30*24*time.Hour))
			}
		}

		// Optional free-text search
		if q := strings.TrimSpace(c.Query("q")); q != "" {
			like := "%" + strings.ToLower(q) + "%"
			query = query.Where("LOWER(first_name || ' ' || last_name) LIKE ? OR LOWER(email) LIKE ?", like, like)
			countQ = countQ.Where("LOWER(first_name || ' ' || last_name) LIKE ? OR LOWER(email) LIKE ?", like, like)
		}

		// Pagination
		page := 1
		pageSize := 20
		if p := c.Query("page"); p != "" {
			if pv, err := strconv.Atoi(p); err == nil && pv > 0 {
				page = pv
			}
		}
		if ps := c.Query("pageSize"); ps != "" {
			if psv, err := strconv.Atoi(ps); err == nil && psv > 0 && psv <= 200 {
				pageSize = psv
			}
		}
		offset := (page - 1) * pageSize
		query = query.Offset(offset).Limit(pageSize)

		// Apply limit if specified (for recent clients)
		if limit := c.Query("limit"); limit != "" {
			if limitInt, err := strconv.Atoi(limit); err == nil && limitInt > 0 {
				query = query.Limit(limitInt)
			}
		}

		var total int64
		if err := countQ.Count(&total).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count users."})
			return
		}

		if err := query.Find(&users).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users."})
			return
		}

		totalPages := (total + int64(pageSize) - 1) / int64(pageSize)
		
		c.JSON(http.StatusOK, gin.H{
			"data": users,
			"pagination": gin.H{
				"page":       page,
				"pageSize":   pageSize,
				"total":      total,
				"totalPages": totalPages,
				"hasNext":    page < int(totalPages),
				"hasPrev":    page > 1,
			},
			"performance": gin.H{
				"queryTime":    "0ms",
				"cacheHit":     false,
				"responseSize": len(users),
			},
		})
	}
}

// UpdateUserInput defines the structure for updating a user's details.
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

		// Perform the same role and office validation as in CreateUser using centralized config
		if err := config.ValidateRole(input.Role); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if input.Role != "client" && input.Role != config.RoleAdmin && input.OfficeID == nil {
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
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}
		if err := db.Delete(&user).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete user"})
			return
		}
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

		// Initialize with empty slice to prevent null JSON response
		clients := make([]models.User, 0)
		// Search for clients where the name or email contains the query text.
		searchPattern := "%" + strings.ToLower(query) + "%"
		db.Where("role = ? AND (LOWER(first_name || ' ' || last_name) LIKE ? OR LOWER(email) LIKE ?)", "client", searchPattern, searchPattern).
			Limit(10). // Limit to 10 results for performance
			Find(&clients)

		c.JSON(http.StatusOK, clients)
	}
}

// GetUserByID retrieves a single user by their ID with all associated data
func GetUserByID(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.Param("id")
		var user models.User

		// Use Preload to efficiently load user with office and case assignments
		query := db.Preload("Office").Where("id = ? AND deleted_at IS NULL", userID)

		if err := query.First(&user).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve user"})
			return
		}

		// Load case assignments for this user
		var caseAssignments []models.UserCaseAssignment
		if err := db.Preload("Case").Where("user_id = ?", user.ID).Find(&caseAssignments).Error; err != nil {
			// Log error but don't fail the request
			log.Printf("Warning: Failed to load case assignments for user %d: %v", user.ID, err)
		}

		// Build response with all associated data
		response := gin.H{
			"user": user,
			"office": func() gin.H {
				if user.Office != nil {
					return gin.H{
						"id":      user.Office.ID,
						"name":    user.Office.Name,
						"address": user.Office.Address,
					}
				}
				return gin.H{"id": user.OfficeID}
			}(),
			"caseAssignments": caseAssignments,
			"totalCases":      len(caseAssignments),
		}

		c.JSON(http.StatusOK, response)
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
		if user.Role == config.RoleAdmin {
			var adminCount int64
			db.Model(&models.User{}).Where("role = ? AND deleted_at IS NULL", config.RoleAdmin).Count(&adminCount)
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
