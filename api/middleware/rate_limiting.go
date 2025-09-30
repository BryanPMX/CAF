// api/middleware/rate_limiting.go
package middleware

import (
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// RateLimiter represents a simple in-memory rate limiter
type RateLimiter struct {
	requests map[string][]time.Time
	mutex    sync.RWMutex
	window   time.Duration
	limit    int
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter(window time.Duration, limit int) *RateLimiter {
	return &RateLimiter{
		requests: make(map[string][]time.Time),
		window:   window,
		limit:    limit,
	}
}

// Allow checks if a request is allowed for the given key
func (rl *RateLimiter) Allow(key string) bool {
	rl.mutex.Lock()
	defer rl.mutex.Unlock()

	// Use explicit UTC time for consistent rate limiting
	now := time.Now().UTC().UTC()
	cutoff := now.Add(-rl.window)

	// Get existing requests for this key
	requests, exists := rl.requests[key]
	if !exists {
		requests = []time.Time{}
	}

	// Remove old requests outside the window
	var validRequests []time.Time
	for _, reqTime := range requests {
		if reqTime.After(cutoff) {
			validRequests = append(validRequests, reqTime)
		}
	}

	// Check if we're under the limit
	if len(validRequests) >= rl.limit {
		return false
	}

	// Add current request
	validRequests = append(validRequests, now)
	rl.requests[key] = validRequests

	return true
}

// GetRemainingRequests returns the number of remaining requests for a key
func (rl *RateLimiter) GetRemainingRequests(key string) int {
	rl.mutex.RLock()
	defer rl.mutex.RUnlock()

	now := time.Now().UTC()
	cutoff := now.Add(-rl.window)

	requests, exists := rl.requests[key]
	if !exists {
		return rl.limit
	}

	// Count valid requests
	validCount := 0
	for _, reqTime := range requests {
		if reqTime.After(cutoff) {
			validCount++
		}
	}

	return rl.limit - validCount
}

// GetResetTime returns when the rate limit resets for a key
func (rl *RateLimiter) GetResetTime(key string) time.Time {
	rl.mutex.RLock()
	defer rl.mutex.RUnlock()

	now := time.Now().UTC()
	cutoff := now.Add(-rl.window)

	requests, exists := rl.requests[key]
	if !exists {
		return now.Add(rl.window)
	}

	// Find the oldest valid request
	var oldestTime time.Time
	for _, reqTime := range requests {
		if reqTime.After(cutoff) {
			if oldestTime.IsZero() || reqTime.Before(oldestTime) {
				oldestTime = reqTime
			}
		}
	}

	if oldestTime.IsZero() {
		return now.Add(rl.window)
	}

	return oldestTime.Add(rl.window)
}

// Cleanup removes old entries to prevent memory leaks
func (rl *RateLimiter) Cleanup() {
	rl.mutex.Lock()
	defer rl.mutex.Unlock()

	now := time.Now().UTC()
	cutoff := now.Add(-rl.window * 2) // Keep some buffer

	for key, requests := range rl.requests {
		var validRequests []time.Time
		for _, reqTime := range requests {
			if reqTime.After(cutoff) {
				validRequests = append(validRequests, reqTime)
			}
		}

		if len(validRequests) == 0 {
			delete(rl.requests, key)
		} else {
			rl.requests[key] = validRequests
		}
	}
}

// Global rate limiters for different endpoints - will be configured via environment
var (
	// General API rate limiter - configurable via environment
	GeneralRateLimiter *RateLimiter
	
	// Auth rate limiter - configurable via environment  
	AuthRateLimiter *RateLimiter
	
	// Contact form rate limiter - configurable via environment
	ContactRateLimiter *RateLimiter
	
	// Admin operations rate limiter - configurable via environment
	AdminRateLimiter *RateLimiter
)

// InitializeRateLimiters initializes rate limiters with configuration values
func InitializeRateLimiters(requestsPerMinute, authRequestsPerMinute, contactRequestsPerHour, adminRequestsPerMinute int) {
	GeneralRateLimiter = NewRateLimiter(time.Minute, requestsPerMinute)
	AuthRateLimiter = NewRateLimiter(time.Minute, authRequestsPerMinute)
	ContactRateLimiter = NewRateLimiter(time.Hour, contactRequestsPerHour)
	AdminRateLimiter = NewRateLimiter(time.Minute, adminRequestsPerMinute)
	
	// Start cleanup routine
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		
		for range ticker.C {
			if GeneralRateLimiter != nil {
				GeneralRateLimiter.Cleanup()
			}
			if AuthRateLimiter != nil {
				AuthRateLimiter.Cleanup()
			}
			if ContactRateLimiter != nil {
				ContactRateLimiter.Cleanup()
			}
			if AdminRateLimiter != nil {
				AdminRateLimiter.Cleanup()
			}
		}
	}()
}

// RateLimitMiddleware creates a rate limiting middleware
func RateLimitMiddleware(limiter *RateLimiter, keyFunc func(*gin.Context) string) gin.HandlerFunc {
	return func(c *gin.Context) {
		key := keyFunc(c)
		
		if !limiter.Allow(key) {
			resetTime := limiter.GetResetTime(key)
			remaining := limiter.GetRemainingRequests(key)
			
			c.Header("X-RateLimit-Limit", fmt.Sprintf("%d", limiter.limit))
			c.Header("X-RateLimit-Remaining", fmt.Sprintf("%d", remaining))
			c.Header("X-RateLimit-Reset", fmt.Sprintf("%d", resetTime.Unix()))
			
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":   "Rate limit exceeded",
				"message": "Too many requests. Please try again later.",
				"retry_after": int(time.Until(resetTime).Seconds()),
			})
			c.Abort()
			return
		}

		// Add rate limit headers
		remaining := limiter.GetRemainingRequests(key)
		resetTime := limiter.GetResetTime(key)
		
		c.Header("X-RateLimit-Limit", fmt.Sprintf("%d", limiter.limit))
		c.Header("X-RateLimit-Remaining", fmt.Sprintf("%d", remaining))
		c.Header("X-RateLimit-Reset", fmt.Sprintf("%d", resetTime.Unix()))
		
		c.Next()
	}
}

// GetClientIP extracts the client IP from the request
func GetClientIP(c *gin.Context) string {
	// Check X-Forwarded-For header first (for load balancers)
	if xff := c.GetHeader("X-Forwarded-For"); xff != "" {
		// Take the first IP if there are multiple
		if idx := len(xff); idx > 0 {
			for i, char := range xff {
				if char == ',' {
					idx = i
					break
				}
			}
			return xff[:idx]
		}
	}
	
	// Check X-Real-IP header
	if xri := c.GetHeader("X-Real-IP"); xri != "" {
		return xri
	}
	
	// Fall back to RemoteAddr
	return c.ClientIP()
}

// GetUserID extracts user ID from context (for authenticated users)
func GetUserID(c *gin.Context) string {
	if userID, exists := c.Get("userID"); exists {
		return fmt.Sprintf("user:%v", userID)
	}
	return ""
}

// Rate limiting middleware functions for different use cases

// GeneralAPIRateLimit applies general rate limiting to API endpoints
func GeneralAPIRateLimit() gin.HandlerFunc {
	return RateLimitMiddleware(GeneralRateLimiter, func(c *gin.Context) string {
		// Use user ID if authenticated, otherwise use IP
		if userID := GetUserID(c); userID != "" {
			return userID
		}
		return fmt.Sprintf("ip:%s", GetClientIP(c))
	})
}

// AuthRateLimit applies stricter rate limiting to authentication endpoints
func AuthRateLimit() gin.HandlerFunc {
	return RateLimitMiddleware(AuthRateLimiter, func(c *gin.Context) string {
		// Always use IP for auth endpoints to prevent brute force
		return fmt.Sprintf("auth:%s", GetClientIP(c))
	})
}

// ContactFormRateLimit applies rate limiting to contact form submissions
func ContactFormRateLimit() gin.HandlerFunc {
	return RateLimitMiddleware(ContactRateLimiter, func(c *gin.Context) string {
		// Use IP for contact form to prevent spam
		return fmt.Sprintf("contact:%s", GetClientIP(c))
	})
}

// AdminRateLimit applies rate limiting to admin operations
func AdminRateLimit() gin.HandlerFunc {
	return RateLimitMiddleware(AdminRateLimiter, func(c *gin.Context) string {
		// Use user ID for admin operations
		if userID := GetUserID(c); userID != "" {
			return fmt.Sprintf("admin:%s", userID)
		}
		// Fallback to IP if no user ID
		return fmt.Sprintf("admin:ip:%s", GetClientIP(c))
	})
}
