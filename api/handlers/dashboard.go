// api/handlers/dashboard.go
package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/BryanPMX/CAF/api/config"
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
// Office filter: use query param "officeId" when provided (admin); otherwise use context officeScopeID (office_manager).
func GetDashboardSummary(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var officeFilter uint
		roleVal, _ := c.Get("userRole")
		role, _ := roleVal.(string)
		if officeIdStr := c.Query("officeId"); officeIdStr != "" {
			if parsed, err := strconv.ParseUint(officeIdStr, 10, 32); err == nil {
				officeFilter = uint(parsed)
				// Office manager may only see their own office; ignore query if different
				if role == config.RoleOfficeManager {
					if scope, ok := c.Get("officeScopeID"); ok {
						if sid, ok2 := scope.(uint); ok2 && sid != officeFilter {
							officeFilter = sid
						}
					}
				}
			}
		}
		if officeFilter == 0 {
			if scope, ok := c.Get("officeScopeID"); ok {
				if sid, ok2 := scope.(uint); ok2 {
					officeFilter = sid
				}
			}
		}

		// Get all required metrics for admin/office manager dashboard
		var totalCases int64
		totalCasesQuery := db.Model(&models.Case{}).Where("is_archived = ? AND deleted_at IS NULL", false)
		if officeFilter != 0 {
			totalCasesQuery = totalCasesQuery.Where("office_id = ?", officeFilter)
		}
		totalCasesQuery.Count(&totalCases)

		var openCases int64
		casesQuery := db.Model(&models.Case{}).Where("status IN (?) AND is_archived = ? AND deleted_at IS NULL", []string{"open", "active", "in_progress"}, false)
		if officeFilter != 0 {
			casesQuery = casesQuery.Where("office_id = ?", officeFilter)
		}
		casesQuery.Count(&openCases)

		var completedCases int64
		completedCasesQuery := db.Model(&models.Case{}).Where("status IN (?) AND is_archived = ? AND deleted_at IS NULL", []string{"completed", "closed"}, false)
		if officeFilter != 0 {
			completedCasesQuery = completedCasesQuery.Where("office_id = ?", officeFilter)
		}
		completedCasesQuery.Count(&completedCases)

		var casesThisMonth int64
		now := time.Now()
		currentMonthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		casesMonthQuery := db.Model(&models.Case{}).Where("created_at >= ? AND is_archived = ? AND deleted_at IS NULL", currentMonthStart, false)
		if officeFilter != 0 {
			casesMonthQuery = casesMonthQuery.Where("office_id = ?", officeFilter)
		}
		casesMonthQuery.Count(&casesThisMonth)

		var totalAppointments int64
		totalApptQuery := db.Model(&models.Appointment{}).Where("deleted_at IS NULL")
		if officeFilter != 0 {
			totalApptQuery = totalApptQuery.Where("office_id = ?", officeFilter)
		}
		totalApptQuery.Count(&totalAppointments)

		var pendingAppointments int64
		pendingApptQuery := db.Model(&models.Appointment{}).Where("status = ? AND deleted_at IS NULL", "pending")
		if officeFilter != 0 {
			pendingApptQuery = pendingApptQuery.Where("office_id = ?", officeFilter)
		}
		pendingApptQuery.Count(&pendingAppointments)

		var completedAppointments int64
		completedApptQuery := db.Model(&models.Appointment{}).Where("status = ? AND deleted_at IS NULL", "completed")
		if officeFilter != 0 {
			completedApptQuery = completedApptQuery.Where("office_id = ?", officeFilter)
		}
		completedApptQuery.Count(&completedAppointments)

		var appointmentsToday int64
		todayStart := time.Now().Truncate(24 * time.Hour)
		todayEnd := todayStart.Add(24 * time.Hour)
		apptTodayQuery := db.Model(&models.Appointment{}).Where("start_time >= ? AND start_time < ? AND deleted_at IS NULL", todayStart, todayEnd)
		if officeFilter != 0 {
			apptTodayQuery = apptTodayQuery.Where("office_id = ?", officeFilter)
		}
		apptTodayQuery.Count(&appointmentsToday)

		var offices []models.Office
		db.Find(&offices)

		// Additional stats for enhanced dashboard
		var totalStaff int64
		staffQuery := db.Model(&models.User{}).Where("role != 'client' AND deleted_at IS NULL")
		if officeFilter != 0 {
			staffQuery = staffQuery.Where("office_id = ?", officeFilter)
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
		if officeFilter != 0 {
			apptWeekQuery = apptWeekQuery.Where("office_id = ?", officeFilter)
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
