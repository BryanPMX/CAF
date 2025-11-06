// api/services/dashboard_service.go
package services

import (
	"context"
	"time"

	"github.com/BryanPMX/CAF/api/interfaces"
	"github.com/BryanPMX/CAF/api/models"
	"gorm.io/gorm"
)

// DashboardServiceImpl implements the DashboardService interface
type DashboardServiceImpl struct {
	db *gorm.DB
}

// NewDashboardService creates a new dashboard service
func NewDashboardService(db *gorm.DB) interfaces.DashboardService {
	return &DashboardServiceImpl{db: db}
}

// GetAdminDashboard gets dashboard data for administrators
func (s *DashboardServiceImpl) GetAdminDashboard(ctx context.Context, filter interfaces.DashboardFilter) (*interfaces.DashboardSummary, error) {
	var summary interfaces.DashboardSummary

	// Base query for cases
	caseQuery := s.db.WithContext(ctx).Model(&models.Case{}).Where("is_archived = ? AND deleted_at IS NULL", false)
	if filter.OfficeID != nil {
		caseQuery = caseQuery.Where("office_id = ?", *filter.OfficeID)
	}

	// Count total cases
	caseQuery.Count(&summary.TotalCases)

	// Count open cases
	openCaseQuery := caseQuery.Session(&gorm.Session{})
	openCaseQuery.Where("status IN (?)", []string{"open", "active", "in_progress"}).Count(&summary.OpenCases)

	// Count completed cases
	completedCaseQuery := caseQuery.Session(&gorm.Session{})
	completedCaseQuery.Where("status IN (?)", []string{"closed", "completed"}).Count(&summary.CompletedCases)

	// Count cases this month
	thisMonth := time.Now().AddDate(0, -1, 0)
	casesThisMonthQuery := caseQuery.Session(&gorm.Session{})
	casesThisMonthQuery.Where("created_at >= ?", thisMonth).Count(&summary.CasesThisMonth)

	// Base query for appointments
	apptQuery := s.db.WithContext(ctx).Model(&models.Appointment{})
	if filter.OfficeID != nil {
		apptQuery = apptQuery.Joins("JOIN cases c ON appointments.case_id = c.id").Where("c.office_id = ?", *filter.OfficeID)
	}

	// Count total appointments
	apptQuery.Count(&summary.TotalAppointments)

	// Count pending appointments
	pendingApptQuery := apptQuery.Session(&gorm.Session{})
	pendingApptQuery.Where("status = ?", "pending").Count(&summary.PendingAppointments)

	// Count completed appointments
	completedApptQuery := apptQuery.Session(&gorm.Session{})
	completedApptQuery.Where("status = ?", "completed").Count(&summary.CompletedAppointments)

	// Count today's appointments
	todayStart := time.Now().Truncate(24 * time.Hour)
	todayEnd := todayStart.Add(24 * time.Hour)
	todayApptQuery := apptQuery.Session(&gorm.Session{})
	todayApptQuery.Where("start_time >= ? AND start_time < ?", todayStart, todayEnd).Count(&summary.AppointmentsToday)

	// Always get offices for admin/office manager roles (for filtering UI)
	// Note: This is a simplified approach - in production, you might want to
	// filter offices based on user permissions
	var offices []models.Office
	if err := s.db.WithContext(ctx).Find(&offices).Error; err != nil {
		return nil, err
	}
	summary.Offices = offices

	return &summary, nil
}

// GetStaffDashboard gets dashboard data for staff members
func (s *DashboardServiceImpl) GetStaffDashboard(ctx context.Context, userID string) (*interfaces.StaffDashboardSummary, error) {
	var summary interfaces.StaffDashboardSummary

	// Count cases assigned to user
	s.db.WithContext(ctx).Model(&models.Case{}).
		Joins("JOIN user_case_assignments uca ON cases.id = uca.case_id").
		Where("uca.user_id = ? AND cases.is_archived = ? AND cases.deleted_at IS NULL", userID, false).
		Count(&summary.MyCases)

	// Count open cases assigned to user
	s.db.WithContext(ctx).Model(&models.Case{}).
		Joins("JOIN user_case_assignments uca ON cases.id = uca.case_id").
		Where("uca.user_id = ? AND cases.status IN (?) AND cases.is_archived = ? AND cases.deleted_at IS NULL",
			userID, []string{"open", "active", "in_progress"}, false).
		Count(&summary.MyOpenCases)

	// Count appointments assigned to user
	s.db.WithContext(ctx).Model(&models.Appointment{}).
		Where("assigned_to = ?", userID).
		Count(&summary.MyAppointments)

	// Count pending appointments assigned to user
	s.db.WithContext(ctx).Model(&models.Appointment{}).
		Where("assigned_to = ? AND status = ?", userID, "pending").
		Count(&summary.MyPendingAppointments)

	return &summary, nil
}

// GetOfficeManagerDashboard gets dashboard data for office managers
func (s *DashboardServiceImpl) GetOfficeManagerDashboard(ctx context.Context, officeID uint, filter interfaces.DashboardFilter) (*interfaces.DashboardSummary, error) {
	// Office managers see data for their office only
	officeFilter := interfaces.DashboardFilter{
		OfficeID: &officeID,
		DateFrom: filter.DateFrom,
		DateTo:   filter.DateTo,
	}

	return s.GetAdminDashboard(ctx, officeFilter)
}
