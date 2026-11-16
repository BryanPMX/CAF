package handlers

import (
	"net/http"
	"sync"

	"github.com/BryanPMX/CAF/api/config"
	"github.com/BryanPMX/CAF/api/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const userManagementLockID int64 = 1976081601

var userMutationMu sync.Mutex

// PostgreSQL advisory locks serialize role changes across API instances, so
// concurrent demotions/deletions cannot remove the last executive director.
// Connection pins the lock and mutation to one database session.
func serializeUserMutation(db *gorm.DB, handler func(*gorm.DB) gin.HandlerFunc) gin.HandlerFunc {
	return func(c *gin.Context) {
		if db.Dialector.Name() != "postgres" {
			userMutationMu.Lock()
			defer userMutationMu.Unlock()
			handler(db)(c)
			return
		}
		err := db.Connection(func(connection *gorm.DB) error {
			if err := connection.Exec("SELECT pg_advisory_lock(?)", userManagementLockID).Error; err != nil {
				return err
			}
			defer connection.Exec("SELECT pg_advisory_unlock(?)", userManagementLockID)
			handler(connection)(c)
			return nil
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "User management unavailable"})
		}
	}
}

// officeScopedQuery never treats a missing office as organization-wide access.
// The column is supplied by application code, never by a request parameter.
func officeScopedQuery(query *gorm.DB, c *gin.Context, column string) *gorm.DB {
	role := c.GetString("userRole")
	if config.CanAccessAllOffices(role) {
		return query
	}
	if officeID, ok := c.Get("officeScopeID"); ok && officeID != nil {
		return query.Where(column+" = ?", officeID)
	}
	return query.Where("1 = 0")
}

func authorizeUserChange(c *gin.Context, existing *models.User, role string, officeID **uint) bool {
	value, _ := c.Get("currentUser")
	actor, ok := value.(models.User)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authenticated user required"})
		return false
	}
	if config.CanAccessAllOffices(actor.Role) {
		return true
	}
	allowedRole := role != config.RoleExecutiveDirector && (actor.Role == config.RoleAdmin || role != config.RoleAdmin)
	if !allowedRole || (actor.Role != config.RoleAdmin && actor.Role != config.RoleOfficeManager) || actor.OfficeID == nil || *actor.OfficeID == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Cannot assign this role"})
		return false
	}
	if existing != nil && (existing.Role == config.RoleExecutiveDirector || (actor.Role == config.RoleOfficeManager && existing.Role == config.RoleAdmin) || existing.OfficeID == nil || *existing.OfficeID != *actor.OfficeID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "User is outside your management scope"})
		return false
	}
	if *officeID == nil {
		*officeID = actor.OfficeID
	}
	if **officeID != *actor.OfficeID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Users must belong to your assigned office"})
		return false
	}
	return true
}
