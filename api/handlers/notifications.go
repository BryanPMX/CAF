package handlers

import (
	"net/http"
	"strconv"

	"github.com/BryanPMX/CAF/api/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// GetNotifications retrieves all notifications for the authenticated user
// Security: Only returns notifications belonging to the authenticated user
// Fix: Always returns a non-nil slice to prevent frontend crashes
func GetNotifications(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get userID from JWT context (set by middleware)
		userID, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Usuario no autenticado"})
			return
		}

		// Convert userID to uint
		userIDUint, err := strconv.ParseUint(userID.(string), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ID de usuario inválido"})
			return
		}

		// CRITICAL FIX: Initialize with empty slice to prevent null JSON response
		// This ensures the frontend always receives an array, even when empty
		notifications := make([]models.Notification, 0)

		// Query notifications for the authenticated user, ordered by created_at desc
		// Security: WHERE clause ensures user can only see their own notifications
		if err := db.Where("user_id = ?", userIDUint).
			Order("created_at DESC").
			Find(&notifications).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al obtener notificaciones"})
			return
		}

		// Convert to response format - always initialize as empty slice
		response := make([]models.NotificationResponse, 0, len(notifications))
		for _, notification := range notifications {
			response = append(response, models.NotificationResponse{
				ID:        notification.ID,
				Message:   notification.Message,
				IsRead:    notification.IsRead,
				Link:      notification.Link,
				Type:      notification.Type,
				CreatedAt: notification.CreatedAt,
			})
		}

		c.JSON(http.StatusOK, gin.H{
			"notifications": response, // This will always be [] instead of null
			"total":         len(response),
			"unread_count":  countUnreadNotifications(notifications),
		})
	}
}

// MarkNotificationsAsRead marks specified notifications as read
// Security: Only updates notifications belonging to the authenticated user
func MarkNotificationsAsRead(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get userID from JWT context
		userID, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Usuario no autenticado"})
			return
		}

		userIDUint, err := strconv.ParseUint(userID.(string), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ID de usuario inválido"})
			return
		}

		var request models.MarkNotificationsRequest
		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Datos de solicitud inválidos"})
			return
		}

		// Security: Update only notifications that belong to the authenticated user
		// This prevents users from marking other users' notifications as read
		result := db.Model(&models.Notification{}).
			Where("id IN ? AND user_id = ?", request.NotificationIDs, userIDUint).
			Update("is_read", true)

		if result.Error != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al marcar notificaciones como leídas"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Notificaciones marcadas como leídas exitosamente",
			"updated_count": result.RowsAffected,
		})
	}
}

// CreateNotification creates a new notification for a user
// This is an internal function used by other handlers
func CreateNotification(db *gorm.DB, userID uint, message string, notificationType string, link *string) error {
	notification := models.Notification{
		UserID:  userID,
		Message: message,
		Type:    notificationType,
		Link:    link,
		IsRead:  false,
	}

	return db.Create(&notification).Error
}

// countUnreadNotifications counts the number of unread notifications
func countUnreadNotifications(notifications []models.Notification) int {
	count := 0
	for _, notification := range notifications {
		if !notification.IsRead {
			count++
		}
	}
	return count
}
