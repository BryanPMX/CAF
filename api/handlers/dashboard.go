// api/handlers/dashboard.go
package handlers

import (
	"net/http"
	"time"

	"github.com/BryanPMX/CAF/api/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// GetStaffDashboardSummary provides limited metrics for staff roles (lawyers, psychologists, etc.)
func GetStaffDashboardSummary(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDVal, _ := c.Get("userID")
		userIDStr, ok := userIDVal.(string)
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "User ID not found"})
			return
		}

		// Get cases assigned to this staff member
		var myCases int64
		db.Model(&models.Case{}).Where("id IN (SELECT case_id FROM user_case_assignments WHERE user_id = ?)", userIDStr).Count(&myCases)

		// Get open cases assigned to this staff member
		var myOpenCases int64
		db.Model(&models.Case{}).Where("id IN (SELECT case_id FROM user_case_assignments WHERE user_id = ?) AND status IN (?)", userIDStr, []string{"open", "active", "in_progress"}).Count(&myOpenCases)

		// Get appointments for cases assigned to this staff member
		var myAppointments int64
		db.Model(&models.Appointment{}).Where("case_id IN (SELECT case_id FROM user_case_assignments WHERE user_id = ?)", userIDStr).Count(&myAppointments)

		// Get pending appointments for cases assigned to this staff member
		var myPendingAppointments int64
		db.Model(&models.Appointment{}).Where("case_id IN (SELECT case_id FROM user_case_assignments WHERE user_id = ?) AND status = ?", userIDStr, "pending").Count(&myPendingAppointments)

		// Today's appointments for this staff member
		todayStart := time.Now().Truncate(24 * time.Hour)
		todayEnd := todayStart.Add(24 * time.Hour)
		var myAppointmentsToday int64
		db.Model(&models.Appointment{}).Where(
			"staff_id = ? AND start_time >= ? AND start_time < ? AND deleted_at IS NULL",
			userIDStr, todayStart, todayEnd,
		).Count(&myAppointmentsToday)

		// Pending tasks assigned to this staff member
		var myPendingTasks int64
		db.Model(&models.Task{}).Where(
			"assigned_to = ? AND status IN (?) AND deleted_at IS NULL",
			userIDStr, []string{"pending", "in_progress"},
		).Count(&myPendingTasks)

		// Completed cases this month
		currentMonthStart := time.Date(time.Now().Year(), time.Now().Month(), 1, 0, 0, 0, 0, time.Now().Location())
		var myCompletedCases int64
		db.Model(&models.Case{}).Where(
			"id IN (SELECT case_id FROM user_case_assignments WHERE user_id = ?) AND status IN (?) AND updated_at >= ?",
			userIDStr, []string{"completed", "closed"}, currentMonthStart,
		).Count(&myCompletedCases)

		c.JSON(http.StatusOK, gin.H{
			"myCases":               myCases,
			"myOpenCases":           myOpenCases,
			"myAppointments":        myAppointments,
			"myPendingAppointments": myPendingAppointments,
			"myAppointmentsToday":   myAppointmentsToday,
			"myPendingTasks":        myPendingTasks,
			"myCompletedCases":      myCompletedCases,
		})
	}
}

// GetDashboardSummary provides key metrics for the admin dashboard.
func GetDashboardSummary(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Context from middleware
		officeScopeID, _ := c.Get("officeScopeID")

		// Get all required metrics for admin/office manager dashboard
		var totalCases int64
		db.Model(&models.Case{}).Where("is_archived = ? AND deleted_at IS NULL", false).Count(&totalCases)

		var openCases int64
		casesQuery := db.Model(&models.Case{}).Where("status IN (?) AND is_archived = ? AND deleted_at IS NULL", []string{"open", "active", "in_progress"}, false)
		if officeID, ok := officeScopeID.(uint); ok {
			casesQuery = casesQuery.Where("office_id = ?", officeID)
		}
		casesQuery.Count(&openCases)

		var completedCases int64
		completedCasesQuery := db.Model(&models.Case{}).Where("status IN (?) AND is_archived = ? AND deleted_at IS NULL", []string{"completed", "closed"}, false)
		if officeID, ok := officeScopeID.(uint); ok {
			completedCasesQuery = completedCasesQuery.Where("office_id = ?", officeID)
		}
		completedCasesQuery.Count(&completedCases)

		var casesThisMonth int64
		now := time.Now()
		currentMonthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		casesMonthQuery := db.Model(&models.Case{}).Where("created_at >= ? AND is_archived = ? AND deleted_at IS NULL", currentMonthStart, false)
		if officeID, ok := officeScopeID.(uint); ok {
			casesMonthQuery = casesMonthQuery.Where("office_id = ?", officeID)
		}
		casesMonthQuery.Count(&casesThisMonth)

		var totalAppointments int64
		db.Model(&models.Appointment{}).Where("deleted_at IS NULL").Count(&totalAppointments)

		var pendingAppointments int64
		pendingApptQuery := db.Model(&models.Appointment{}).Where("status = ? AND deleted_at IS NULL", "pending")
		if officeID, ok := officeScopeID.(uint); ok {
			pendingApptQuery = pendingApptQuery.Where("office_id = ?", officeID)
		}
		pendingApptQuery.Count(&pendingAppointments)

		var completedAppointments int64
		completedApptQuery := db.Model(&models.Appointment{}).Where("status = ? AND deleted_at IS NULL", "completed")
		if officeID, ok := officeScopeID.(uint); ok {
			completedApptQuery = completedApptQuery.Where("office_id = ?", officeID)
		}
		completedApptQuery.Count(&completedAppointments)

		var appointmentsToday int64
		todayStart := time.Now().Truncate(24 * time.Hour)
		todayEnd := todayStart.Add(24 * time.Hour)
		apptTodayQuery := db.Model(&models.Appointment{}).Where("start_time >= ? AND start_time < ? AND deleted_at IS NULL", todayStart, todayEnd)
		if officeID, ok := officeScopeID.(uint); ok {
			apptTodayQuery = apptTodayQuery.Where("office_id = ?", officeID)
		}
		apptTodayQuery.Count(&appointmentsToday)

		var offices []models.Office
		db.Find(&offices)

		// Additional stats for enhanced dashboard
		var totalStaff int64
		staffQuery := db.Model(&models.User{}).Where("role != 'client' AND deleted_at IS NULL")
		if officeID, ok := officeScopeID.(uint); ok {
			staffQuery = staffQuery.Where("office_id = ?", officeID)
		}
		staffQuery.Count(&totalStaff)

		var totalClients int64
		db.Model(&models.User{}).Where("role = 'client' AND deleted_at IS NULL").Count(&totalClients)

		// Pending tasks count
		var pendingTasks int64
		db.Model(&models.Task{}).Where("status IN (?) AND deleted_at IS NULL", []string{"pending", "in_progress"}).Count(&pendingTasks)

		// Appointments this week
		weekStart := todayStart.AddDate(0, 0, -int(todayStart.Weekday()))
		weekEnd := weekStart.AddDate(0, 0, 7)
		var appointmentsThisWeek int64
		apptWeekQuery := db.Model(&models.Appointment{}).Where("start_time >= ? AND start_time < ? AND deleted_at IS NULL", weekStart, weekEnd)
		if officeID, ok := officeScopeID.(uint); ok {
			apptWeekQuery = apptWeekQuery.Where("office_id = ?", officeID)
		}
		apptWeekQuery.Count(&appointmentsThisWeek)

		summary := gin.H{
			"totalCases":            totalCases,
			"openCases":             openCases,
			"completedCases":        completedCases,
			"casesThisMonth":        casesThisMonth,
			"totalAppointments":     totalAppointments,
			"pendingAppointments":   pendingAppointments,
			"completedAppointments": completedAppointments,
			"appointmentsToday":     appointmentsToday,
			"appointmentsThisWeek":  appointmentsThisWeek,
			"totalStaff":            totalStaff,
			"totalClients":          totalClients,
			"pendingTasks":          pendingTasks,
			"offices":               offices,
		}

		c.JSON(http.StatusOK, summary)
	}
}
