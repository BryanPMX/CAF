package handlers

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"log"
	"net/http"
	"sync"
	"time"

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
		err := db.WithContext(c.Request.Context()).Connection(func(connection *gorm.DB) error {
			// Connection supplies a non-cloning GORM handle. Give the handler a
			// cloning session so an expected lookup miss cannot poison later SQL
			// or the deferred unlock with ErrRecordNotFound.
			session := connection.Session(&gorm.Session{NewDB: true})
			var acquired bool
			if err := session.Raw("SELECT pg_try_advisory_lock(?)", userManagementLockID).Scan(&acquired).Error; err != nil {
				// The server may have acquired the lock before the result failed
				// to reach us; never pool a session whose ownership is unknown.
				discardUserMutationConnection(connection)
				return err
			}
			if !acquired {
				c.Header("Retry-After", "1")
				c.JSON(http.StatusServiceUnavailable, gin.H{"error": "User management is busy; please try again"})
				return nil
			}
			defer releaseUserMutationLock(connection)
			handler(session)(c)
			return nil
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "User management unavailable"})
		}
	}
}

func releaseUserMutationLock(connection *gorm.DB) {
	// Client cancellation must not cancel cleanup of a session-level lock.
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var released bool
	err := connection.Session(&gorm.Session{NewDB: true, Context: ctx}).
		Raw("SELECT pg_advisory_unlock(?)", userManagementLockID).Scan(&released).Error
	if err == nil && released {
		return
	}
	log.Printf("ERROR: User-management lock cleanup failed; discarding database session (error=%v, released=%v)", err, released)
	discardUserMutationConnection(connection)
}

func discardUserMutationConnection(connection *gorm.DB) {
	// A locked session must never return to the pool. Closing the underlying
	// driver connection also releases PostgreSQL's session advisory locks.
	if pinned, ok := connection.Statement.ConnPool.(*sql.Conn); ok {
		_ = pinned.Raw(func(interface{}) error { return driver.ErrBadConn })
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
	if (existing != nil && !config.CanManageAccount(actor.Role, existing.Role)) ||
		(role == config.RoleTechnicalSupport && (existing == nil || existing.Role != config.RoleTechnicalSupport)) ||
		(existing != nil && existing.Role == config.RoleTechnicalSupport && role != existing.Role) {
		c.JSON(http.StatusForbidden, gin.H{"error": "The technical support account is protected"})
		return false
	}
	if config.CanAccessAllOffices(actor.Role) {
		if config.CanAccessAllOffices(role) {
			*officeID = nil
		}
		return true
	}
	allowedRole := !config.CanAccessAllOffices(role) && (actor.Role == config.RoleAdmin || role != config.RoleAdmin)
	if !allowedRole || (actor.Role != config.RoleAdmin && actor.Role != config.RoleOfficeManager) || actor.OfficeID == nil || *actor.OfficeID == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Cannot assign this role"})
		return false
	}
	if existing != nil && (config.CanAccessAllOffices(existing.Role) || (actor.Role == config.RoleOfficeManager && existing.Role == config.RoleAdmin) || existing.OfficeID == nil || *existing.OfficeID != *actor.OfficeID) {
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
