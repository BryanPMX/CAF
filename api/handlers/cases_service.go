// api/handlers/cases_service.go
package handlers

import (
	"fmt"
	"log"
	"strconv"
	"time"

	"github.com/BryanPMX/CAF/api/config"
	"github.com/BryanPMX/CAF/api/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// CaseService handles case-related business logic
type CaseService struct {
	db *gorm.DB
}

// NewCaseService creates a new case service
func NewCaseService(db *gorm.DB) *CaseService {
	return &CaseService{db: db}
}

// CaseQueryBuilder builds database queries for cases
type CaseQueryBuilder struct {
	query *gorm.DB
}

// NewCaseQueryBuilder creates a new query builder
func (s *CaseService) NewCaseQueryBuilder() *CaseQueryBuilder {
	return &CaseQueryBuilder{
		query: s.db.Preload("Client").Preload("Office").Preload("PrimaryStaff"),
	}
}

// ExcludeArchived excludes archived and soft-deleted cases from the query
func (qb *CaseQueryBuilder) ExcludeArchived() *CaseQueryBuilder {
	qb.query = qb.query.Where("is_archived = ? AND deleted_at IS NULL", false)
	return qb
}

// ApplyAccessControl applies access control based on user context
func (qb *CaseQueryBuilder) ApplyAccessControl(c *gin.Context) *CaseQueryBuilder {
	userRole, _ := c.Get("userRole")
	userDepartment, _ := c.Get("userDepartment")
	officeScopeID, _ := c.Get("officeScopeID")

	// Admin users see all cases
	if userRole == config.RoleAdmin {
		return qb
	}

	// Client users see only their own cases
	if userRole == "client" {
		userID, _ := c.Get("userID")
		qb.query = qb.query.Where("client_id = ?", userID)
		return qb
	}

	// Staff-like users see cases from their office and department
	if officeScopeID != nil {
		qb.query = qb.query.Where("office_id = ?", officeScopeID)
	}

	if userDepartment != nil {
		qb.query = qb.query.Where("category = ?", userDepartment)
	}

	return qb
}

// ApplyFilters applies search and filter parameters
func (qb *CaseQueryBuilder) ApplyFilters(c *gin.Context) *CaseQueryBuilder {
	// Search parameter
	if search := c.Query("search"); search != "" {
		searchTerm := "%" + search + "%"
		qb.query = qb.query.Where(
			"title ILIKE ? OR description ILIKE ? OR docket_number ILIKE ? OR court ILIKE ?",
			searchTerm, searchTerm, searchTerm, searchTerm,
		)
	}

	// Status filter
	if status := c.Query("status"); status != "" {
		qb.query = qb.query.Where("status = ?", status)
	}

	// Category filter
	if category := c.Query("category"); category != "" {
		qb.query = qb.query.Where("category = ?", category)
	}

	// Priority filter
	if priority := c.Query("priority"); priority != "" {
		qb.query = qb.query.Where("priority = ?", priority)
	}

	// Office filter
	if officeID := c.Query("officeId"); officeID != "" {
		qb.query = qb.query.Where("office_id = ?", officeID)
	}

	// Date range filters
	if dateFrom := c.Query("dateFrom"); dateFrom != "" {
		qb.query = qb.query.Where("created_at >= ?", dateFrom)
	}
	if dateTo := c.Query("dateTo"); dateTo != "" {
		qb.query = qb.query.Where("created_at <= ?", dateTo)
	}

	return qb
}

// ApplySorting applies sorting parameters
func (qb *CaseQueryBuilder) ApplySorting(c *gin.Context) *CaseQueryBuilder {
	sortBy := c.DefaultQuery("sortBy", "created_at")
	sortOrder := c.DefaultQuery("sortOrder", "desc")

	// Validate sort order
	if sortOrder != "asc" && sortOrder != "desc" {
		sortOrder = "desc"
	}

	// Validate sort field
	allowedSortFields := map[string]bool{
		"created_at":    true,
		"updated_at":    true,
		"title":         true,
		"status":        true,
		"priority":      true,
		"category":      true,
		"docket_number": true,
	}

	if !allowedSortFields[sortBy] {
		sortBy = "created_at"
	}

	qb.query = qb.query.Order(fmt.Sprintf("%s %s", sortBy, sortOrder))
	return qb
}

// ApplyPagination applies pagination parameters
func (qb *CaseQueryBuilder) ApplyPagination(c *gin.Context) *CaseQueryBuilder {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	// Validate pagination parameters
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	offset := (page - 1) * limit
	qb.query = qb.query.Offset(offset).Limit(limit)
	return qb
}

// Execute executes the query and returns results
func (qb *CaseQueryBuilder) Execute() (*gorm.DB, error) {
	return qb.query, nil
}

// GetCases retrieves cases with all filters and pagination
func (s *CaseService) GetCases(c *gin.Context) ([]models.Case, int64, error) {
	var cases []models.Case
	var total int64

	// Build and execute count query
	countQuery := s.NewCaseQueryBuilder().
		ExcludeArchived().
		ApplyAccessControl(c).
		ApplyFilters(c)

	if err := countQuery.query.Model(&models.Case{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// Build and execute main query
	query := s.NewCaseQueryBuilder().
		ExcludeArchived().
		ApplyAccessControl(c).
		ApplyFilters(c).
		ApplySorting(c).
		ApplyPagination(c)

	if err := query.query.Find(&cases).Error; err != nil {
		return nil, 0, err
	}

	return cases, total, nil
}

// GetCaseByID retrieves a single case by ID
func (s *CaseService) GetCaseByID(caseID string, light bool) (*models.Case, error) {
	var caseData models.Case

	// TEMPORARILY DISABLE CACHING TO ISOLATE STAGE BOUNCING ISSUE
	// TODO: Re-enable caching once stage bouncing is resolved
	log.Printf("GetCaseByID: Fetching case %s directly from database (cache disabled)", caseID)
	
	query := s.db.Preload("Client").Preload("Office").Preload("PrimaryStaff")

	// Add case events if not light mode
	if !light {
		query = query.Preload("CaseEvents", func(db *gorm.DB) *gorm.DB {
			return db.Order("created_at DESC").Limit(50)
		})
	}

	if err := query.First(&caseData, caseID).Error; err != nil {
		return nil, err
	}

	log.Printf("GetCaseByID: Retrieved case %s from database with stage: %s", caseID, caseData.CurrentStage)

	// TEMPORARILY DISABLED: Cache the result
	// setCache(caseID, light, &caseData)

	return &caseData, nil
}

// CreateCase creates a new case
func (s *CaseService) CreateCase(c *gin.Context) (*models.Case, error) {
	var caseData models.Case

	if err := c.ShouldBindJSON(&caseData); err != nil {
		return nil, fmt.Errorf("invalid request data: %v", err)
	}

	// Set default values
	if caseData.Status == "" {
		caseData.Status = "open"
	}
	if caseData.Priority == "" {
		caseData.Priority = "medium"
	}
	if caseData.CurrentStage == "" {
		// Set initial stage based on case category
		if caseData.Category == "Familiar" || caseData.Category == "Civil" {
			caseData.CurrentStage = "etapa_inicial"
		} else {
			caseData.CurrentStage = "intake"
		}
	}

	// Set audit fields
	userID, _ := c.Get("userID")
	userIDUint, err := strconv.ParseUint(userID.(string), 10, 32)
	if err != nil {
		return nil, fmt.Errorf("invalid user ID: %v", err)
	}
	caseData.CreatedBy = uint(userIDUint)
	caseData.UpdatedBy = &[]uint{uint(userIDUint)}[0]

	if err := s.db.Create(&caseData).Error; err != nil {
		return nil, fmt.Errorf("failed to create case: %v", err)
	}

	// Load relationships
	if err := s.db.Preload("Client").Preload("Office").Preload("PrimaryStaff").First(&caseData, caseData.ID).Error; err != nil {
		return nil, fmt.Errorf("failed to load case relationships: %v", err)
	}

	return &caseData, nil
}

// UpdateCase updates an existing case
func (s *CaseService) UpdateCase(caseID string, c *gin.Context) (*models.Case, error) {
	var caseData models.Case

	// Find existing case
	if err := s.db.First(&caseData, caseID).Error; err != nil {
		return nil, fmt.Errorf("case not found: %v", err)
	}

	// Create a map to hold the update data
	var updateData map[string]interface{}
	if err := c.ShouldBindJSON(&updateData); err != nil {
		return nil, fmt.Errorf("invalid request data: %v", err)
	}

	// Log the received update data for debugging
	log.Printf("UpdateCase: Received data for case %s: %+v", caseID, updateData)

	// Set audit fields
	userID, _ := c.Get("userID")
	userIDUint, err := strconv.ParseUint(userID.(string), 10, 32)
	if err != nil {
		return nil, fmt.Errorf("invalid user ID: %v", err)
	}
	updateData["updatedBy"] = uint(userIDUint)

	// Update only the provided fields
	if err := s.db.Model(&caseData).Updates(updateData).Error; err != nil {
		log.Printf("UpdateCase: Database update error: %v", err)
		return nil, fmt.Errorf("failed to update case: %v", err)
	}

	log.Printf("UpdateCase: Successfully updated case %s", caseID)

	// Invalidate cache
	invalidateCache(caseID)

	// Load relationships for response
	if err := s.db.Preload("Client").Preload("Office").Preload("PrimaryStaff").First(&caseData, caseData.ID).Error; err != nil {
		log.Printf("UpdateCase: Failed to load relationships: %v", err)
		return nil, fmt.Errorf("failed to load case relationships: %v", err)
	}

	log.Printf("UpdateCase: Successfully loaded case with relationships for %s", caseID)
	return &caseData, nil
}

// DeleteCase soft deletes a case
func (s *CaseService) DeleteCase(caseID string, c *gin.Context) error {
	var caseData models.Case

	// Find existing case
	if err := s.db.First(&caseData, caseID).Error; err != nil {
		return fmt.Errorf("case not found: %v", err)
	}

	// Set deletion fields
	userID, exists := c.Get("userID")
	if !exists {
		return fmt.Errorf("user ID not found in context")
	}
	userIDStr, ok := userID.(string)
	if !ok {
		return fmt.Errorf("user ID is not a string")
	}
	userIDUint, err := strconv.ParseUint(userIDStr, 10, 32)
	if err != nil {
		return fmt.Errorf("invalid user ID format: %v", err)
	}
	deletionReason := c.PostForm("reason")
	if deletionReason == "" {
		deletionReason = "Manual deletion"
	}

	now := time.Now()
	caseData.DeletedBy = &[]uint{uint(userIDUint)}[0]
	caseData.DeletionReason = deletionReason
	caseData.DeletedAt = &now

	if err := s.db.Save(&caseData).Error; err != nil {
		return fmt.Errorf("failed to delete case: %v", err)
	}

	// Invalidate cache
	invalidateCache(caseID)

	return nil
}

// GetMyCases retrieves cases assigned to the current user
func (s *CaseService) GetMyCases(c *gin.Context) ([]models.Case, int64, error) {
	userID, _ := c.Get("userID")
	userRole, _ := c.Get("userRole")

	var cases []models.Case
	var total int64

	query := s.db.Preload("Client").Preload("Office").Preload("PrimaryStaff")

	if userRole == "client" {
		// Clients see their own cases
		query = query.Where("client_id = ?", userID)
	} else {
		// Staff see cases assigned to them
		query = query.Where("primary_staff_id = ?", userID)
	}

	// Apply filters
	if search := c.Query("search"); search != "" {
		searchTerm := "%" + search + "%"
		query = query.Where("title ILIKE ? OR description ILIKE ?", searchTerm, searchTerm)
	}

	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	// Count total
	if err := query.Model(&models.Case{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// Apply pagination
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	if err := query.Offset(offset).Limit(limit).Find(&cases).Error; err != nil {
		return nil, 0, err
	}

	return cases, total, nil
}
