package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/BryanPMX/CAF/api/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type CreateClientCaseCommentInput struct {
	Comment string `json:"comment" binding:"required,max=4000"`
}

// CreateClientComment lets an authenticated client add a message to their own case.
// Visibility is forced to client_visible so staff/admin can respond in the same timeline.
func CreateClientComment(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		currentUserRaw, exists := c.Get("currentUser")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Usuario no autenticado"})
			return
		}
		currentUser := currentUserRaw.(models.User)
		if currentUser.Role != "client" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Solo clientes pueden usar este endpoint"})
			return
		}

		caseIDStr := c.Param("id")
		caseID, err := strconv.ParseUint(caseIDStr, 10, 32)
		if err != nil || caseID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Caso inválido"})
			return
		}

		var input CreateClientCaseCommentInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		comment := strings.TrimSpace(input.Comment)
		if comment == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "El comentario no puede estar vacío"})
			return
		}

		var caseRecord models.Case
		if err := db.Select("id, title, office_id, client_id, primary_staff_id").
			Where("id = ? AND client_id = ?", uint(caseID), currentUser.ID).
			First(&caseRecord).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "Caso no encontrado"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al validar el caso"})
			return
		}

		event := models.CaseEvent{
			CaseID:      caseRecord.ID,
			UserID:      currentUser.ID,
			EventType:   "comment",
			Visibility:  "client_visible",
			CommentText: comment,
		}
		if err := db.Create(&event).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "No se pudo guardar el comentario"})
			return
		}

		invalidateCache(caseIDStr)

		notifyPortalUsersForClientCaseComment(db, caseRecord, currentUser, comment)

		if err := db.Preload("User").First(&event, event.ID).Error; err == nil {
			c.JSON(http.StatusCreated, event)
			return
		}
		c.JSON(http.StatusCreated, event)
	}
}

func notifyPortalUsersForClientCaseComment(db *gorm.DB, caseRecord models.Case, client models.User, comment string) {
	recipientSet := map[uint]struct{}{}

	if ids, err := GetAdminUserIDs(db); err == nil {
		for _, id := range ids {
			recipientSet[id] = struct{}{}
		}
	}

	if ids, err := GetOfficeManagerUserIDs(db, caseRecord.OfficeID); err == nil {
		for _, id := range ids {
			recipientSet[id] = struct{}{}
		}
	}

	if caseRecord.PrimaryStaffID != nil && *caseRecord.PrimaryStaffID != 0 {
		recipientSet[*caseRecord.PrimaryStaffID] = struct{}{}
	}

	var assignedIDs []uint
	if err := db.Model(&models.UserCaseAssignment{}).
		Where("case_id = ? AND deleted_at IS NULL", caseRecord.ID).
		Pluck("user_id", &assignedIDs).Error; err == nil {
		for _, id := range assignedIDs {
			recipientSet[id] = struct{}{}
		}
	}

	if len(recipientSet) == 0 {
		return
	}

	recipientIDs := make([]uint, 0, len(recipientSet))
	for id := range recipientSet {
		if id != 0 && id != client.ID {
			recipientIDs = append(recipientIDs, id)
		}
	}
	if len(recipientIDs) == 0 {
		return
	}

	var activeRecipientIDs []uint
	if err := db.Model(&models.User{}).
		Where("id IN ? AND role <> ? AND is_active = ? AND deleted_at IS NULL", recipientIDs, "client", true).
		Pluck("id", &activeRecipientIDs).Error; err != nil {
		return
	}
	if len(activeRecipientIDs) == 0 {
		return
	}

	clientName := strings.TrimSpace(strings.TrimSpace(client.FirstName) + " " + strings.TrimSpace(client.LastName))
	if clientName == "" {
		clientName = client.Email
	}
	preview := strings.TrimSpace(comment)
	if len(preview) > 120 {
		preview = preview[:120] + "..."
	}
	message := fmt.Sprintf("Cliente %s respondió en el caso #%d. \"%s\"", clientName, caseRecord.ID, preview)
	link := "/app/cases/" + strconv.FormatUint(uint64(caseRecord.ID), 10)
	entityID := caseRecord.ID

	for _, recipientID := range activeRecipientIDs {
		_ = CreateNotificationWithMeta(db, recipientID, message, "info", &link, "case", &entityID, "")
		SendUserNotification(strconv.FormatUint(uint64(recipientID), 10), map[string]interface{}{
			"message":    message,
			"type":       "info",
			"link":       &link,
			"entityType": "case",
			"entityId":   &entityID,
		})
	}
}
