package middleware

import (
	"fmt"
	"net/http"

	"github.com/BryanPMX/CAF/api/config"
	"github.com/BryanPMX/CAF/api/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// DataAccessControl is a comprehensive middleware that enforces fine-grained access control
// based on user roles, departments, and case assignments
func DataAccessControl(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("userID")
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "User ID not found in context"})
			return
		}

		var user models.User
		if err := db.Preload("Office").First(&user, "id = ?", userID).Error; err != nil {
			// Log the error for debugging
			fmt.Printf("DataAccessControl: Failed to find user with ID %v: %v\n", userID, err)
			c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}

		// Set user context for downstream handlers
		c.Set("currentUser", user)
		c.Set("userRole", user.Role)
		c.Set("userDepartment", user.Department)
		c.Set("userOfficeID", user.OfficeID)

		// Admin users have full access
		if user.Role == config.RoleAdmin {
			c.Next()
			return
		}

		// Treat any non-admin, non-client role as staff-like for access scoping
		if user.Role != "client" {
			// Ensure staff-like users are assigned to an office
			if user.OfficeID == nil {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Access denied: Staff member must be assigned to an office"})
				return
			}
			// Set office scope for data filtering
			c.Set("officeScopeID", *user.OfficeID)
		}

		c.Next()
	}
}

// CaseAccessControl middleware ensures users only access cases they're assigned to or have permission for
func CaseAccessControl(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		user, exists := c.Get("currentUser")
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "User context not found"})
			return
		}
		currentUser := user.(models.User)

		// Admin users have access to all cases
		if currentUser.Role == config.RoleAdmin {
			c.Next()
			return
		}

		// Office managers have access to all cases in their office
		if currentUser.Role == config.RoleOfficeManager {
			caseID := c.Param("id")
			if caseID != "" {
				// For specific case access, verify it belongs to their office
				var caseRecord models.Case
				if err := db.Select("office_id").First(&caseRecord, caseID).Error; err != nil {
					c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "Case not found"})
					return
				}

				if currentUser.OfficeID != nil && *currentUser.OfficeID != caseRecord.OfficeID {
					c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Access denied: Case belongs to different office"})
					return
				}
			}
			c.Next()
			return
		}

		// For staff-like users, check case assignment and department compatibility
		if currentUser.Role != "client" {
			caseID := c.Param("id")
			if caseID == "" {
				// This is a list endpoint, apply department-based filtering
				c.Set("departmentFilter", currentUser.Department)
				c.Next()
				return
			}

			// Get case details to check access
			var caseRecord models.Case
			if err := db.Select("category, office_id, primary_staff_id").First(&caseRecord, caseID).Error; err != nil {
				c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "Case not found"})
				return
			}

			// Check multiple access conditions (same logic as ApplyAccessControl)
			hasAccess := false

			// 1. Check if user is primary staff
			if caseRecord.PrimaryStaffID != nil && *caseRecord.PrimaryStaffID == currentUser.ID {
				hasAccess = true
			}

			// 2. Check office and department compatibility
			if !hasAccess && currentUser.OfficeID != nil && currentUser.Department != nil {
				if *currentUser.OfficeID == caseRecord.OfficeID && *currentUser.Department == caseRecord.Category {
					hasAccess = true
				}
			} else if !hasAccess && currentUser.OfficeID != nil {
				if *currentUser.OfficeID == caseRecord.OfficeID {
					hasAccess = true
				}
			} else if !hasAccess && currentUser.Department != nil {
				if *currentUser.Department == caseRecord.Category {
					hasAccess = true
				}
			}

			// 3. Check if user has assigned tasks for this case
			if !hasAccess {
				var taskCount int64
				if err := db.Model(&models.Task{}).Where("case_id = ? AND assigned_to_id = ? AND deleted_at IS NULL", caseID, currentUser.ID).Count(&taskCount).Error; err == nil && taskCount > 0 {
					hasAccess = true
				}
			}

			// 4. Check UserCaseAssignment table (legacy support)
			if !hasAccess {
				var assignment models.UserCaseAssignment
				if err := db.Where("user_id = ? AND case_id = ?", currentUser.ID, caseID).First(&assignment).Error; err == nil {
					hasAccess = true
				}
			}

			if !hasAccess {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Access denied: You don't have permission to access this case"})
				return
			}
		}

		c.Next()
	}
}

// AppointmentAccessControl middleware ensures users only access appointments they're authorized to see
func AppointmentAccessControl(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		user, exists := c.Get("currentUser")
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "User context not found"})
			return
		}
		currentUser := user.(models.User)

		// Admin users have access to all appointments
		if currentUser.Role == config.RoleAdmin {
			c.Next()
			return
		}

		// Office managers have access to all appointments in their office
		if currentUser.Role == config.RoleOfficeManager {
			appointmentID := c.Param("id")
			if appointmentID != "" {
				// For specific appointment access, verify it belongs to their office
				var appointment models.Appointment
				if err := db.Preload("Case").First(&appointment, appointmentID).Error; err != nil {
					c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "Appointment not found"})
					return
				}

				if currentUser.OfficeID != nil && appointment.Case.OfficeID != *currentUser.OfficeID {
					c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Access denied: Appointment belongs to different office"})
					return
				}
			}
			c.Next()
			return
		}

		// For staff-like users, apply department-based filtering
		if currentUser.Role != "client" {
			appointmentID := c.Param("id")
			if appointmentID == "" {
				// This is a list endpoint, apply department-based filtering
				c.Set("departmentFilter", currentUser.Department)
				c.Next()
				return
			}

			// Check specific appointment access
			var appointment models.Appointment
			if err := db.Preload("Case").First(&appointment, appointmentID).Error; err != nil {
				c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "Appointment not found"})
				return
			}

			// Check if user is the assigned staff member
			if appointment.StaffID == currentUser.ID {
				c.Next()
				return
			}

			// Check office access
			if currentUser.OfficeID != nil && appointment.Case.OfficeID != *currentUser.OfficeID {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Access denied: Appointment belongs to different office"})
				return
			}

			// Check department compatibility
			if currentUser.Department != nil && *currentUser.Department != appointment.Department {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Access denied: Appointment department not compatible with user department"})
				return
			}
		}

		c.Next()
	}
}

// TaskAccessControl middleware ensures users only access tasks they're assigned to or have permission for
func TaskAccessControl(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		user, exists := c.Get("currentUser")
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "User context not found"})
			return
		}
		currentUser := user.(models.User)

		// Admin users have access to all tasks
		if currentUser.Role == config.RoleAdmin {
			c.Next()
			return
		}

		// For staff-like users, check task assignment and case access
		if currentUser.Role != "client" {
			taskID := c.Param("id")
			if taskID == "" {
				// This is a list endpoint, apply assignment-based filtering
				c.Set("assignedToFilter", currentUser.ID)
				c.Next()
				return
			}

			// Check specific task access
			var task models.Task
			if err := db.Preload("Case").First(&task, taskID).Error; err != nil {
				c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "Task not found"})
				return
			}

			// Check if user is assigned to this task
			if task.AssignedToID != nil && *task.AssignedToID == currentUser.ID {
				c.Next()
				return
			}

			// Check if user has access to the case this task belongs to
			var caseAssignment models.UserCaseAssignment
			err := db.Where("user_id = ? AND case_id = ?", currentUser.ID, task.CaseID).First(&caseAssignment).Error
			if err != nil {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Access denied: Task belongs to unassigned case"})
				return
			}
		}

		c.Next()
	}
}

// DepartmentFilter middleware applies department-based filtering to database queries
func DepartmentFilter(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		user, exists := c.Get("currentUser")
		if !exists {
			c.Next()
			return
		}
		currentUser := user.(models.User)

		// Only apply department filtering for staff-like users
		if currentUser.Role != "client" && currentUser.Role != "admin" && currentUser.Department != nil {
			c.Set("departmentFilter", *currentUser.Department)
		}

		c.Next()
	}
}
