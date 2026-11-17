// api/handlers/admin.go
package handlers

import (
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/BryanPMX/CAF/api/config"
	"github.com/BryanPMX/CAF/api/models"
	securityutil "github.com/BryanPMX/CAF/api/security"
	"github.com/BryanPMX/CAF/api/services"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// CreateUserInput defines the structure for an admin creating a new user.
// Email is optional for staff - it will be auto-generated if not provided.
type CreateUserInput struct {
	Specialty       *string                   `json:"specialty"`
	Employment      *services.EmploymentInput `json:"employment"`
	FirstName       string                    `json:"firstName" binding:"required"`
	LastName        string                    `json:"lastName" binding:"required"`
	Email           string                    `json:"email" binding:"omitempty,email"`
	Password        string                    `json:"password" binding:"required,min=12,max=72"`
	Role            string                    `json:"role" binding:"required"`
	OfficeID        *uint                     `json:"officeId"`
	Phone           string                    `json:"phone" binding:"required"`
	PersonalAddress *string                   `json:"personalAddress"`
}

func normalizeCreateUserInput(input *CreateUserInput) {
	input.FirstName = strings.TrimSpace(input.FirstName)
	input.LastName = strings.TrimSpace(input.LastName)
	input.Email = strings.ToLower(strings.TrimSpace(input.Email))
	input.Phone = strings.TrimSpace(input.Phone)
	if input.PersonalAddress != nil {
		trimmed := strings.TrimSpace(*input.PersonalAddress)
		input.PersonalAddress = &trimmed
	}
}

func validateCreateUserEmail(input CreateUserInput) string {
	if input.Role == "client" && input.Email == "" {
		return "El correo electrónico es requerido para clientes."
	}
	return ""
}

// CreateUser handles the creation of a new user by an administrator.
func CreateUser(db *gorm.DB) gin.HandlerFunc { return serializeUserMutation(db, createUser) }

func createUser(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input CreateUserInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		normalizeCreateUserInput(&input)
		if !authorizeUserChange(c, nil, input.Role, &input.OfficeID) {
			return
		}

		// Validate the provided role against our centralized role configuration
		if err := config.ValidateRole(input.Role); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if validationError := validateCreateUserEmail(input); validationError != "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": validationError})
			return
		}

		// All employees except the executive director require an office.
		if config.RequiresOffice(input.Role) && (input.OfficeID == nil || *input.OfficeID == 0) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "An office must be assigned to office-based staff members."})
			return
		}

		// For employees (non-clients), auto-generate corporate email if missing
		if input.Role != "client" && strings.TrimSpace(input.Email) == "" {
			if strings.TrimSpace(input.FirstName) == "" || strings.TrimSpace(input.LastName) == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "First name and last name are required to generate email."})
				return
			}
			base := generateCorpEmailLocalPart(input.FirstName, input.LastName)
			domain := "@caf-mexico.com"
			email := base + domain
			suffix := 1
			for {
				var exists models.User
				lookupErr := db.Unscoped().Where("LOWER(email) = ?", email).First(&exists).Error
				if lookupErr == gorm.ErrRecordNotFound {
					break
				}
				if lookupErr != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate employee email"})
					return
				}
				email = base + strconv.Itoa(suffix) + domain
				suffix++
			}
			input.Email = email
		}

		// Securely hash the temporary password.
		hashedPassword, err := securityutil.HashPassword(input.Password)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Create the new user model.
		user := models.User{
			FirstName:       input.FirstName,
			LastName:        input.LastName,
			Email:           input.Email,
			Password:        hashedPassword,
			Role:            input.Role,
			OfficeID:        input.OfficeID,
			Phone:           strings.TrimSpace(input.Phone),
			PersonalAddress: input.PersonalAddress,
		}

		// Check if a soft-deleted user with the same email exists
		var existingUser models.User
		if err := db.Unscoped().Where("LOWER(email) = ?", input.Email).First(&existingUser).Error; err == nil {
			// User exists but might be soft-deleted
			if existingUser.DeletedAt.Valid {
				if !authorizeUserChange(c, &existingUser, input.Role, &input.OfficeID) {
					return
				}
				// Reactivate the soft-deleted user
				previousRole := existingUser.Role
				existingUser.FirstName = input.FirstName
				existingUser.LastName = input.LastName
				existingUser.Password = hashedPassword
				existingUser.Role = input.Role
				existingUser.OfficeID = input.OfficeID
				existingUser.Phone = strings.TrimSpace(input.Phone)
				existingUser.PersonalAddress = input.PersonalAddress
				existingUser.DeletedAt = gorm.DeletedAt{} // Clear the soft delete

				if err := services.ApplyUserOrganization(&existingUser, previousRole, input.Specialty); err != nil {
					organizationFailure(c, err)
					return
				}
				if err := db.Transaction(func(tx *gorm.DB) error {
					if err := tx.Unscoped().Save(&existingUser).Error; err != nil {
						return err
					}
					return services.SyncUserOrganizations(tx, c.MustGet("currentUser").(models.User), &existingUser, input.Employment)
				}); err != nil {
					organizationFailure(c, err)
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

		if err := services.ApplyUserOrganization(&user, "", input.Specialty); err != nil {
			organizationFailure(c, err)
			return
		}
		// Save the new user to the database.
		if err := db.Transaction(func(tx *gorm.DB) error {
			if err := tx.Create(&user).Error; err != nil {
				return err
			}
			return services.SaveClientEmployment(tx, c.MustGet("currentUser").(models.User), &user, input.Employment)
		}); err != nil {
			organizationFailure(c, err)
			return
		}

		// Return the newly created user (password hash is excluded by the model's JSON tags).
		c.JSON(http.StatusCreated, user)
	}
}

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
		// Use Preload to properly load office relationship and ensure nested JSON structure
		query := db.Preload("Office").Preload("OrganizationMemberships.Organization").Order("users.created_at desc")
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
	Specialty       *string                   `json:"specialty"`
	Employment      *services.EmploymentInput `json:"employment"`
	Password        *string                   `json:"password"`
	FirstName       string                    `json:"firstName" binding:"required"`
	LastName        string                    `json:"lastName"`
	Email           string                    `json:"email" binding:"omitempty,email"`
	Role            string                    `json:"role" binding:"required"`
	OfficeID        *uint                     `json:"officeId"`
	Phone           string                    `json:"phone"`
	PersonalAddress *string                   `json:"personalAddress"`
}

// UpdateUser handles modifying an existing user's details.
func UpdateUser(db *gorm.DB) gin.HandlerFunc { return serializeUserMutation(db, updateUser) }

func updateUser(db *gorm.DB) gin.HandlerFunc {
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

		input.FirstName = strings.TrimSpace(input.FirstName)
		input.LastName = strings.TrimSpace(input.LastName)
		input.Email = strings.ToLower(strings.TrimSpace(input.Email))
		if input.FirstName == "" || (user.ClientType != models.ClientOrganization && (input.LastName == "" || input.Email == "" || strings.TrimSpace(input.Phone) == "")) {
			c.JSON(400, gin.H{"error": "Complete nombre, apellidos, correo y teléfono"})
			return
		}
		if !authorizeUserChange(c, &user, input.Role, &input.OfficeID) {
			return
		}

		if input.Password != nil {
			actor := c.MustGet("currentUser").(models.User)
			if !config.CanResetPasswords(actor.Role) {
				c.JSON(http.StatusForbidden, gin.H{"error": "Only technical support can reset passwords"})
				return
			}
			hash, err := securityutil.HashPassword(*input.Password)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			user.Password = hash
			user.TokenVersion++
		}

		// Perform the same role and office validation as in CreateUser using centralized config
		if err := config.ValidateRole(input.Role); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		// Office administrators must retain an office assignment.
		if config.RequiresOffice(input.Role) && (input.OfficeID == nil || *input.OfficeID == 0) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "An office must be assigned to office-based staff members."})
			return
		}

		if user.Role == config.RoleExecutiveDirector && input.Role != config.RoleExecutiveDirector {
			var remaining int64
			if err := db.Model(&models.User{}).Where("role = ? AND is_active = ? AND id <> ?", config.RoleExecutiveDirector, true, user.ID).Count(&remaining).Error; err != nil || remaining == 0 {
				c.JSON(http.StatusForbidden, gin.H{"error": "Cannot demote the last executive director"})
				return
			}
		}
		// Check if email is being changed and if it conflicts with another user
		if user.Email != input.Email && input.Email != "" {
			var existingUser models.User
			if err := db.Where("email = ? AND id != ?", input.Email, user.ID).First(&existingUser).Error; err == nil {
				c.JSON(http.StatusConflict, gin.H{"error": "Email is already in use by another user."})
				return
			}
		}

		// Update the user model with the new data from the input.
		previousRole := user.Role
		user.FirstName = input.FirstName
		user.LastName = input.LastName
		user.Email = input.Email
		user.Role = input.Role
		user.OfficeID = input.OfficeID
		user.Phone = strings.TrimSpace(input.Phone)
		user.PersonalAddress = input.PersonalAddress

		if err := services.ApplyUserOrganization(&user, previousRole, input.Specialty); err != nil {
			organizationFailure(c, err)
			return
		}
		// Save the changes to the database.
		if err := db.Transaction(func(tx *gorm.DB) error {
			if err := tx.Save(&user).Error; err != nil {
				return err
			}
			return services.SyncUserOrganizations(tx, c.MustGet("currentUser").(models.User), &user, input.Employment)
		}); err != nil {
			organizationFailure(c, err)
			return
		}

		if input.Password != nil {
			DisconnectUser(fmt.Sprint(user.ID))
		}
		c.JSON(http.StatusOK, user)
	}
}

// DeleteUser handles deactivating a user account.
// This performs a "soft delete" by setting the `deleted_at` timestamp.
// Protected by: self-deletion prevention, last-admin protection, system user protection.
func DeleteUser(db *gorm.DB) gin.HandlerFunc { return serializeUserMutation(db, deleteUser) }

func deleteUser(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		targetID := c.Param("id")

		// Protection 1: Prevent self-deletion
		currentUserID, exists := c.Get("userID")
		if exists && currentUserID.(string) == targetID {
			c.JSON(http.StatusForbidden, gin.H{"error": "Cannot delete your own account"})
			return
		}

		var user models.User
		if err := db.Where("id = ?", targetID).First(&user).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}

		requestedOffice := user.OfficeID
		if !authorizeUserChange(c, &user, user.Role, &requestedOffice) {
			return
		}

		// Protection 2: Prevent deletion of system/protected users (user ID 1 is reserved for system admin)
		if user.ClientType == models.ClientOrganization {
			c.JSON(403, gin.H{"error": "La cuenta está vinculada a una constructora y no puede eliminarse desde Usuarios"})
			return
		}
		if user.ID == 1 || user.Role == config.RoleTechnicalSupport {
			c.JSON(http.StatusForbidden, gin.H{"error": "Cannot delete the system administrator account"})
			return
		}

		// Protection 3: Preserve the last active executive director.
		if user.Role == config.RoleExecutiveDirector {
			var adminCount int64
			db.Model(&models.User{}).Where("role = ? AND is_active = ? AND deleted_at IS NULL", config.RoleExecutiveDirector, true).Count(&adminCount)
			if adminCount <= 1 {
				c.JSON(http.StatusForbidden, gin.H{"error": "Cannot delete the last executive director account"})
				return
			}
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
		officeScopedQuery(db, c, "office_id").Where("role = ? AND (LOWER(first_name || ' ' || last_name) LIKE ? OR LOWER(email) LIKE ?)", "client", searchPattern, searchPattern).
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
		query := officeScopedQuery(db.Preload("Office").Preload("OrganizationMemberships.Organization"), c, "users.office_id").Where("id = ? AND deleted_at IS NULL", userID)

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
		if err := db.Preload("Case").Where("case_id IN (?)", officeScopedQuery(db.Model(&models.Case{}).Select("id"), c, "office_id")).Where("user_id = ?", user.ID).Find(&caseAssignments).Error; err != nil {
			// Log error but don't fail the request
			log.Printf("Warning: Failed to load case assignments for user %d: %v", user.ID, err)
		}

		// Build response with all associated data
		response := gin.H{
			"user":             user,
			"organizationInfo": config.ProfileOrganizationFor(user.Role, user.Department, user.Specialty),
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

		// For clients, include contact form submissions (interest metadata)
		if user.Role == "client" {
			var contactSubmissions []models.ContactSubmission
			if err := officeScopedQuery(db, c, "office_id").Where("user_id = ?", user.ID).Order("created_at DESC").Find(&contactSubmissions).Error; err == nil {
				response["contactSubmissions"] = contactSubmissions
			} else {
				response["contactSubmissions"] = []models.ContactSubmission{}
			}
		}

		c.JSON(http.StatusOK, response)
	}
}

// PermanentDeleteUser handles permanently removing a user from the database.
// This is a hard delete that completely removes the record.
func PermanentDeleteUser(db *gorm.DB) gin.HandlerFunc {
	return serializeUserMutation(db, permanentDeleteUser)
}

func permanentDeleteUser(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var user models.User
		if err := db.Unscoped().Where("id = ?", c.Param("id")).First(&user).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found."})
			return
		}

		requestedOffice := user.OfficeID
		if !authorizeUserChange(c, &user, user.Role, &requestedOffice) {
			return
		}

		if user.ClientType == models.ClientOrganization {
			c.JSON(403, gin.H{"error": "La cuenta está vinculada a una constructora y no puede eliminarse desde Usuarios"})
			return
		}
		if user.ID == 1 || user.Role == config.RoleTechnicalSupport {
			c.JSON(http.StatusForbidden, gin.H{"error": "Cannot delete the system administrator account"})
			return
		}

		// Preserve the last active executive director.
		if user.Role == config.RoleExecutiveDirector {
			var adminCount int64
			db.Model(&models.User{}).Where("role = ? AND is_active = ? AND deleted_at IS NULL", config.RoleExecutiveDirector, true).Count(&adminCount)
			if adminCount <= 1 {
				c.JSON(http.StatusForbidden, gin.H{"error": "Cannot permanently delete the last executive director user."})
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
