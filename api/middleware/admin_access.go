package middleware

import (
	"net/http"
	"strings"

	"github.com/BryanPMX/CAF/api/config"
	"github.com/BryanPMX/CAF/api/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// AdminOfficeAccess protects the administrative API's legacy routes, including
// archive operations that deliberately load soft-deleted records. List queries
// and mutation payloads must also apply their own scope restrictions.
func AdminOfficeAccess(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		value, _ := c.Get("currentUser")
		actor, ok := value.(models.User)
		if !ok {
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}
		if config.CanAccessAllOffices(actor.Role) {
			c.Next()
			return
		}
		if actor.Role != config.RoleAdmin || actor.OfficeID == nil || *actor.OfficeID == 0 {
			c.AbortWithStatus(http.StatusForbidden)
			return
		}
		path := strings.TrimPrefix(c.FullPath(), "/api/v1/admin/")
		parts := strings.Split(path, "/")
		var query *gorm.DB
		switch parts[0] {
		case "users", "clients":
			id := c.Param("id")
			if parts[0] == "clients" {
				id = c.Param("clientId")
			}
			if id != "" {
				query = db.Unscoped().Model(&models.User{}).Where("id = ? AND office_id = ? AND role <> ?", id, *actor.OfficeID, config.RoleExecutiveDirector)
			}
		case "offices":
			if c.Request.Method == http.MethodPost || c.Request.Method == http.MethodDelete {
				c.AbortWithStatus(http.StatusForbidden)
				return
			}
			if id := c.Param("id"); id != "" {
				query = db.Model(&models.Office{}).Where("id = ? AND id = ?", id, *actor.OfficeID)
			}
		case "cases", "appointments", "tasks", "records", "documents":
			resource := parts[0]
			if resource == "records" && len(parts) > 1 {
				resource = parts[1]
			}
			id := c.Param("id")
			if c.Param("eventId") != "" {
				query = db.Unscoped().Model(&models.CaseEvent{}).Where("id = ? AND case_id IN (SELECT id FROM cases WHERE office_id = ?)", c.Param("eventId"), *actor.OfficeID)
			} else if id != "" {
				switch resource {
				case "cases":
					query = db.Unscoped().Model(&models.Case{}).Where("id = ? AND office_id = ?", id, *actor.OfficeID)
				case "appointments":
					query = db.Unscoped().Model(&models.Appointment{}).Where("id = ? AND office_id = ?", id, *actor.OfficeID)
				case "tasks":
					query = db.Unscoped().Model(&models.Task{}).Where("id = ? AND case_id IN (SELECT id FROM cases WHERE office_id = ?)", id, *actor.OfficeID)
				}
			} else if path == "appointments/fix-categories" {
				c.AbortWithStatus(http.StatusForbidden)
				return
			}
		case "optimized":
			if len(parts) != 2 || (parts[1] != "cases" && parts[1] != "appointments" && parts[1] != "users") {
				c.AbortWithStatus(http.StatusForbidden)
				return
			}
		case "reports", "dashboard-summary":
			// Queries use the officeScopeID established by DataAccessControl.
		default:
			// Website, organization announcements, exports, and system operations
			// are reserved to the executive director.
			c.AbortWithStatus(http.StatusForbidden)
			return
		}
		if query != nil {
			var count int64
			if err := query.Count(&count).Error; err != nil {
				c.AbortWithStatus(http.StatusInternalServerError)
				return
			}
			if count == 0 {
				c.AbortWithStatus(http.StatusForbidden)
				return
			}
		}
		c.Next()
	}
}
