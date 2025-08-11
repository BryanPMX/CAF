// api/handlers/tasks.go
package handlers

import (
	"net/http"
	"time"

	"github.com/BryanPMX/CAF/api/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// CreateTaskInput defines the structure for creating a new task.
type CreateTaskInput struct {
	Title        string     `json:"title" binding:"required"`
	AssignedToID uint       `json:"assignedToId" binding:"required"`
	DueDate      *time.Time `json:"dueDate"`
}

// CreateTask is an admin-only handler to add a new task to a specific case.
func CreateTask(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		caseID := c.Param("caseId")
		var caseRecord models.Case
		if err := db.First(&caseRecord, caseID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Case not found"})
			return
		}

		var input CreateTaskInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		var assignedUser models.User
		if err := db.First(&assignedUser, input.AssignedToID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "User to be assigned does not exist"})
			return
		}

		task := models.Task{
			CaseID:       caseRecord.ID,
			AssignedToID: input.AssignedToID,
			Title:        input.Title,
			DueDate:      input.DueDate,
			Status:       "pending",
		}

		if err := db.Create(&task).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create task"})
			return
		}

		c.JSON(http.StatusCreated, task)
	}
}

// UpdateTaskInput defines the structure for updating a task's details.
type UpdateTaskInput struct {
	Title        string     `json:"title" binding:"required"`
	AssignedToID uint       `json:"assignedToId" binding:"required"`
	DueDate      *time.Time `json:"dueDate"`
	Status       string     `json:"status" binding:"required"`
}

// UpdateTask is an admin-only handler to modify an existing task.
func UpdateTask(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		taskID := c.Param("taskId")
		var task models.Task
		if err := db.First(&task, taskID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
			return
		}

		var input UpdateTaskInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Validate status
		validStatuses := map[string]bool{"pending": true, "in_progress": true, "completed": true}
		if !validStatuses[input.Status] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid status value"})
			return
		}

		// Update fields
		task.Title = input.Title
		task.AssignedToID = input.AssignedToID
		task.DueDate = input.DueDate
		task.Status = input.Status

		db.Save(&task)
		c.JSON(http.StatusOK, task)
	}
}

// DeleteTask is an admin-only handler to remove a task (soft delete).
func DeleteTask(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		taskID := c.Param("taskId")
		var task models.Task
		if err := db.First(&task, taskID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
			return
		}

		db.Delete(&task)
		c.Status(http.StatusNoContent)
	}
}
