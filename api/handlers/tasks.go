package handlers

import (
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/BryanPMX/CAF/api/config"
	"github.com/BryanPMX/CAF/api/middleware"
	"github.com/BryanPMX/CAF/api/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// validTaskStatuses strictly limits task statuses allowed in the system
var validTaskStatuses = map[string]bool{
	string(config.TaskStatusPending):    true,
	string(config.TaskStatusInProgress): true,
	string(config.TaskStatusCompleted):  true,
	string(config.TaskStatusCancelled):  true,
}

// CreateTaskInput defines the structure for creating a new task
type CreateTaskInput struct {
	CaseID       uint       `json:"caseId" binding:"required"`
	AssignedToID *uint      `json:"assignedToId,omitempty"` // Can be nil for unassigned tasks
	Title        string     `json:"title" binding:"required"`
	DueDate      *time.Time `json:"dueDate,omitempty"`
}

// UpdateTaskInput defines the structure for updating a task
type UpdateTaskInput struct {
	Title        string     `json:"title,omitempty"`
	AssignedToID *uint      `json:"assignedToId,omitempty"`
	DueDate      *time.Time `json:"dueDate,omitempty"`
	Status       string     `json:"status,omitempty"`
}

// GetTasks returns tasks based on user permissions and assignments
func GetTasks(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Initialize with empty slice to prevent null JSON response
		tasks := make([]models.Task, 0)
		query := db.Preload("AssignedTo").Preload("Case")

		// Apply access control based on user role and assignments
		userRole, _ := c.Get("userRole")
		userDepartment, _ := c.Get("userDepartment")
		officeScopeID, _ := c.Get("officeScopeID")

		if userRole == config.RoleLawyer || userRole == config.RolePsychologist || userRole == config.RoleReceptionist {
			// Staff users see tasks assigned to them or from cases they're assigned to
			userID, _ := c.Get("userID")
			userIDUint, _ := strconv.ParseUint(userID.(string), 10, 32)

			// Tasks assigned to the user
			query = query.Where("assigned_to_id = ?", userIDUint)

			// Or tasks from cases where the user is assigned
			query = query.Or("case_id IN (SELECT case_id FROM user_case_assignments WHERE user_id = ?)", userIDUint)

			// Apply office scoping
			if officeScopeID != nil {
				query = query.Joins("INNER JOIN cases ON cases.id = tasks.case_id AND cases.office_id = ?", officeScopeID)
			}

			// Apply department filtering if available
			if userDepartment != nil {
				query = query.Joins("INNER JOIN cases ON cases.id = tasks.case_id AND cases.category = ?", userDepartment)
			}
		}

		// Apply additional filters from query parameters
		if status := c.Query("status"); status != "" {
			query = query.Where("tasks.status = ?", status)
		}
		if caseID := c.Query("caseId"); caseID != "" {
			query = query.Where("tasks.case_id = ?", caseID)
		}

		// Execute query with ordering
		if err := query.Order("tasks.created_at desc").Find(&tasks).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve tasks"})
			return
		}

		c.JSON(http.StatusOK, tasks)
	}
}

// GetTaskByID returns a specific task with access control and all associated data
func GetTaskByID(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		taskID := c.Param("id")
		var task models.Task

		// Use Preload to efficiently load task with all related data
		query := db.Preload("Case").Preload("Case.Client").Preload("AssignedTo").Where("id = ? AND deleted_at IS NULL", taskID)

		// Apply access control
		userRole, _ := c.Get("userRole")
		userDepartment, _ := c.Get("userDepartment")
		officeScopeID, _ := c.Get("officeScopeID")

		if userRole == config.RoleLawyer || userRole == config.RolePsychologist || userRole == config.RoleReceptionist {
			// Staff users can only access tasks assigned to them or from cases they're assigned to
			userID, _ := c.Get("userID")
			userIDUint, _ := strconv.ParseUint(userID.(string), 10, 32)

			// Tasks assigned to the user
			query = query.Where("assigned_to_id = ?", userIDUint)

			// Or tasks from cases where the user is assigned
			query = query.Or("case_id IN (SELECT case_id FROM user_case_assignments WHERE user_id = ?)", userIDUint)

			// Apply office scoping
			if officeScopeID != nil {
				query = query.Joins("INNER JOIN cases ON cases.id = tasks.case_id AND cases.office_id = ?", officeScopeID)
			}

			// Apply department filtering if available
			if userDepartment != nil {
				query = query.Joins("INNER JOIN cases ON cases.id = tasks.case_id AND cases.category = ?", userDepartment)
			}
		}

		if err := query.First(&task, taskID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "Task not found or access denied"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve task"})
			return
		}

		// Load task comments with user information
		var comments []models.TaskComment
		if err := db.Preload("User").Where("task_id = ? AND deleted_at IS NULL", task.ID).Order("created_at ASC").Find(&comments).Error; err != nil {
			// Log error but don't fail the request
			log.Printf("Warning: Failed to load comments for task %d: %v", task.ID, err)
		}

		// Build comprehensive response with all nested data
		response := gin.H{
			"task": task,
			"case": func() gin.H {
				if task.Case.ID != 0 {
					return gin.H{
						"id":          task.Case.ID,
						"title":       task.Case.Title,
						"description": task.Case.Description,
						"status":      task.Case.Status,
						"category":    task.Case.Category,
					}
				}
				return gin.H{"id": task.CaseID}
			}(),
			"assignedTo": func() gin.H {
				if task.AssignedTo != nil {
					return gin.H{
						"id":        task.AssignedTo.ID,
						"firstName": task.AssignedTo.FirstName,
						"lastName":  task.AssignedTo.LastName,
						"email":     task.AssignedTo.Email,
					}
				}
				return gin.H{"id": task.AssignedToID}
			}(),
			"client": func() gin.H {
				if task.Case.ID != 0 && task.Case.Client != nil {
					return gin.H{
						"id":        task.Case.Client.ID,
						"firstName": task.Case.Client.FirstName,
						"lastName":  task.Case.Client.LastName,
						"email":     task.Case.Client.Email,
					}
				}
				return gin.H{}
			}(),
			"office": func() gin.H {
				if task.Case.ID != 0 {
					return gin.H{
						"id": task.Case.OfficeID,
					}
				}
				return gin.H{}
			}(),
			"comments":      comments,
			"totalComments": len(comments),
		}

		c.JSON(http.StatusOK, response)
	}
}

// CreateTaskEnhanced creates a new task with access control validation
func CreateTaskEnhanced(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input CreateTaskInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Get current user context
		currentUser, _ := c.Get("currentUser")
		user := currentUser.(models.User)

		// Validate that the case exists and user has access to it
		var caseRecord models.Case
		if err := db.First(&caseRecord, input.CaseID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Case not found"})
			return
		}

		// Check case access permissions
		if middleware.IsStaffRole(user.Role) {
			// Check if user is assigned to this case
			var assignment models.UserCaseAssignment
			if err := db.Where("user_id = ? AND case_id = ?", user.ID, input.CaseID).First(&assignment).Error; err != nil {
				c.JSON(http.StatusForbidden, gin.H{"error": "Access denied: You can only create tasks for cases you're assigned to"})
				return
			}

			// Check office access
			if user.OfficeID != nil && *user.OfficeID != caseRecord.OfficeID {
				c.JSON(http.StatusForbidden, gin.H{"error": "Access denied: Case belongs to different office"})
				return
			}

			// Check department compatibility
			if user.Department != nil && *user.Department != caseRecord.Category {
				c.JSON(http.StatusForbidden, gin.H{"error": "Access denied: Case category not compatible with your department"})
				return
			}
		}

		// Create the task
		task := models.Task{
			CaseID:       input.CaseID,
			AssignedToID: input.AssignedToID,
			Title:        input.Title,
			DueDate:      input.DueDate,
			Status:       "pending",
		}

		if err := db.Create(&task).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create task"})
			return
		}

		// Invalidate case cache since case now has new tasks
		invalidateCache(strconv.FormatUint(uint64(input.CaseID), 10))

		// Generate notification for the assigned user if task is assigned
		if input.AssignedToID != nil {
			// Get case title for the notification message
			caseTitle := caseRecord.Title
			if caseTitle == "" {
				caseTitle = "Caso sin título"
			}

			// Create notification message in Spanish
			notificationMessage := "Se le ha asignado una nueva tarea en el caso: " + caseTitle

			// Create link to the task
			taskLink := "/app/tasks/" + strconv.FormatUint(uint64(task.ID), 10)

			// Create notification for the assigned user
			if err := CreateNotification(db, *input.AssignedToID, notificationMessage, "info", &taskLink); err != nil {
				// Log error but don't fail the task creation
				// In production, you might want to use a proper logging system
				_ = err // Suppress unused variable warning
			}
		}

		c.JSON(http.StatusCreated, task)
	}
}

// UpdateTaskEnhanced updates a task with access control validation
func UpdateTaskEnhanced(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		taskID := c.Param("id")
		var input UpdateTaskInput

		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Get current user context
		currentUser, _ := c.Get("currentUser")
		user := currentUser.(models.User)

		// Check if task exists and user has access
		var task models.Task
		query := db.Preload("Case")

		if middleware.IsStaffRole(user.Role) {
			// Staff users can only update tasks assigned to them or from cases they're assigned to
			userID, _ := c.Get("userID")
			userIDUint, _ := strconv.ParseUint(userID.(string), 10, 32)

			// Tasks assigned to the user
			query = query.Where("assigned_to_id = ?", userIDUint)

			// Or tasks from cases where the user is assigned
			query = query.Or("case_id IN (SELECT case_id FROM user_case_assignments WHERE user_id = ?)", userIDUint)
		}

		if err := query.First(&task, taskID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "Task not found or access denied"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve task"})
			return
		}

		// Update the task
		updates := make(map[string]interface{})
		if input.Title != "" {
			updates["title"] = input.Title
		}
		if input.DueDate != nil {
			updates["due_date"] = input.DueDate
		}
		if input.Status != "" {
			// Validate the provided status against our allowed list
			if _, ok := validTaskStatuses[input.Status]; !ok {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task status specified. Allowed values: pending, in_progress, completed"})
				return
			}
			updates["status"] = input.Status

			// Set completed_at timestamp when status changes to completed
			if input.Status == "completed" {
				now := time.Now()
				updates["completed_at"] = &now
			}
		}

		if err := db.Model(&task).Updates(updates).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update task"})
			return
		}

		// Invalidate case cache since task was updated
		invalidateCache(strconv.FormatUint(uint64(task.CaseID), 10))

		c.JSON(http.StatusOK, task)
	}
}

// DeleteTaskEnhanced deletes a task with access control validation
func DeleteTaskEnhanced(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		taskID := c.Param("id")

		// Get current user context
		currentUser, _ := c.Get("currentUser")
		user := currentUser.(models.User)

		// Check if task exists and user has access
		var task models.Task
		query := db.Preload("Case")

		if middleware.IsStaffRole(user.Role) {
			// Staff users can only delete tasks assigned to them or from cases they're assigned to
			userID, _ := c.Get("userID")
			userIDUint, _ := strconv.ParseUint(userID.(string), 10, 32)

			// Tasks assigned to the user
			query = query.Where("assigned_to_id = ?", userIDUint)

			// Or tasks from cases where the user is assigned
			query = query.Or("case_id IN (SELECT case_id FROM user_case_assignments WHERE user_id = ?)", userIDUint)
		}

		if err := query.First(&task, taskID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "Task not found or access denied"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve task"})
			return
		}

		// Soft delete the task
		if err := db.Delete(&task).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete task"})
			return
		}

		// Invalidate case cache since task was deleted
		invalidateCache(strconv.FormatUint(uint64(task.CaseID), 10))

		c.JSON(http.StatusOK, gin.H{
			"message": "Task deleted successfully",
		})
	}
}

// TaskCommentInput defines the structure for creating/updating task comments
type TaskCommentInput struct {
	Comment string `json:"comment" binding:"required"`
}

// CreateTaskComment creates a new comment on a task
func CreateTaskComment(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		taskID := c.Param("id")
		var input TaskCommentInput

		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Get current user context
		currentUser, _ := c.Get("currentUser")
		user := currentUser.(models.User)

		// Convert taskID string to uint
		taskIDUint, err := strconv.ParseUint(taskID, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
			return
		}

		// Check if task exists and user has access
		var task models.Task
		if err := db.Preload("Case").First(&task, taskIDUint).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
			return
		}

		// Apply access control
		if middleware.IsStaffRole(user.Role) {
			// Check if user is assigned to this task or the case
			if task.AssignedToID == nil || *task.AssignedToID != user.ID {
				var assignment models.UserCaseAssignment
				if err := db.Where("user_id = ? AND case_id = ?", user.ID, task.CaseID).First(&assignment).Error; err != nil {
					c.JSON(http.StatusForbidden, gin.H{"error": "Access denied: You can only comment on tasks you're assigned to or cases you're assigned to"})
					return
				}
			}
		}

		// Create the comment
		comment := models.TaskComment{
			TaskID:  uint(taskIDUint),
			UserID:  user.ID,
			Comment: input.Comment,
		}

		if err := db.Create(&comment).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create comment"})
			return
		}

		// Preload user info for response
		db.Preload("User").First(&comment, comment.ID)

		c.JSON(http.StatusCreated, comment)
	}
}

// UpdateTaskComment updates a task comment
func UpdateTaskComment(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		commentID := c.Param("commentId")
		var input TaskCommentInput

		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Get current user context
		currentUser, _ := c.Get("currentUser")
		user := currentUser.(models.User)

		// Convert commentID string to uint
		commentIDUint, err := strconv.ParseUint(commentID, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid comment ID"})
			return
		}

		// Check if comment exists and user owns it
		var comment models.TaskComment
		if err := db.First(&comment, commentIDUint).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Comment not found"})
			return
		}

		// Only the comment author can update it
		if comment.UserID != user.ID {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied: You can only update your own comments"})
			return
		}

		// Update the comment
		if err := db.Model(&comment).Update("comment", input.Comment).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update comment"})
			return
		}

		c.JSON(http.StatusOK, comment)
	}
}

// DeleteTaskComment deletes a task comment
func DeleteTaskComment(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		commentID := c.Param("commentId")

		// Get current user context
		currentUser, _ := c.Get("currentUser")
		user := currentUser.(models.User)

		// Convert commentID string to uint
		commentIDUint, err := strconv.ParseUint(commentID, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid comment ID"})
			return
		}

		// Check if comment exists
		var comment models.TaskComment
		if err := db.First(&comment, commentIDUint).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Comment not found"})
			return
		}

		// Only the comment author or admin can delete it
		if comment.UserID != user.ID && user.Role != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied: You can only delete your own comments"})
			return
		}

		// Delete the comment (soft delete)
		if err := db.Delete(&comment).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete comment"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Comment deleted successfully",
		})
	}
}

// GetMyTasks returns tasks assigned to the current user
func GetMyTasks(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		userIDUint, _ := strconv.ParseUint(userID.(string), 10, 32)

		// Initialize with empty slice to prevent null JSON response
		tasks := make([]models.Task, 0)
		query := db.Where("assigned_to_id = ?", userIDUint).
			Preload("Case").
			Preload("Comments.User").
			Order("created_at desc")

		// Apply additional filters
		if status := c.Query("status"); status != "" {
			query = query.Where("status = ?", status)
		}
		if caseID := c.Query("caseId"); caseID != "" {
			query = query.Where("case_id = ?", caseID)
		}

		if err := query.Find(&tasks).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve assigned tasks"})
			return
		}

		c.JSON(http.StatusOK, tasks)
	}
}
