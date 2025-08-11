// api/handlers/case_events.go
package handlers

import (
	"net/http"
	"strconv"

	"github.com/BryanPMX/CAF/api/models"
	"github.com/BryanPMX/CAF/api/utils/storage"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// CreateCommentInput defines the structure for adding a comment.
type CreateCommentInput struct {
	Comment    string `json:"comment" binding:"required"`
	Visibility string `json:"visibility" binding:"required"` // "internal" or "client_visible"
}

// CreateComment is an admin-only handler to add a comment to a case.
func CreateComment(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		caseIDStr := c.Param("caseId")
		caseID, _ := strconv.ParseUint(caseIDStr, 10, 32)
		userID, _ := c.Get("userID")
		userIDUint, _ := strconv.ParseUint(userID.(string), 10, 32)

		var input CreateCommentInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		event := models.CaseEvent{
			CaseID:      uint(caseID),
			UserID:      uint(userIDUint),
			EventType:   "comment",
			Visibility:  input.Visibility,
			CommentText: input.Comment,
		}

		if err := db.Create(&event).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create comment"})
			return
		}

		c.JSON(http.StatusCreated, event)
	}
}

// UploadDocument is an admin-only handler to upload a file to a case.
func UploadDocument(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		caseIDStr := c.Param("caseId")
		caseID, _ := strconv.ParseUint(caseIDStr, 10, 32)
		userID, _ := c.Get("userID")
		userIDUint, _ := strconv.ParseUint(userID.(string), 10, 32)

		file, err := c.FormFile("file")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "File is required"})
			return
		}

		visibility := c.PostForm("visibility")
		if visibility == "" {
			visibility = "internal" // Default to internal
		}

		// Upload file to S3
		fileURL, err := storage.UploadFile(file, caseIDStr)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Create CaseEvent record in the database
		event := models.CaseEvent{
			CaseID:     uint(caseID),
			UserID:     uint(userIDUint),
			EventType:  "file_upload",
			Visibility: visibility,
			FileName:   file.Filename,
			FileUrl:    fileURL,
			FileType:   file.Header.Get("Content-Type"),
		}

		if err := db.Create(&event).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file record"})
			return
		}

		c.JSON(http.StatusCreated, event)
	}
}
