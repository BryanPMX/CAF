// api/handlers/cache.go
package handlers

import (
	"fmt"
	"sync"
	"time"

	"github.com/BryanPMX/CAF/api/models"
)

// CaseCacheEntry represents a cached case item with expiration
type CaseCacheEntry struct {
	Data      interface{}
	ExpiresAt time.Time
}

// CaseCache provides in-memory caching for cases
type CaseCache struct {
	data  map[string]*CaseCacheEntry
	mutex sync.RWMutex
	ttl   time.Duration
}

// Global cache instance
var caseCache = &CaseCache{
	data:  make(map[string]*CaseCacheEntry),
	mutex: sync.RWMutex{},
	ttl:   5 * time.Minute, // 5 minute TTL
}

// generateCacheKey creates a cache key for a case
func generateCacheKey(caseID string, light bool) string {
	if light {
		return fmt.Sprintf("case:%s:light", caseID)
	}
	return fmt.Sprintf("case:%s:full", caseID)
}

// getFromCache retrieves a case from cache
func getFromCache(caseID string, light bool) (*models.Case, bool) {
	caseCache.mutex.RLock()
	defer caseCache.mutex.RUnlock()

	key := generateCacheKey(caseID, light)
	entry, exists := caseCache.data[key]

	if !exists {
		return nil, false
	}

	// Check if expired
	if time.Now().After(entry.ExpiresAt) {
		// Clean up expired entry
		delete(caseCache.data, key)
		return nil, false
	}

	// Type assert and return
	if caseData, ok := entry.Data.(*models.Case); ok {
		return caseData, true
	}

	return nil, false
}

// setCache stores a case in cache
func setCache(caseID string, light bool, caseData *models.Case) {
	caseCache.mutex.Lock()
	defer caseCache.mutex.Unlock()

	key := generateCacheKey(caseID, light)
	caseCache.data[key] = &CaseCacheEntry{
		Data:      caseData,
		ExpiresAt: time.Now().Add(caseCache.ttl),
	}
}

// invalidateCache removes a case from cache
func invalidateCache(caseID string) {
	caseCache.mutex.Lock()
	defer caseCache.mutex.Unlock()

	// Remove both light and full versions
	lightKey := generateCacheKey(caseID, true)
	fullKey := generateCacheKey(caseID, false)

	delete(caseCache.data, lightKey)
	delete(caseCache.data, fullKey)
}

// clearExpiredCache removes expired entries from cache
func clearExpiredCache() {
	caseCache.mutex.Lock()
	defer caseCache.mutex.Unlock()

	now := time.Now()
	for key, entry := range caseCache.data {
		if now.After(entry.ExpiresAt) {
			delete(caseCache.data, key)
		}
	}
}

// GetCacheStats returns cache statistics
func GetCacheStats() map[string]interface{} {
	caseCache.mutex.RLock()
	defer caseCache.mutex.RUnlock()

	return map[string]interface{}{
		"entries": len(caseCache.data),
		"ttl":     caseCache.ttl.String(),
	}
}

// init starts a background goroutine to clean expired cache entries
func init() {
	go func() {
		ticker := time.NewTicker(10 * time.Minute)
		defer ticker.Stop()

		for range ticker.C {
			clearExpiredCache()
		}
	}()
}
