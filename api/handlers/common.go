package handlers

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"runtime"
	"strconv"
	"time"

	"github.com/BryanPMX/CAF/api/middleware"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ErrorResponse represents a standardized error response
type ErrorResponse struct {
	Error     string            `json:"error"`
	Message   string            `json:"message"`
	Code      string            `json:"code,omitempty"`
	Timestamp time.Time         `json:"timestamp"`
	RequestID string            `json:"requestId,omitempty"`
	Details   map[string]string `json:"details,omitempty"`
}

// SuccessResponse represents a standardized success response
type SuccessResponse struct {
	Data      interface{}       `json:"data"`
	Message   string            `json:"message,omitempty"`
	Timestamp time.Time         `json:"timestamp"`
	RequestID string            `json:"requestId,omitempty"`
	Metadata  map[string]string `json:"metadata,omitempty"`
}

// LogLevel represents different logging levels
type LogLevel int

const (
	LogLevelDebug LogLevel = iota
	LogLevelInfo
	LogLevelWarning
	LogLevelError
	LogLevelCritical
)

// Logger provides structured logging functionality
type Logger struct {
	context context.Context
}

// NewLogger creates a new logger instance
func NewLogger(ctx context.Context) *Logger {
	return &Logger{context: ctx}
}

// Log logs a message with the specified level
func (l *Logger) Log(level LogLevel, message string, fields ...map[string]interface{}) {
	timestamp := time.Now().Format("2006-01-02 15:04:05")
	levelStr := l.getLevelString(level)

	// Get caller information
	_, file, line, ok := runtime.Caller(2)
	caller := "unknown"
	if ok {
		caller = fmt.Sprintf("%s:%d", file, line)
	}

	logMsg := fmt.Sprintf("[%s] [%s] [%s] %s", timestamp, levelStr, caller, message)

	// Add fields if provided
	if len(fields) > 0 {
		for key, value := range fields[0] {
			logMsg += fmt.Sprintf(" %s=%v", key, value)
		}
	}

	log.Println(logMsg)
}

// getLevelString returns the string representation of the log level
func (l *Logger) getLevelString(level LogLevel) string {
	switch level {
	case LogLevelDebug:
		return "DEBUG"
	case LogLevelInfo:
		return "INFO"
	case LogLevelWarning:
		return "WARN"
	case LogLevelError:
		return "ERROR"
	case LogLevelCritical:
		return "CRITICAL"
	default:
		return "UNKNOWN"
	}
}

// LogError logs an error with context
func (l *Logger) LogError(err error, message string, fields ...map[string]interface{}) {
	errorFields := map[string]interface{}{
		"error": err.Error(),
	}

	if len(fields) > 0 {
		for key, value := range fields[0] {
			errorFields[key] = value
		}
	}

	l.Log(LogLevelError, message, errorFields)
}

// LogPerformance logs performance metrics
func (l *Logger) LogPerformance(operation string, duration time.Duration, fields ...map[string]interface{}) {
	perfFields := map[string]interface{}{
		"operation":   operation,
		"duration":    duration.String(),
		"duration_ms": duration.Milliseconds(),
	}

	if len(fields) > 0 {
		for key, value := range fields[0] {
			perfFields[key] = value
		}
	}

	l.Log(LogLevelInfo, "Performance metric", perfFields)
}

// HandleError handles errors consistently across handlers
func HandleError(c *gin.Context, err error, message string, statusCode int) {
	logger := NewLogger(c.Request.Context())
	logger.LogError(err, message, map[string]interface{}{
		"method": c.Request.Method,
		"path":   c.Request.URL.Path,
		"status": statusCode,
	})

	response := ErrorResponse{
		Error:     err.Error(),
		Message:   message,
		Timestamp: time.Now(),
		RequestID: c.GetString("requestId"),
	}

	c.JSON(statusCode, response)
}

// HandleSuccess handles success responses consistently
func HandleSuccess(c *gin.Context, data interface{}, message string) {
	response := SuccessResponse{
		Data:      data,
		Message:   message,
		Timestamp: time.Now(),
		RequestID: c.GetString("requestId"),
	}

	c.JSON(http.StatusOK, response)
}

// ValidateDatabaseConnection validates database connectivity
func ValidateDatabaseConnection(db *gorm.DB) error {
	sqlDB, err := db.DB()
	if err != nil {
		return fmt.Errorf("failed to get database instance: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := sqlDB.PingContext(ctx); err != nil {
		return fmt.Errorf("database ping failed: %w", err)
	}

	return nil
}

// SafeExecute executes a database operation with proper error handling
func SafeExecute(db *gorm.DB, operation func(*gorm.DB) error, operationName string) error {
	start := time.Now()
	err := operation(db)
	duration := time.Since(start)

	logger := NewLogger(context.Background())

	if err != nil {
		logger.LogError(err, fmt.Sprintf("Database operation failed: %s", operationName), map[string]interface{}{
			"operation": operationName,
			"duration":  duration.String(),
		})
		return err
	}

	logger.LogPerformance(operationName, duration)
	return nil
}

// ValidatePaginationParams validates pagination parameters
func ValidatePaginationParams(page, pageSize int) (int, int, error) {
	if page < 1 {
		page = 1
	}

	if pageSize < 1 {
		pageSize = 20
	}

	if pageSize > 100 {
		pageSize = 100
	}

	return page, pageSize, nil
}

// GetUserContext extracts user context from gin context
func GetUserContext(c *gin.Context) (userID string, userRole string, officeID string, department string) {
	if val, exists := c.Get("userID"); exists {
		if id, ok := val.(string); ok {
			userID = id
		}
	}

	if val, exists := c.Get("userRole"); exists {
		if role, ok := val.(string); ok {
			userRole = role
		}
	}

	if val, exists := c.Get("officeScopeID"); exists {
		if id, ok := val.(uint); ok {
			officeID = fmt.Sprintf("%d", id)
		}
	}

	if val, exists := c.Get("userDepartment"); exists {
		if dept, ok := val.(string); ok {
			department = dept
		}
	}

	return userID, userRole, officeID, department
}

// ApplyAccessControl applies role-based access control to queries
func ApplyAccessControl(query *gorm.DB, c *gin.Context, entityType string) *gorm.DB {
	userID, userRole, officeID, department := GetUserContext(c)

	logger := NewLogger(c.Request.Context())
	logger.Log(LogLevelDebug, "Applying access control", map[string]interface{}{
		"userID":     userID,
		"userRole":   userRole,
		"officeID":   officeID,
		"department": department,
		"entityType": entityType,
	})

	// Admins see everything
	if userRole == "admin" {
		return query
	}

	// Apply office scope restriction
	if officeID != "" {
		query = query.Where("office_id = ?", officeID)
	}

	// Apply department restriction
	if department != "" {
		query = query.Where("department = ?", department)
	}

	// For staff users, include items they're assigned to
	if middleware.IsStaffRole(userRole) && userID != "" {
		userIDUint, err := strconv.ParseUint(userID, 10, 32)
		if err != nil {
			logger.LogError(err, "Invalid user ID in access control", map[string]interface{}{
				"userID": userID,
			})
			return query
		}

		switch entityType {
		case "cases":
			query = query.Where("primary_staff_id = ? OR id IN (SELECT case_id FROM user_case_assignments WHERE user_id = ?)", userIDUint, userIDUint)
		case "appointments":
			query = query.Where("staff_id = ?", userIDUint)
		case "users":
			// Staff can view users in their office
			if officeID != "" {
				query = query.Where("office_id = ?", officeID)
			}
		}
	}

	return query
}

// PerformanceMonitor monitors query performance
type PerformanceMonitor struct {
	startTime time.Time
	operation string
	logger    *Logger
}

// NewPerformanceMonitor creates a new performance monitor
func NewPerformanceMonitor(operation string) *PerformanceMonitor {
	return &PerformanceMonitor{
		startTime: time.Now(),
		operation: operation,
		logger:    NewLogger(context.Background()),
	}
}

// Finish logs the performance metrics
func (pm *PerformanceMonitor) Finish() {
	duration := time.Since(pm.startTime)
	pm.logger.LogPerformance(pm.operation, duration)
}

// FinishWithError logs the performance metrics with error information
func (pm *PerformanceMonitor) FinishWithError(err error) {
	duration := time.Since(pm.startTime)
	pm.logger.LogError(err, fmt.Sprintf("Operation failed: %s", pm.operation), map[string]interface{}{
		"duration": duration.String(),
	})
}
