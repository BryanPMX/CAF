package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/BryanPMX/CAF/api/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// GetClientCaseByID returns a client-safe case detail payload for the authenticated client.
// It enforces ownership and filters timeline events to client-visible items only.
func GetClientCaseByID(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		caseID := c.Param("id")
		if caseID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Case ID is required"})
			return
		}

		userIDRaw, ok := c.Get("userID")
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
			return
		}

		userID, err := strconv.ParseUint(userIDRaw.(string), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
			return
		}

		var caseData models.Case
		query := db.
			Preload("Office").
			Preload("PrimaryStaff").
			Preload("Appointments", func(tx *gorm.DB) *gorm.DB {
				return tx.Order("start_time DESC")
			}).
			Preload("Appointments.Staff").
			Preload("Appointments.Office").
			Preload("CaseEvents", func(tx *gorm.DB) *gorm.DB {
				return tx.Where("visibility = ?", "client_visible").Order("created_at DESC").Limit(100)
			}).
			Preload("CaseEvents.User")

		if err := query.Where("id = ? AND client_id = ?", caseID, uint(userID)).First(&caseData).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "Case not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve case"})
			return
		}

		if caseData.Appointments == nil {
			caseData.Appointments = []models.Appointment{}
		}
		if caseData.CaseEvents == nil {
			caseData.CaseEvents = []models.CaseEvent{}
		}

		c.JSON(http.StatusOK, caseData)
	}
}

// GetClientAppointments returns appointments for the authenticated client.
// It joins through cases to guarantee ownership.
func GetClientAppointments(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDRaw, ok := c.Get("userID")
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
			return
		}

		userID, err := strconv.ParseUint(userIDRaw.(string), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
			return
		}

		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
		if page < 1 {
			page = 1
		}
		if pageSize < 1 || pageSize > 100 {
			pageSize = 20
		}
		offset := (page - 1) * pageSize

		baseQuery := db.Model(&models.Appointment{}).
			Joins("INNER JOIN cases ON cases.id = appointments.case_id").
			Where("cases.client_id = ?", uint(userID))

		if status := c.Query("status"); status != "" {
			baseQuery = baseQuery.Where("appointments.status = ?", status)
		}
		if category := c.Query("category"); category != "" {
			baseQuery = baseQuery.Where("appointments.category = ?", category)
		}

		if date := c.Query("date"); date != "" {
			if parsedDate, err := time.Parse("2006-01-02", date); err == nil {
				nextDay := parsedDate.Add(24 * time.Hour)
				baseQuery = baseQuery.Where("appointments.start_time >= ? AND appointments.start_time < ?", parsedDate, nextDay)
			}
		} else if dateFrom := c.Query("dateFrom"); dateFrom != "" {
			if parsedDateFrom, err := time.Parse("2006-01-02", dateFrom); err == nil {
				if dateTo := c.Query("dateTo"); dateTo != "" {
					if parsedDateTo, err := time.Parse("2006-01-02", dateTo); err == nil {
						baseQuery = baseQuery.Where(
							"appointments.start_time >= ? AND appointments.start_time < ?",
							parsedDateFrom,
							parsedDateTo.Add(24*time.Hour),
						)
					}
				} else {
					baseQuery = baseQuery.Where("appointments.start_time >= ?", parsedDateFrom)
				}
			}
		}

		var total int64
		if err := baseQuery.Count(&total).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count appointments"})
			return
		}

		appointments := make([]models.Appointment, 0)
		query := db.
			Preload("Staff").
			Preload("Office").
			Preload("Case", func(tx *gorm.DB) *gorm.DB {
				return tx.Preload("Office")
			}).
			Joins("INNER JOIN cases ON cases.id = appointments.case_id").
			Where("cases.client_id = ?", uint(userID)).
			Order("appointments.start_time DESC").
			Offset(offset).
			Limit(pageSize)

		if status := c.Query("status"); status != "" {
			query = query.Where("appointments.status = ?", status)
		}
		if category := c.Query("category"); category != "" {
			query = query.Where("appointments.category = ?", category)
		}
		if date := c.Query("date"); date != "" {
			if parsedDate, err := time.Parse("2006-01-02", date); err == nil {
				nextDay := parsedDate.Add(24 * time.Hour)
				query = query.Where("appointments.start_time >= ? AND appointments.start_time < ?", parsedDate, nextDay)
			}
		} else if dateFrom := c.Query("dateFrom"); dateFrom != "" {
			if parsedDateFrom, err := time.Parse("2006-01-02", dateFrom); err == nil {
				if dateTo := c.Query("dateTo"); dateTo != "" {
					if parsedDateTo, err := time.Parse("2006-01-02", dateTo); err == nil {
						query = query.Where(
							"appointments.start_time >= ? AND appointments.start_time < ?",
							parsedDateFrom,
							parsedDateTo.Add(24*time.Hour),
						)
					}
				} else {
					query = query.Where("appointments.start_time >= ?", parsedDateFrom)
				}
			}
		}

		if err := query.Find(&appointments).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve appointments"})
			return
		}

		totalPages := (total + int64(pageSize) - 1) / int64(pageSize)
		c.JSON(http.StatusOK, gin.H{
			"data": appointments,
			"pagination": gin.H{
				"page":       page,
				"pageSize":   pageSize,
				"total":      total,
				"totalPages": totalPages,
				"hasNext":    page < int(totalPages),
				"hasPrev":    page > 1,
			},
		})
	}
}
