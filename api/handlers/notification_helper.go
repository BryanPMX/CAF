// Package handlers: notification_helper provides role-based notification helpers
// with deduplication to avoid race conditions and duplicate notifications.
package handlers

import (
	"fmt"
	"strconv"
	"sync"
	"time"

	"github.com/BryanPMX/CAF/api/models"
	"gorm.io/gorm"
)

var (
	// dedupMu guards notification creation when using dedup keys to prevent duplicate inserts
	dedupMu sync.Mutex
)

// CreateNotificationWithMeta creates a notification with optional entity context and dedup key.
// If dedupKey is non-empty, creation is guarded so the same (userID, dedupKey) is not inserted twice within 1 minute.
func CreateNotificationWithMeta(db *gorm.DB, userID uint, message, notifType string, link *string, entityType string, entityID *uint, dedupKey string) error {
	if message == "" {
		return gorm.ErrInvalidData
	}
	n := models.Notification{
		UserID:     userID,
		Message:    message,
		Type:       notifType,
		Link:       link,
		IsRead:     false,
		EntityType: entityType,
		EntityID:   entityID,
		DedupKey:   dedupKey,
	}
	if dedupKey != "" {
		dedupMu.Lock()
		defer dedupMu.Unlock()
		cutoff := time.Now().Add(-1 * time.Minute)
		var existing models.Notification
		err := db.Where("user_id = ? AND dedup_key = ? AND created_at > ?", userID, dedupKey, cutoff).First(&existing).Error
		if err == nil {
			return nil // already notified recently, skip duplicate
		}
		if err != gorm.ErrRecordNotFound {
			return err
		}
	}
	return db.Create(&n).Error
}

// GetAdminUserIDs returns all user IDs with role "admin" (active, not deleted).
func GetAdminUserIDs(db *gorm.DB) ([]uint, error) {
	var ids []uint
	err := db.Model(&models.User{}).Where("role = ? AND is_active = ?", "admin", true).Pluck("id", &ids).Error
	return ids, err
}

// NotifyAdmins creates a notification for every admin with optional dedup key to avoid duplicates.
// Link and entityType/entityID are included for rich notifications.
func NotifyAdmins(db *gorm.DB, message, notifType string, link *string, entityType string, entityID *uint, dedupKey string) {
	adminIDs, err := GetAdminUserIDs(db)
	if err != nil || len(adminIDs) == 0 {
		return
	}
	for _, id := range adminIDs {
		_ = CreateNotificationWithMeta(db, id, message, notifType, link, entityType, entityID, dedupKey)
		SendUserNotification(strconv.FormatUint(uint64(id), 10), map[string]interface{}{
			"message": message, "type": notifType, "link": link, "entityType": entityType, "entityId": entityID,
		})
	}
}

// NotifyAdminsForCase notifies admins about a case event (created, updated, deleted) with full case info in the message.
func NotifyAdminsForCase(db *gorm.DB, action string, caseID uint, title, category, status string, link *string) {
	msg := fmt.Sprintf("Caso #%d (%s) %s. Categoría: %s, Estado: %s.", caseID, title, action, category, status)
	eid := caseID
	dedup := fmt.Sprintf("case:%d:%s", caseID, action)
	NotifyAdmins(db, msg, "info", link, "case", &eid, dedup)
}

// NotifyAdminsForAppointment notifies admins about an appointment event with full appointment info.
func NotifyAdminsForAppointment(db *gorm.DB, action string, appointmentID uint, title, status string, startTime time.Time, link *string) {
	msg := fmt.Sprintf("Cita #%d '%s' %s. Estado: %s. Fecha: %s.", appointmentID, title, action, status, startTime.Format("02/01/2006 15:04"))
	eid := appointmentID
	dedup := fmt.Sprintf("appointment:%d:%s", appointmentID, action)
	NotifyAdmins(db, msg, "info", link, "appointment", &eid, dedup)
}
