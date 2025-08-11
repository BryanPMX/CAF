// api/handlers/dashboard.go
package handlers

import (
	"net/http"
	"time"

	"github.com/BryanPMX/CAF/api/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// GetDashboardSummary provides key metrics for the admin dashboard.
func GetDashboardSummary(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var totalOpenCases int64
		db.Model(&models.Case{}).Where("status = ?", "open").Count(&totalOpenCases)

		var totalStaff int64
		db.Model(&models.User{}).Where("role <> ?", "client").Count(&totalStaff)

		var appointmentsToday int64
		todayStart := time.Now().Truncate(24 * time.Hour)
		todayEnd := todayStart.Add(24 * time.Hour)
		db.Model(&models.Appointment{}).Where("start_time >= ? AND start_time < ?", todayStart, todayEnd).Count(&appointmentsToday)

		summary := gin.H{
			"totalOpenCases":    totalOpenCases,
			"totalStaff":        totalStaff,
			"appointmentsToday": appointmentsToday,
		}

		c.JSON(http.StatusOK, summary)
	}
}
