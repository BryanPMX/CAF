package handlers

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/BryanPMX/CAF/api/config"
	"github.com/BryanPMX/CAF/api/models"
	"github.com/gin-gonic/gin"
	"github.com/mattn/go-sqlite3"
	"gorm.io/gorm"
)

// Exercise the PostgreSQL serialization branch with a real pinned SQL
// connection. SQLite functions stand in only for the advisory lock operations;
// the GORM query cloning/error behavior is the actual production implementation.
type lockTestDialect struct{ gorm.Dialector }

func (lockTestDialect) Name() string { return "postgres" }

type lockTestState struct {
	acquired, released             int
	busy, failRelease, failAcquire bool
}

func userLockDatabase(t *testing.T) (*gorm.DB, *lockTestState, *sql.DB) {
	t.Helper()
	db := authorizationDatabase(t)
	pool, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	pool.SetMaxOpenConns(1)
	connection, err := pool.Conn(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	state := &lockTestState{}
	err = connection.Raw(func(raw interface{}) error {
		sqliteConnection := raw.(*sqlite3.SQLiteConn)
		acquire := func(key int64) (bool, error) {
			if key != userManagementLockID {
				t.Errorf("unexpected advisory lock key %d", key)
			}
			if state.busy {
				return false, nil
			}
			if state.failAcquire {
				return false, errors.New("simulated acquire failure")
			}
			state.acquired++
			return true, nil
		}
		for _, name := range []string{"pg_advisory_lock", "pg_try_advisory_lock"} {
			if err := sqliteConnection.RegisterFunc(name, acquire, false); err != nil {
				return err
			}
		}
		return sqliteConnection.RegisterFunc("pg_advisory_unlock", func(key int64) (bool, error) {
			if state.failRelease {
				return false, errors.New("simulated unlock failure")
			}
			state.released++
			return true, nil
		}, false)
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := connection.Close(); err != nil {
		t.Fatal(err)
	}
	isolated := db.Session(&gorm.Session{NewDB: true})
	isolated.Config.Dialector = lockTestDialect{Dialector: db.Dialector}
	return isolated, state, pool
}

func TestUserMutationLookupMissDoesNotPoisonInsertOrUnlock(t *testing.T) {
	db, state, _ := userLockDatabase(t)
	gin.SetMode(gin.TestMode)
	for _, email := range []string{"first@example.test", "second@example.test"} {
		response := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(response)
		c.Request = httptest.NewRequest(http.MethodPost, "/users", strings.NewReader(`{"firstName":"Local","lastName":"Client","role":"client","email":"`+email+`","phone":"1234567890","password":"Synthetic-E2E-Password123!"}`))
		c.Request.Header.Set("Content-Type", "application/json")
		c.Set("currentUser", models.User{ID: 1, Role: config.RoleExecutiveDirector})
		CreateUser(db)(c)
		if response.Code != http.StatusCreated {
			t.Errorf("create %s: %d %s", email, response.Code, response.Body.String())
		}
	}
	if state.acquired != 2 || state.released != 2 {
		t.Fatalf("acquired %d, released %d", state.acquired, state.released)
	}
}

func TestBusyUserMutationLockReturnsRetryableResponse(t *testing.T) {
	db, state, _ := userLockDatabase(t)
	state.busy = true
	response := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(response)
	c.Request = httptest.NewRequest(http.MethodPost, "/users", nil)
	called := false
	serializeUserMutation(db, func(*gorm.DB) gin.HandlerFunc {
		return func(c *gin.Context) { called = true; c.Status(http.StatusOK) }
	})(c)
	if called || response.Code != http.StatusServiceUnavailable || response.Header().Get("Retry-After") == "" {
		t.Fatalf("busy lock: handler=%v status=%d retry=%q", called, response.Code, response.Header().Get("Retry-After"))
	}
	if state.released != 0 {
		t.Fatal("attempted to release another session's lock")
	}
}

func TestUserMutationReleasesLockAfterRequestCancellation(t *testing.T) {
	db, state, _ := userLockDatabase(t)
	response := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(response)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	c.Request = httptest.NewRequest(http.MethodPost, "/users", nil).WithContext(ctx)
	serializeUserMutation(db, func(*gorm.DB) gin.HandlerFunc {
		return func(c *gin.Context) { cancel(); c.Status(http.StatusBadRequest) }
	})(c)
	if state.acquired != 1 || state.released != 1 {
		t.Fatalf("cancelled request acquired %d, released %d", state.acquired, state.released)
	}
}

func TestUserMutationDiscardsConnectionWhenUnlockFails(t *testing.T) {
	db, state, pool := userLockDatabase(t)
	state.failRelease = true
	response := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(response)
	c.Request = httptest.NewRequest(http.MethodPost, "/users", nil)
	serializeUserMutation(db, func(*gorm.DB) gin.HandlerFunc {
		return func(c *gin.Context) { c.Status(http.StatusOK) }
	})(c)
	if pool.Stats().OpenConnections != 0 {
		t.Fatal("returned a potentially locked session to the connection pool")
	}
}

func TestUserMutationGeneratedEmailStopsOnLookupError(t *testing.T) {
	db, state, _ := userLockDatabase(t)
	lookups := 0
	if err := db.Callback().Query().Before("gorm:query").Register("test:email_lookup_failure", func(tx *gorm.DB) {
		lookups++
		if lookups > 1 {
			panic("employee email generation retried a database failure")
		}
		tx.AddError(errors.New("simulated email lookup failure"))
	}); err != nil {
		t.Fatal(err)
	}
	response := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(response)
	c.Request = httptest.NewRequest(http.MethodPost, "/users", strings.NewReader(`{"firstName":"Local","lastName":"Employee","role":"lawyer","officeId":1,"phone":"1234567890","password":"Synthetic-E2E-Password123!"}`))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("currentUser", models.User{ID: 1, Role: config.RoleExecutiveDirector})
	CreateUser(db)(c)
	if response.Code != http.StatusInternalServerError || lookups != 1 {
		t.Fatalf("failed email lookup: status=%d attempts=%d", response.Code, lookups)
	}
	if state.acquired != 1 || state.released != 1 {
		t.Fatalf("lookup failure acquired %d, released %d", state.acquired, state.released)
	}
}

func TestUserMutationDiscardsConnectionWhenAcquisitionFails(t *testing.T) {
	db, state, pool := userLockDatabase(t)
	state.failAcquire = true
	response := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(response)
	c.Request = httptest.NewRequest(http.MethodPost, "/users", nil)
	called := false
	serializeUserMutation(db, func(*gorm.DB) gin.HandlerFunc {
		return func(c *gin.Context) { called = true; c.Status(http.StatusOK) }
	})(c)
	if called || response.Code != http.StatusInternalServerError {
		t.Fatalf("failed acquisition: called=%v status=%d", called, response.Code)
	}
	if pool.Stats().OpenConnections != 0 {
		t.Fatal("pooled a session with uncertain lock ownership")
	}
}
