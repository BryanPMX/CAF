package services

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"github.com/BryanPMX/CAF/api/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// SessionService handles all session-related operations
type SessionService struct {
	db     *gorm.DB
	config models.SessionConfig
}

// NewSessionService creates a new session service instance
func NewSessionService(db *gorm.DB, config models.SessionConfig) *SessionService {
	return &SessionService{
		db:     db,
		config: config,
	}
}

// CreateSession creates a new session for a user
func (s *SessionService) CreateSession(userID uint, token string, c *gin.Context) (*models.Session, error) {
	// Check if user has reached maximum concurrent sessions
	activeSessions, err := s.GetActiveSessions(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to check active sessions: %w", err)
	}

	if len(activeSessions) >= s.config.MaxConcurrentSessions {
		// Remove oldest session to make room
		oldestSession := activeSessions[0]
		if err := s.db.Delete(&oldestSession).Error; err != nil {
			return nil, fmt.Errorf("failed to remove oldest session: %w", err)
		}
	}

	// Extract device information
	deviceInfo := s.extractDeviceInfo(c)
	ipAddress := s.extractIPAddress(c)
	userAgent := c.GetHeader("User-Agent")

	// Hash the token for storage (we don't store the actual token)
	tokenHash := s.HashToken(token)

	// Create new session with explicit UTC time to prevent timezone issues
	now := time.Now().UTC()
	session := &models.Session{
		UserID:       userID,
		TokenHash:    tokenHash,
		DeviceInfo:   deviceInfo,
		IPAddress:    ipAddress,
		UserAgent:    userAgent,
		LastActivity: now,
		ExpiresAt:    now.Add(s.config.SessionTimeout),
		IsActive:     true,
	}

	if err := s.db.Create(session).Error; err != nil {
		return nil, fmt.Errorf("failed to create session: %w", err)
	}

	return session, nil
}

// ValidateSession checks if a session is valid and updates last activity
func (s *SessionService) ValidateSession(tokenHash string) (*models.Session, error) {
	var session models.Session

	// Use explicit UTC time for consistent comparison to prevent timezone issues
	now := time.Now().UTC()
	if err := s.db.Where("token_hash = ? AND is_active = ? AND expires_at > ?",
		tokenHash, true, now).First(&session).Error; err != nil {
		return nil, fmt.Errorf("session not found or expired: %w", err)
	}

	// Check inactivity timeout
	// Only check inactivity if the session has been active for more than the timeout period
	if time.Since(session.LastActivity) > s.config.InactivityTimeout {
		// Mark session as inactive
		session.IsActive = false
		s.db.Save(&session)
		return nil, fmt.Errorf("session expired due to inactivity")
	}

	// Update last activity with explicit UTC time to prevent timezone issues
	session.LastActivity = now
	if err := s.db.Save(&session).Error; err != nil {
		return nil, fmt.Errorf("failed to update session activity: %w", err)
	}

	return &session, nil
}

// GetActiveSessions returns all active sessions for a user
func (s *SessionService) GetActiveSessions(userID uint) ([]models.Session, error) {
	var sessions []models.Session = make([]models.Session, 0)

	if err := s.db.Where("user_id = ? AND is_active = ? AND expires_at > ?",
		userID, true, time.Now()).Order("last_activity ASC").Find(&sessions).Error; err != nil {
		return nil, err
	}

	return sessions, nil
}

// RevokeSession marks a specific session as inactive
func (s *SessionService) RevokeSession(sessionID uint, userID uint) error {
	result := s.db.Model(&models.Session{}).
		Where("id = ? AND user_id = ?", sessionID, userID).
		Update("is_active", false)

	if result.Error != nil {
		return fmt.Errorf("failed to revoke session: %w", result.Error)
	}

	if result.RowsAffected == 0 {
		return fmt.Errorf("session not found or access denied")
	}

	return nil
}

// RevokeAllUserSessions marks all sessions for a user as inactive
func (s *SessionService) RevokeAllUserSessions(userID uint) error {
	if err := s.db.Model(&models.Session{}).
		Where("user_id = ?", userID).
		Update("is_active", false).Error; err != nil {
		return fmt.Errorf("failed to revoke user sessions: %w", err)
	}

	return nil
}

// CleanupExpiredSessions removes expired sessions from the database
func (s *SessionService) CleanupExpiredSessions() error {
	// Use explicit UTC time for consistent cleanup
	now := time.Now().UTC()
	if err := s.db.Where("expires_at < ? OR (is_active = ? AND last_activity < ?)",
		now, true, now.Add(-s.config.InactivityTimeout)).
		Delete(&models.Session{}).Error; err != nil {
		return fmt.Errorf("failed to cleanup expired sessions: %w", err)
	}

	return nil
}

// HashToken creates a SHA256 hash of the JWT token
func (s *SessionService) HashToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}

// extractDeviceInfo extracts device information from the request
func (s *SessionService) extractDeviceInfo(c *gin.Context) string {
	// This is a simplified version - you could use a library like github.com/mssola/user_agent
	// for more sophisticated device detection
	userAgent := c.GetHeader("User-Agent")

	if strings.Contains(userAgent, "Mobile") {
		return "Mobile Device"
	} else if strings.Contains(userAgent, "Tablet") {
		return "Tablet"
	} else if strings.Contains(userAgent, "Windows") {
		return "Windows Desktop"
	} else if strings.Contains(userAgent, "Mac") {
		return "Mac Desktop"
	} else if strings.Contains(userAgent, "Linux") {
		return "Linux Desktop"
	}

	return "Unknown Device"
}

// extractIPAddress extracts the real IP address from the request
func (s *SessionService) extractIPAddress(c *gin.Context) string {
	// Check for forwarded headers (common in proxy setups)
	if ip := c.GetHeader("X-Forwarded-For"); ip != "" {
		// X-Forwarded-For can contain multiple IPs, take the first one
		if commaIndex := strings.Index(ip, ","); commaIndex != -1 {
			return strings.TrimSpace(ip[:commaIndex])
		}
		return strings.TrimSpace(ip)
	}

	if ip := c.GetHeader("X-Real-IP"); ip != "" {
		return ip
	}

	// Fallback to remote address
	return c.ClientIP()
}
