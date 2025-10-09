package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/BryanPMX/CAF/api/middleware"
	"github.com/BryanPMX/CAF/api/models"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"gorm.io/gorm"
)

// PerformanceOptimizedHandler provides optimized data access with caching, pagination, and query optimization
type PerformanceOptimizedHandler struct {
	db    *gorm.DB
	redis *redis.Client
	cache *CacheManager
}

// CacheManager handles multi-level caching with TTL and invalidation
type CacheManager struct {
	memoryCache map[string]*CacheEntry
	redis       *redis.Client
	mutex       sync.RWMutex
	ttl         time.Duration
}

// CacheEntry represents a cached item with metadata
type CacheEntry struct {
	Data      interface{}
	CreatedAt time.Time
	TTL       time.Duration
}

// PaginationParams handles pagination and filtering
type PaginationParams struct {
	Page      int                    `json:"page"`
	PageSize  int                    `json:"pageSize"`
	Search    string                 `json:"search"`
	SortBy    string                 `json:"sortBy"`
	SortOrder string                 `json:"sortOrder"`
	Filters   map[string]interface{} `json:"filters"`
}

// PaginatedResponse provides standardized paginated responses
type PaginatedResponse struct {
	Data       interface{} `json:"data"`
	Pagination struct {
		Page       int   `json:"page"`
		PageSize   int   `json:"pageSize"`
		Total      int64 `json:"total"`
		TotalPages int   `json:"totalPages"`
		HasNext    bool  `json:"hasNext"`
		HasPrev    bool  `json:"hasPrev"`
	} `json:"pagination"`
	Performance struct {
		QueryTime    time.Duration `json:"queryTime"`
		CacheHit     bool          `json:"cacheHit"`
		ResponseSize int           `json:"responseSize"`
	} `json:"performance"`
}

// NewPerformanceOptimizedHandler creates a new optimized handler
func NewPerformanceOptimizedHandler(db *gorm.DB, redisClient *redis.Client) *PerformanceOptimizedHandler {
	return &PerformanceOptimizedHandler{
		db:    db,
		redis: redisClient,
		cache: &CacheManager{
			memoryCache: make(map[string]*CacheEntry),
			redis:       redisClient,
			ttl:         5 * time.Minute,
		},
	}
}

// GetOptimizedCases returns cases with advanced caching, pagination, and query optimization
func (h *PerformanceOptimizedHandler) GetOptimizedCases() gin.HandlerFunc {
	return func(c *gin.Context) {
		monitor := NewPerformanceMonitor("GetOptimizedCases")
		defer monitor.Finish()

		logger := NewLogger(c.Request.Context())
		logger.Log(LogLevelInfo, "Starting optimized cases retrieval")

		// Parse pagination parameters with validation
		params := h.parsePaginationParams(c)
		params.Page, params.PageSize, _ = ValidatePaginationParams(params.Page, params.PageSize)

		// Generate cache key
		cacheKey := h.generateCacheKey("cases", params, c)

		// Try to get from cache first
		if cached, found := h.cache.Get(cacheKey); found {
			logger.Log(LogLevelDebug, "Cache hit for cases", map[string]interface{}{
				"cacheKey": cacheKey,
			})
			h.sendCachedResponse(c, cached, time.Now(), true)
			return
		}

		// Build optimized query with access control
		query := h.buildOptimizedCasesQuery(params, c)
		query = ApplyAccessControl(query, c, "cases")

		// Execute query with performance monitoring
		var cases []models.Case
		var total int64

		// Count total for pagination with proper error handling
		if err := SafeExecute(h.db, func(db *gorm.DB) error {
			return query.Session(&gorm.Session{}).Count(&total).Error
		}, "CountCases"); err != nil {
			HandleError(c, err, "Failed to count cases", http.StatusInternalServerError)
			return
		}

		// Apply pagination and execute with proper error handling
		offset := (params.Page - 1) * params.PageSize
		if err := SafeExecute(h.db, func(db *gorm.DB) error {
			return query.Offset(offset).Limit(params.PageSize).Find(&cases).Error
		}, "RetrieveCases"); err != nil {
			HandleError(c, err, "Failed to retrieve cases", http.StatusInternalServerError)
			return
		}

		// Build response with performance metrics
		response := h.buildPaginatedResponse(cases, params, total, time.Now(), false)

		// Cache the result
		h.cache.Set(cacheKey, response, h.cache.ttl)

		logger.Log(LogLevelInfo, "Cases retrieved successfully", map[string]interface{}{
			"total":    total,
			"returned": len(cases),
			"page":     params.Page,
			"pageSize": params.PageSize,
		})

		HandleSuccess(c, response, "Cases retrieved successfully")
	}
}

// GetOptimizedAppointments returns appointments with performance optimization
func (h *PerformanceOptimizedHandler) GetOptimizedAppointments() gin.HandlerFunc {
	return func(c *gin.Context) {
		startTime := time.Now()

		params := h.parsePaginationParams(c)
		cacheKey := h.generateCacheKey("appointments", params, c)

		if cached, found := h.cache.Get(cacheKey); found {
			h.sendCachedResponse(c, cached, startTime, true)
			return
		}

		query := h.buildOptimizedAppointmentsQuery(params, c)

		// Initialize with empty slice to prevent null JSON response
		appointments := make([]models.Appointment, 0)
		var total int64

		// Count total for pagination with proper error handling
		countQuery := query.Session(&gorm.Session{})
		if err := countQuery.Count(&total).Error; err != nil {
			log.Printf("Error counting appointments: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count appointments"})
			return
		}

		// Apply pagination and execute with proper error handling
		offset := (params.Page - 1) * params.PageSize
		if err := query.Offset(offset).Limit(params.PageSize).Find(&appointments).Error; err != nil {
			log.Printf("Error retrieving appointments: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve appointments"})
			return
		}

		response := h.buildPaginatedResponse(appointments, params, total, startTime, false)
		h.cache.Set(cacheKey, response, h.cache.ttl)

		c.JSON(http.StatusOK, response)
	}
}

// GetOptimizedUsers returns users with performance optimization
func (h *PerformanceOptimizedHandler) GetOptimizedUsers() gin.HandlerFunc {
	return func(c *gin.Context) {
		startTime := time.Now()

		params := h.parsePaginationParams(c)
		cacheKey := h.generateCacheKey("users", params, c)

		if cached, found := h.cache.Get(cacheKey); found {
			h.sendCachedResponse(c, cached, startTime, true)
			return
		}

		query := h.buildOptimizedUsersQuery(params, c)

		// Initialize with empty slice to prevent null JSON response
		users := make([]models.User, 0)
		var total int64

		// Count total for pagination with proper error handling
		countQuery := query.Session(&gorm.Session{})
		if err := countQuery.Count(&total).Error; err != nil {
			log.Printf("Error counting users: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count users"})
			return
		}

		// Apply pagination and execute with proper error handling
		offset := (params.Page - 1) * params.PageSize
		if err := query.Offset(offset).Limit(params.PageSize).Find(&users).Error; err != nil {
			log.Printf("Error retrieving users: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve users"})
			return
		}

		response := h.buildPaginatedResponse(users, params, total, startTime, false)
		h.cache.Set(cacheKey, response, h.cache.ttl)

		c.JSON(http.StatusOK, response)
	}
}

// GetOptimizedCaseByID returns a single case with optimized loading
func (h *PerformanceOptimizedHandler) GetOptimizedCaseByID() gin.HandlerFunc {
	return func(c *gin.Context) {
		startTime := time.Now()
		caseID := c.Param("id")

		// Generate cache key for single case
		cacheKey := fmt.Sprintf("case:%s", caseID)

		// Try to get from cache first
		if cached, found := h.cache.Get(cacheKey); found {
			h.sendCachedResponse(c, cached, startTime, true)
			return
		}

		var caseItem models.Case
		query := h.db.Model(&models.Case{}).
			Preload("Client").
			Preload("Office").
			Preload("PrimaryStaff").
			Preload("SecondaryStaff").
			Preload("Documents").
			Preload("Appointments").
			Preload("Notes").
			Where("id = ? AND deleted_at IS NULL", caseID)

		// Apply access control
		h.applyAccessControl(query, c)

		if err := query.First(&caseItem).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "Case not found"})
				return
			}
			log.Printf("Error retrieving case: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve case"})
			return
		}

		// Cache the result with longer TTL for single items
		h.cache.Set(cacheKey, caseItem, 10*time.Minute)

		c.JSON(http.StatusOK, caseItem)
	}
}

// GetOptimizedAppointmentByID returns a single appointment with optimized loading
func (h *PerformanceOptimizedHandler) GetOptimizedAppointmentByID() gin.HandlerFunc {
	return func(c *gin.Context) {
		startTime := time.Now()
		appointmentID := c.Param("id")

		cacheKey := fmt.Sprintf("appointment:%s", appointmentID)

		if cached, found := h.cache.Get(cacheKey); found {
			h.sendCachedResponse(c, cached, startTime, true)
			return
		}

		var appointment models.Appointment
		query := h.db.Model(&models.Appointment{}).
			Preload("Staff").
			Preload("Case").
			Preload("Case.Client").
			Where("id = ? AND deleted_at IS NULL", appointmentID)

		// Apply access control
		h.applyAccessControl(query, c)

		if err := query.First(&appointment).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "Appointment not found"})
				return
			}
			log.Printf("Error retrieving appointment: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve appointment"})
			return
		}

		h.cache.Set(cacheKey, appointment, 10*time.Minute)
		c.JSON(http.StatusOK, appointment)
	}
}

// buildOptimizedCasesQuery creates an optimized query for cases
func (h *PerformanceOptimizedHandler) buildOptimizedCasesQuery(params PaginationParams, c *gin.Context) *gorm.DB {
	query := h.db.Model(&models.Case{}).
		Preload("Client", func(db *gorm.DB) *gorm.DB {
			return db.Select("id, first_name, last_name, email")
		}).
		Preload("Office", func(db *gorm.DB) *gorm.DB {
			return db.Select("id, name, address")
		}).
		Preload("PrimaryStaff", func(db *gorm.DB) *gorm.DB {
			return db.Select("id, first_name, last_name, email")
		}).
		Where("is_archived = ? AND deleted_at IS NULL", false)

	// Apply access control
	query = h.applyAccessControl(query, c)

	// Apply search with full-text search capabilities
	if params.Search != "" {
		searchTerm := "%" + params.Search + "%"
		query = query.Where(
			"title ILIKE ? OR docket_number ILIKE ? OR court ILIKE ? OR description ILIKE ?",
			searchTerm, searchTerm, searchTerm, searchTerm,
		)
	}

	// Apply filters with validation
	for key, value := range params.Filters {
		switch key {
		case "status":
			if status, ok := value.(string); ok && status != "" {
				query = query.Where("status = ?", status)
			}
		case "category":
			if category, ok := value.(string); ok && category != "" {
				query = query.Where("category = ?", category)
			}
		case "current_stage":
			if stage, ok := value.(string); ok && stage != "" {
				query = query.Where("current_stage = ?", stage)
			}
		case "office_id":
			if officeID, ok := value.(string); ok && officeID != "" {
				query = query.Where("office_id = ?", officeID)
			}
		case "priority":
			if priority, ok := value.(string); ok && priority != "" {
				query = query.Where("priority = ?", priority)
			}
		case "date_range":
			if dateRange, ok := value.(map[string]interface{}); ok {
				if from, exists := dateRange["from"]; exists && from != "" {
					query = query.Where("created_at >= ?", from)
				}
				if to, exists := dateRange["to"]; exists && to != "" {
					query = query.Where("created_at <= ?", to)
				}
			}
		}
	}

	// Apply sorting with validation
	if params.SortBy != "" {
		// Validate sort field to prevent SQL injection
		allowedSortFields := map[string]bool{
			"created_at": true, "updated_at": true, "title": true, "status": true,
			"priority": true, "current_stage": true, "docket_number": true,
		}
		if allowedSortFields[params.SortBy] {
			order := "ASC"
			if params.SortOrder == "desc" {
				order = "DESC"
			}
			query = query.Order(fmt.Sprintf("%s %s", params.SortBy, order))
		}
	} else {
		query = query.Order("created_at DESC")
	}

	return query
}

// buildOptimizedAppointmentsQuery creates an optimized query for appointments
func (h *PerformanceOptimizedHandler) buildOptimizedAppointmentsQuery(params PaginationParams, c *gin.Context) *gorm.DB {
	query := h.db.Model(&models.Appointment{}).
		Preload("Staff", func(db *gorm.DB) *gorm.DB {
			return db.Select("id, first_name, last_name, role, email")
		}).
		Preload("Case", func(db *gorm.DB) *gorm.DB {
			return db.Preload("Client", func(db *gorm.DB) *gorm.DB {
				return db.Select("id, first_name, last_name, email")
			})
		}).
		Where("deleted_at IS NULL")

	// Apply access control
	query = h.applyAccessControl(query, c)

	// Apply search
	if params.Search != "" {
		searchTerm := "%" + params.Search + "%"
		query = query.Where("title ILIKE ? OR description ILIKE ?", searchTerm, searchTerm)
	}

	// Apply filters
	for key, value := range params.Filters {
		switch key {
		case "status":
			if status, ok := value.(string); ok && status != "" {
				query = query.Where("status = ?", status)
			}
		case "department":
			if dept, ok := value.(string); ok && dept != "" {
				query = query.Where("department = ?", dept)
			}
		case "staff_id":
			if staffID, ok := value.(string); ok && staffID != "" {
				query = query.Where("staff_id = ?", staffID)
			}
		case "start_time":
			if dateRange, ok := value.(map[string]interface{}); ok {
				if from, exists := dateRange["from"]; exists && from != "" {
					query = query.Where("start_time >= ?", from)
				}
				if to, exists := dateRange["to"]; exists && to != "" {
					query = query.Where("start_time <= ?", to)
				}
			}
		case "appointment_type":
			if apptType, ok := value.(string); ok && apptType != "" {
				query = query.Where("appointment_type = ?", apptType)
			}
		}
	}

	// Apply sorting
	if params.SortBy != "" {
		allowedSortFields := map[string]bool{
			"start_time": true, "end_time": true, "title": true, "status": true,
			"created_at": true, "updated_at": true,
		}
		if allowedSortFields[params.SortBy] {
			order := "ASC"
			if params.SortOrder == "desc" {
				order = "DESC"
			}
			query = query.Order(fmt.Sprintf("%s %s", params.SortBy, order))
		}
	} else {
		query = query.Order("start_time DESC")
	}

	return query
}

// buildOptimizedUsersQuery creates an optimized query for users
func (h *PerformanceOptimizedHandler) buildOptimizedUsersQuery(params PaginationParams, c *gin.Context) *gorm.DB {
	query := h.db.Model(&models.User{}).
		Preload("Office", func(db *gorm.DB) *gorm.DB {
			return db.Select("id, name, address")
		}).
		Where("deleted_at IS NULL")

	// Apply access control
	query = h.applyAccessControl(query, c)

	// Apply search
	if params.Search != "" {
		searchTerm := "%" + params.Search + "%"
		query = query.Where(
			"first_name ILIKE ? OR last_name ILIKE ? OR email ILIKE ? OR username ILIKE ?",
			searchTerm, searchTerm, searchTerm, searchTerm,
		)
	}

	// Apply filters
	for key, value := range params.Filters {
		switch key {
		case "role":
			if role, ok := value.(string); ok && role != "" {
				query = query.Where("role = ?", role)
			}
		case "department":
			if dept, ok := value.(string); ok && dept != "" {
				query = query.Where("department = ?", dept)
			}
		case "office_id":
			if officeID, ok := value.(string); ok && officeID != "" {
				query = query.Where("office_id = ?", officeID)
			}
		case "is_active":
			if isActive, ok := value.(bool); ok {
				query = query.Where("is_active = ?", isActive)
			}
		case "status":
			if status, ok := value.(string); ok && status != "" {
				query = query.Where("status = ?", status)
			}
		}
	}

	// Apply sorting
	if params.SortBy != "" {
		allowedSortFields := map[string]bool{
			"first_name": true, "last_name": true, "email": true, "role": true,
			"created_at": true, "updated_at": true, "last_login": true,
		}
		if allowedSortFields[params.SortBy] {
			order := "ASC"
			if params.SortOrder == "desc" {
				order = "DESC"
			}
			query = query.Order(fmt.Sprintf("%s %s", params.SortBy, order))
		}
	} else {
		query = query.Order("created_at DESC")
	}

	return query
}

// applyAccessControl applies role-based access control to queries
func (h *PerformanceOptimizedHandler) applyAccessControl(query *gorm.DB, c *gin.Context) *gorm.DB {
	userRole, _ := c.Get("userRole")
	userDepartment, _ := c.Get("userDepartment")
	officeScopeID, _ := c.Get("officeScopeID")

	if userRole == "admin" {
		return query // Admins see everything
	}

	// Apply office scope restriction
	if officeScopeID != nil {
		query = query.Where("office_id = ?", officeScopeID)
	}

	// Apply department restriction
	if userDepartment != nil {
		query = query.Where("department = ?", userDepartment)
	}

	// For staff users, include items they're assigned to
	if userRoleStr, ok := userRole.(string); ok && middleware.IsStaffRole(userRoleStr) {
		userID, _ := c.Get("userID")
		if userID != nil {
			userIDStr, ok := userID.(string)
			if ok && userIDStr != "" {
				userIDUint, err := strconv.ParseUint(userIDStr, 10, 32)
				if err != nil {
					log.Printf("Invalid user ID: %s", userIDStr)
					return query
				}

				// Apply staff-specific restrictions based on entity type
				// This will be handled differently for each entity type
				// Cases: user_case_assignments table
				// Appointments: staff_id field
				// Users: no restriction needed for staff viewing users

				// For cases, include cases where user is assigned
				if strings.Contains(query.Statement.Table, "cases") {
					query = query.Where("primary_staff_id = ? OR id IN (SELECT case_id FROM user_case_assignments WHERE user_id = ?)", userIDUint, userIDUint)
				}

				// For appointments, include appointments where user is assigned staff
				if strings.Contains(query.Statement.Table, "appointments") {
					query = query.Where("staff_id = ?", userIDUint)
				}
			}
		}
	}
	
	return query
}

// parsePaginationParams extracts pagination parameters from request
func (h *PerformanceOptimizedHandler) parsePaginationParams(c *gin.Context) PaginationParams {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	search := c.Query("search")
	sortBy := c.DefaultQuery("sortBy", "created_at")
	sortOrder := c.DefaultQuery("sortOrder", "desc")

	// Validate and clamp values
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	// Validate sort order
	if sortOrder != "asc" && sortOrder != "desc" {
		sortOrder = "desc"
	}

	// Parse filters from query parameters
	filters := make(map[string]interface{})
	for key, values := range c.Request.URL.Query() {
		if key != "page" && key != "pageSize" && key != "search" && key != "sortBy" && key != "sortOrder" {
			if len(values) > 0 {
				// Handle special filter types
				if key == "date_range" && len(values) >= 2 {
					filters[key] = map[string]interface{}{
						"from": values[0],
						"to":   values[1],
					}
				} else {
					filters[key] = values[0]
				}
			}
		}
	}

	return PaginationParams{
		Page:      page,
		PageSize:  pageSize,
		Search:    search,
		SortBy:    sortBy,
		SortOrder: sortOrder,
		Filters:   filters,
	}
}

// generateCacheKey creates a unique cache key based on parameters
func (h *PerformanceOptimizedHandler) generateCacheKey(resource string, params PaginationParams, c *gin.Context) string {
	userRole, _ := c.Get("userRole")
	officeScopeID, _ := c.Get("officeScopeID")
	userID, _ := c.Get("userID")

	keyParts := []string{
		resource,
		fmt.Sprintf("page:%d", params.Page),
		fmt.Sprintf("size:%d", params.PageSize),
		fmt.Sprintf("search:%s", params.Search),
		fmt.Sprintf("sort:%s:%s", params.SortBy, params.SortOrder),
		fmt.Sprintf("role:%s", userRole),
	}

	if officeScopeID != nil {
		keyParts = append(keyParts, fmt.Sprintf("office:%v", officeScopeID))
	}

	if userID != nil {
		keyParts = append(keyParts, fmt.Sprintf("user:%v", userID))
	}

	for key, value := range params.Filters {
		keyParts = append(keyParts, fmt.Sprintf("%s:%v", key, value))
	}

	return strings.Join(keyParts, "|")
}

// buildPaginatedResponse creates a standardized paginated response
func (h *PerformanceOptimizedHandler) buildPaginatedResponse(data interface{}, params PaginationParams, total int64, startTime time.Time, cacheHit bool) PaginatedResponse {
	totalPages := int((total + int64(params.PageSize) - 1) / int64(params.PageSize))

	// Calculate response size (approximate)
	responseSize := 0
	if dataBytes, err := json.Marshal(data); err == nil {
		responseSize = len(dataBytes)
	}

	response := PaginatedResponse{
		Data: data,
		Pagination: struct {
			Page       int   `json:"page"`
			PageSize   int   `json:"pageSize"`
			Total      int64 `json:"total"`
			TotalPages int   `json:"totalPages"`
			HasNext    bool  `json:"hasNext"`
			HasPrev    bool  `json:"hasPrev"`
		}{
			Page:       params.Page,
			PageSize:   params.PageSize,
			Total:      total,
			TotalPages: totalPages,
			HasNext:    params.Page < totalPages,
			HasPrev:    params.Page > 1,
		},
		Performance: struct {
			QueryTime    time.Duration `json:"queryTime"`
			CacheHit     bool          `json:"cacheHit"`
			ResponseSize int           `json:"responseSize"`
		}{
			QueryTime:    time.Since(startTime),
			CacheHit:     cacheHit,
			ResponseSize: responseSize,
		},
	}

	return response
}

// sendCachedResponse sends a cached response with performance metrics
func (h *PerformanceOptimizedHandler) sendCachedResponse(c *gin.Context, cached interface{}, startTime time.Time, cacheHit bool) {
	response := cached.(PaginatedResponse)
	response.Performance.QueryTime = time.Since(startTime)
	response.Performance.CacheHit = cacheHit

	c.JSON(http.StatusOK, response)
}

// CacheManager methods
func (cm *CacheManager) Get(key string) (interface{}, bool) {
	// Try memory cache first
	cm.mutex.RLock()
	if entry, exists := cm.memoryCache[key]; exists {
		if time.Since(entry.CreatedAt) < entry.TTL {
			cm.mutex.RUnlock()
			return entry.Data, true
		}
		// Remove expired entry
		delete(cm.memoryCache, key)
	}
	cm.mutex.RUnlock()

	// Try Redis cache
	if cm.redis != nil {
		ctx := context.Background()
		if data, err := cm.redis.Get(ctx, key).Result(); err == nil {
			var result interface{}
			if json.Unmarshal([]byte(data), &result) == nil {
				// Also store in memory cache for faster subsequent access
				cm.mutex.Lock()
				cm.memoryCache[key] = &CacheEntry{
					Data:      result,
					CreatedAt: time.Now(),
					TTL:       cm.ttl,
				}
				cm.mutex.Unlock()
				return result, true
			}
		}
	}

	return nil, false
}

func (cm *CacheManager) Set(key string, data interface{}, ttl time.Duration) {
	// Set in memory cache
	cm.mutex.Lock()
	cm.memoryCache[key] = &CacheEntry{
		Data:      data,
		CreatedAt: time.Now(),
		TTL:       ttl,
	}
	cm.mutex.Unlock()

	// Set in Redis cache
	if cm.redis != nil {
		ctx := context.Background()
		if jsonData, err := json.Marshal(data); err == nil {
			cm.redis.Set(ctx, key, jsonData, ttl)
		}
	}
}

func (cm *CacheManager) Invalidate(pattern string) {
	// Clear memory cache entries matching pattern
	cm.mutex.Lock()
	for key := range cm.memoryCache {
		if strings.Contains(key, pattern) {
			delete(cm.memoryCache, key)
		}
	}
	cm.mutex.Unlock()

	// Clear Redis cache entries matching pattern
	if cm.redis != nil {
		ctx := context.Background()
		iter := cm.redis.Scan(ctx, 0, pattern+"*", 0).Iterator()
		for iter.Next(ctx) {
			cm.redis.Del(ctx, iter.Val())
		}
	}
}

// InvalidateByResource invalidates cache for a specific resource type
func (cm *CacheManager) InvalidateByResource(resource string) {
	cm.Invalidate(resource + ":")
}

// GetCacheStats returns cache statistics
func (cm *CacheManager) GetCacheStats() map[string]interface{} {
	cm.mutex.RLock()
	defer cm.mutex.RUnlock()

	stats := map[string]interface{}{
		"memoryEntries":  len(cm.memoryCache),
		"redisConnected": cm.redis != nil,
		"ttl":            cm.ttl.String(),
	}

	// Calculate memory usage
	totalSize := 0
	for _, entry := range cm.memoryCache {
		if dataBytes, err := json.Marshal(entry.Data); err == nil {
			totalSize += len(dataBytes)
		}
	}
	stats["memoryUsageBytes"] = totalSize

	return stats
}

// Performance monitoring methods
func (h *PerformanceOptimizedHandler) GetPerformanceMetrics() gin.HandlerFunc {
	return func(c *gin.Context) {
		metrics := map[string]interface{}{
			"cache":    h.cache.GetCacheStats(),
			"database": h.getConnectionPoolStats(),
			"system": map[string]interface{}{
				"timestamp": time.Now(),
				"uptime":    h.getUptime(),
			},
		}

		c.JSON(http.StatusOK, metrics)
	}
}

func (h *PerformanceOptimizedHandler) getConnectionPoolStats() map[string]interface{} {
	sqlDB, err := h.db.DB()
	if err != nil {
		return map[string]interface{}{"error": "Failed to get DB stats"}
	}

	stats := sqlDB.Stats()
	return map[string]interface{}{
		"maxOpenConnections": stats.MaxOpenConnections,
		"openConnections":    stats.OpenConnections,
		"inUse":              stats.InUse,
		"idle":               stats.Idle,
		"waitCount":          stats.WaitCount,
		"waitDuration":       stats.WaitDuration.String(),
		"maxIdleClosed":      stats.MaxIdleClosed,
		"maxLifetimeClosed":  stats.MaxLifetimeClosed,
	}
}

func (h *PerformanceOptimizedHandler) getUptime() time.Duration {
	// This would typically be stored in a global variable or retrieved from a service
	// For now, return a placeholder
	return time.Since(time.Now().Add(-24 * time.Hour)) // Placeholder: 24 hours
}

// HealthCheck provides a comprehensive health check endpoint
func (h *PerformanceOptimizedHandler) HealthCheck() gin.HandlerFunc {
	return func(c *gin.Context) {
		health := map[string]interface{}{
			"status":    "healthy",
			"timestamp": time.Now(),
			"version":   "1.0.0",
			"services": map[string]interface{}{
				"database": h.checkDatabaseHealth(),
				"redis":    h.checkRedisHealth(),
				"cache":    h.cache.GetCacheStats(),
			},
		}

		// Check if any service is unhealthy
		for _, status := range health["services"].(map[string]interface{}) {
			if statusMap, ok := status.(map[string]interface{}); ok {
				if statusMap["status"] == "unhealthy" {
					health["status"] = "degraded"
				}
			}
		}

		c.JSON(http.StatusOK, health)
	}
}

func (h *PerformanceOptimizedHandler) checkDatabaseHealth() map[string]interface{} {
	sqlDB, err := h.db.DB()
	if err != nil {
		return map[string]interface{}{
			"status":  "unhealthy",
			"error":   err.Error(),
			"message": "Failed to get database connection",
		}
	}

	// Test database connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := sqlDB.PingContext(ctx); err != nil {
		return map[string]interface{}{
			"status":  "unhealthy",
			"error":   err.Error(),
			"message": "Database ping failed",
		}
	}

	return map[string]interface{}{
		"status": "healthy",
		"stats":  h.getConnectionPoolStats(),
	}
}

func (h *PerformanceOptimizedHandler) checkRedisHealth() map[string]interface{} {
	if h.redis == nil {
		return map[string]interface{}{
			"status":  "unhealthy",
			"message": "Redis client not configured",
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := h.redis.Ping(ctx).Err(); err != nil {
		return map[string]interface{}{
			"status":  "unhealthy",
			"error":   err.Error(),
			"message": "Redis ping failed",
		}
	}

	return map[string]interface{}{
		"status": "healthy",
		"info":   "Redis connection established",
	}
}

// ClearCache provides an endpoint to clear all caches
func (h *PerformanceOptimizedHandler) ClearCache() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Clear memory cache
		h.cache.mutex.Lock()
		h.cache.memoryCache = make(map[string]*CacheEntry)
		h.cache.mutex.Unlock()

		// Clear Redis cache if available
		if h.cache.redis != nil {
			ctx := context.Background()
			h.cache.redis.FlushDB(ctx)
		}

		c.JSON(http.StatusOK, gin.H{
			"message":   "Cache cleared successfully",
			"timestamp": time.Now(),
		})
	}
}

// GetCacheKeys provides an endpoint to list cache keys (for debugging)
func (h *PerformanceOptimizedHandler) GetCacheKeys() gin.HandlerFunc {
	return func(c *gin.Context) {
		h.cache.mutex.RLock()
		memoryKeys := make([]string, 0, len(h.cache.memoryCache))
		for key := range h.cache.memoryCache {
			memoryKeys = append(memoryKeys, key)
		}
		h.cache.mutex.RUnlock()

		var redisKeys []string
		if h.cache.redis != nil {
			ctx := context.Background()
			iter := h.cache.redis.Scan(ctx, 0, "*", 0).Iterator()
			for iter.Next(ctx) {
				redisKeys = append(redisKeys, iter.Val())
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"memoryKeys": memoryKeys,
			"redisKeys":  redisKeys,
			"total":      len(memoryKeys) + len(redisKeys),
		})
	}
}
