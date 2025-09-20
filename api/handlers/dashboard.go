// api/handlers/dashboard.go
package handlers

import (
	"net/http"
	"time"

	"github.com/BryanPMX/CAF/api/config"
	"github.com/BryanPMX/CAF/api/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// GetDashboardSummary provides key metrics for the admin dashboard.
func GetDashboardSummary(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Context from middleware
		userRole, _ := c.Get("userRole")
		userDepartment, _ := c.Get("userDepartment")
		officeScopeID, _ := c.Get("officeScopeID")
		userIDVal, _ := c.Get("userID")

		var totalOpenCases int64
		casesQuery := db.Model(&models.Case{}).Where("status = ?", "open")
		if role, ok := userRole.(string); ok && !config.CanAccessAllOffices(role) && role != "client" {
			if officeScopeID != nil {
				casesQuery = casesQuery.Where("office_id = ?", officeScopeID)
			}
			if userDepartment != nil {
				casesQuery = casesQuery.Where("category = ?", userDepartment)
			}
			if userIDStr, ok := userIDVal.(string); ok {
				casesQuery = casesQuery.Or("id IN (SELECT case_id FROM user_case_assignments WHERE user_id = ?)", userIDStr)
			}
		}
		casesQuery.Count(&totalOpenCases)

		var totalStaff int64
		staffQuery := db.Model(&models.User{}).Where("role <> ?", "client")
		if role, ok := userRole.(string); ok && role != "admin" && officeScopeID != nil {
			staffQuery = staffQuery.Where("office_id = ?", officeScopeID)
		}
		staffQuery.Count(&totalStaff)

		var appointmentsToday int64
		todayStart := time.Now().Truncate(24 * time.Hour)
		todayEnd := todayStart.Add(24 * time.Hour)
		apptQuery := db.Model(&models.Appointment{}).Where("start_time >= ? AND start_time < ?", todayStart, todayEnd)
		if role, ok := userRole.(string); ok && !config.CanAccessAllOffices(role) && role != "client" {
			if officeScopeID != nil {
				apptQuery = apptQuery.Joins("INNER JOIN cases ON cases.id = appointments.case_id AND cases.office_id = ?", officeScopeID)
			}
			if userDepartment != nil {
				apptQuery = apptQuery.Where("appointments.department = ?", userDepartment)
			}
			if userIDStr, ok := userIDVal.(string); ok {
				apptQuery = apptQuery.Or("appointments.staff_id = ?", userIDStr)
			}
		}
		apptQuery.Count(&appointmentsToday)

		summary := gin.H{
			"totalOpenCases":    totalOpenCases,
			"totalStaff":        totalStaff,
			"appointmentsToday": appointmentsToday,
		}

		c.JSON(http.StatusOK, summary)
	}
}
