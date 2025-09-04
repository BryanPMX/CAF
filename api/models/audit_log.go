package models

import (
	"time"
	"gorm.io/gorm"
)

// AuditLog represents a comprehensive audit trail for all system activities
type AuditLog struct {
	ID            uint           `json:"id" gorm:"primaryKey"`
	
	// Entity Information
	EntityType    string         `json:"entityType" gorm:"not null;index"` // "case", "appointment", "user", "task"
	EntityID      uint           `json:"entityId" gorm:"not null;index"`
	Action        string         `json:"action" gorm:"not null;index"` // "create", "update", "delete", "view", "export"
	
	// User Context
	UserID        uint           `json:"userId" gorm:"not null;index"`
	UserRole      string         `json:"userRole" gorm:"not null"`
	UserOfficeID  *uint          `json:"userOfficeId"`
	UserDepartment *string       `json:"userDepartment"`
	
	// Change Details
	OldValues     *string        `json:"oldValues" gorm:"type:jsonb"` // JSON string of previous values
	NewValues     *string        `json:"newValues" gorm:"type:jsonb"` // JSON string of new values
	ChangedFields []string       `json:"changedFields" gorm:"type:text[]"` // Array of field names that changed
	
	// Context Information
	IPAddress     string         `json:"ipAddress" gorm:"size:45"` // IPv6 compatible
	UserAgent     string         `json:"userAgent"`
	SessionID     string         `json:"sessionId"`
	
	// Metadata
	Reason        string         `json:"reason"` // User-provided reason for action
	Tags          []string       `json:"tags" gorm:"type:text[]"` // For categorization
	Severity      string         `json:"severity" gorm:"default:'info'"` // "info", "warning", "error", "critical"
	
	// Timestamps
	CreatedAt     time.Time      `json:"createdAt" gorm:"type:timestamp"`
	ExpiresAt     *time.Time     `json:"expiresAt" gorm:"type:timestamp"` // For data retention policies
	
	// Relationships
	User          User           `json:"user" gorm:"foreignKey:UserID"`
}

// BeforeCreate hook to set default values
func (al *AuditLog) BeforeCreate(tx *gorm.DB) error {
	if al.CreatedAt.IsZero() {
		al.CreatedAt = time.Now()
	}
	if al.Severity == "" {
		al.Severity = "info"
	}
	return nil
}

// TableName specifies the table name
func (AuditLog) TableName() string {
	return "audit_logs"
}

// AuditLogQuery represents query parameters for audit log searches
type AuditLogQuery struct {
	EntityType    string    `json:"entityType"`
	EntityID      *uint     `json:"entityId"`
	Action        string    `json:"action"`
	UserID        *uint     `json:"userId"`
	UserRole      string    `json:"userRole"`
	DateFrom      *time.Time `json:"dateFrom"`
	DateTo        *time.Time `json:"dateTo"`
	Severity      string    `json:"severity"`
	Tags          []string  `json:"tags"`
	Limit         int       `json:"limit" gorm:"default:100"`
	Offset        int       `json:"offset" gorm:"default:0"`
}

// AuditLogSummary represents aggregated audit log statistics
type AuditLogSummary struct {
	TotalActions     int64                  `json:"totalActions"`
	ActionsByType    map[string]int64       `json:"actionsByType"`
	ActionsByUser    map[string]int64       `json:"actionsByUser"`
	ActionsByDate    map[string]int64       `json:"actionsByDate"`
	CriticalActions  int64                  `json:"criticalActions"`
	RecentActivity   []AuditLog             `json:"recentActivity"`
}
