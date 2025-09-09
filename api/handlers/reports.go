package handlers

import (
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/BryanPMX/CAF/api/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ReportsHandler provides focused reporting functionality for cases and appointments
type ReportsHandler struct {
	db *gorm.DB
}

// QueryParams defines the common query parameters for reports
type QueryParams struct {
	DateFrom          *time.Time `form:"dateFrom"`
	DateTo            *time.Time `form:"dateTo"`
	Period            string     `form:"period"`
	Format            string     `form:"format"`
	ReportType        string     `form:"reportType"`
	Department        string     `form:"department"`
	OfficeID          *uint      `form:"officeId"`
	CaseStatus        string     `form:"caseStatus"`
	AppointmentStatus string     `form:"appointmentStatus"`
}

// NewReportsHandler creates a new reports handler instance
func NewReportsHandler(db *gorm.DB) *ReportsHandler {
	return &ReportsHandler{db: db}
}

// GetSummaryReport returns a comprehensive summary of cases and appointments for the specified period
func (rh *ReportsHandler) GetSummaryReport() gin.HandlerFunc {
	return func(c *gin.Context) {
		var query QueryParams

		if err := c.ShouldBindQuery(&query); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Parámetros de consulta inválidos"})
			return
		}

		// Set default date range if not provided
		if query.DateFrom == nil || query.DateTo == nil {
			start, end := getPeriodRange(query.Period)
			query.DateFrom = &start
			query.DateTo = &end
		}

		// Base query with office scoping for non-admin roles
		dbq := rh.db.Model(&models.Case{})
		if roleVal, exists := c.Get("userRole"); exists {
			if role, ok := roleVal.(string); ok && role != "admin" {
				if officeScopeVal, ok2 := c.Get("officeScopeID"); ok2 {
					if officeID, ok3 := officeScopeVal.(uint); ok3 {
						dbq = dbq.Where("office_id = ?", officeID)
					}
				}
			}
		}

		// Apply filters
		if query.Department != "" {
			dbq = dbq.Where("category = ?", query.Department)
		}
		if query.OfficeID != nil {
			dbq = dbq.Where("office_id = ?", *query.OfficeID)
		}

		// Get case statistics
		var totalCases int64
		dbq.Where("created_at BETWEEN ? AND ?", query.DateFrom, query.DateTo).Count(&totalCases)

		// Cases by status
		var casesByStatus []struct {
			Status string
			Count  int64
		}
		dbq.Where("created_at BETWEEN ? AND ?", query.DateFrom, query.DateTo).
			Select("status, COUNT(*) as count").
			Group("status").Scan(&casesByStatus)

		// Cases by department
		var casesByDepartment []struct {
			Department string
			Count      int64
		}
		dbq.Where("created_at BETWEEN ? AND ?", query.DateFrom, query.DateTo).
			Select("category as department, COUNT(*) as count").
			Group("category").Scan(&casesByDepartment)

		// Cases by stage
		var casesByStage []struct {
			Stage string
			Count int64
		}
		dbq.Where("created_at BETWEEN ? AND ?", query.DateFrom, query.DateTo).
			Select("current_stage as stage, COUNT(*) as count").
			Group("current_stage").Scan(&casesByStage)

		// Get appointment statistics
		var totalAppointments int64
		apptQuery := rh.db.Model(&models.Appointment{})
		if query.Department != "" {
			apptQuery = apptQuery.Where("department = ?", query.Department)
		}
		apptQuery.Where("start_time BETWEEN ? AND ?", query.DateFrom, query.DateTo).Count(&totalAppointments)

		// Appointments by status
		var appointmentsByStatus []struct {
			Status string
			Count  int64
		}
		apptQuery.Where("start_time BETWEEN ? AND ?", query.DateFrom, query.DateTo).
			Select("status, COUNT(*) as count").
			Group("status").Scan(&appointmentsByStatus)

		// Appointments by department
		var appointmentsByDepartment []struct {
			Department string
			Count      int64
		}
		apptQuery.Where("start_time BETWEEN ? AND ?", query.DateFrom, query.DateTo).
			Select("department, COUNT(*) as count").
			Group("department").Scan(&appointmentsByDepartment)

		c.JSON(http.StatusOK, gin.H{
			"totalCases":               totalCases,
			"totalAppointments":        totalAppointments,
			"casesByStatus":            casesByStatus,
			"casesByDepartment":        casesByDepartment,
			"casesByStage":             casesByStage,
			"appointmentsByStatus":     appointmentsByStatus,
			"appointmentsByDepartment": appointmentsByDepartment,
			"period":                   query.Period,
			"dateRange":                []string{query.DateFrom.Format("2006-01-02"), query.DateTo.Format("2006-01-02")},
		})
	}
}

// GetCasesReport returns detailed case information for the specified period
func (rh *ReportsHandler) GetCasesReport() gin.HandlerFunc {
	return func(c *gin.Context) {
		var query QueryParams

		if err := c.ShouldBindQuery(&query); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Parámetros de consulta inválidos"})
			return
		}

		// Set default date range if not provided
		if query.DateFrom == nil || query.DateTo == nil {
			start, end := getPeriodRange(query.Period)
			query.DateFrom = &start
			query.DateTo = &end
		}

		// Base query with office scoping for non-admin roles
		dbq := rh.db.Model(&models.Case{}).
			Preload("Client").
			Preload("Office").
			Preload("AssignedStaff")

		if roleVal, exists := c.Get("userRole"); exists {
			if role, ok := roleVal.(string); ok && role != "admin" {
				if officeScopeVal, ok2 := c.Get("officeScopeID"); ok2 {
					if officeID, ok3 := officeScopeVal.(uint); ok3 {
						dbq = dbq.Where("office_id = ?", officeID)
					}
				}
			}
		}

		// Apply filters
		dbq = dbq.Where("created_at BETWEEN ? AND ?", query.DateFrom, query.DateTo)
		if query.Department != "" {
			dbq = dbq.Where("category = ?", query.Department)
		}
		if query.OfficeID != nil {
			dbq = dbq.Where("office_id = ?", *query.OfficeID)
		}
		if query.CaseStatus != "" {
			dbq = dbq.Where("status = ?", query.CaseStatus)
		}

		// Initialize with empty slice to prevent null JSON response
		cases := make([]models.Case, 0)
		if err := dbq.Order("created_at DESC").Find(&cases).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al recuperar casos"})
			return
		}

		// Transform data for frontend
		var caseReports []gin.H
		for _, caseRecord := range cases {
			clientName := ""
			if caseRecord.Client != nil {
				clientName = fmt.Sprintf("%s %s", caseRecord.Client.FirstName, caseRecord.Client.LastName)
			}

			officeName := ""
			if caseRecord.Office != nil {
				officeName = caseRecord.Office.Name
			}

			assignedStaff := ""
			if len(caseRecord.AssignedStaff) > 0 {
				var names []string
				for _, staff := range caseRecord.AssignedStaff {
					names = append(names, fmt.Sprintf("%s %s", staff.FirstName, staff.LastName))
				}
				assignedStaff = strings.Join(names, ", ")
			}

			caseReports = append(caseReports, gin.H{
				"id":            caseRecord.ID,
				"title":         caseRecord.Title,
				"category":      caseRecord.Category,
				"status":        caseRecord.Status,
				"currentStage":  caseRecord.CurrentStage,
				"clientName":    clientName,
				"officeName":    officeName,
				"assignedStaff": assignedStaff,
				"createdAt":     caseRecord.CreatedAt,
				"updatedAt":     caseRecord.UpdatedAt,
				"docketNumber":  caseRecord.DocketNumber,
				"court":         caseRecord.Court,
				"description":   caseRecord.Description,
			})
		}

		c.JSON(http.StatusOK, gin.H{
			"data":      caseReports,
			"total":     len(caseReports),
			"period":    query.Period,
			"dateRange": []string{query.DateFrom.Format("2006-01-02"), query.DateTo.Format("2006-01-02")},
		})
	}
}

// GetAppointmentsReport returns detailed appointment information for the specified period
func (rh *ReportsHandler) GetAppointmentsReport() gin.HandlerFunc {
	return func(c *gin.Context) {
		var query QueryParams

		if err := c.ShouldBindQuery(&query); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Parámetros de consulta inválidos"})
			return
		}

		// Set default date range if not provided
		if query.DateFrom == nil || query.DateTo == nil {
			start, end := getPeriodRange(query.Period)
			query.DateFrom = &start
			query.DateTo = &end
		}

		// Base query with office scoping for non-admin roles
		dbq := rh.db.Model(&models.Appointment{}).
			Preload("Case").
			Preload("Case.Client").
			Preload("Staff")

		// Apply filters
		dbq = dbq.Where("start_time BETWEEN ? AND ?", query.DateFrom, query.DateTo)
		if query.Department != "" {
			dbq = dbq.Where("department = ?", query.Department)
		}
		if query.AppointmentStatus != "" {
			dbq = dbq.Where("status = ?", query.AppointmentStatus)
		}

		// Office filtering through case relationship
		if query.OfficeID != nil {
			dbq = dbq.Joins("JOIN cases ON appointments.case_id = cases.id").
				Where("cases.office_id = ?", *query.OfficeID)
		} else if roleVal, exists := c.Get("userRole"); exists {
			if role, ok := roleVal.(string); ok && role != "admin" {
				if officeScopeVal, ok2 := c.Get("officeScopeID"); ok2 {
					if officeID, ok3 := officeScopeVal.(uint); ok3 {
						dbq = dbq.Joins("JOIN cases ON appointments.case_id = cases.id").
							Where("cases.office_id = ?", officeID)
					}
				}
			}
		}

		// Initialize with empty slice to prevent null JSON response
		appointments := make([]models.Appointment, 0)
		if err := dbq.Order("start_time DESC").Find(&appointments).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al recuperar citas"})
			return
		}

		// Transform data for frontend
		var appointmentReports []gin.H
		for _, appointment := range appointments {
			clientName := ""
			// Check if Case and Client exist by checking if Case has a valid ID
			if appointment.Case.ID > 0 && appointment.Case.Client != nil {
				clientName = fmt.Sprintf("%s %s", appointment.Case.Client.FirstName, appointment.Case.Client.LastName)
			}

			caseTitle := ""
			// Check if Case exists by checking if it has a valid ID
			if appointment.Case.ID > 0 {
				caseTitle = appointment.Case.Title
			}

			staffName := ""
			// Check if Staff exists by checking if it has a valid ID
			if appointment.Staff.ID > 0 {
				staffName = fmt.Sprintf("%s %s", appointment.Staff.FirstName, appointment.Staff.LastName)
			}

			appointmentReports = append(appointmentReports, gin.H{
				"id":         appointment.ID,
				"title":      appointment.Title,
				"caseTitle":  caseTitle,
				"clientName": clientName,
				"staffName":  staffName,
				"startTime":  appointment.StartTime,
				"endTime":    appointment.EndTime,
				"status":     appointment.Status,
				"category":   appointment.Category,
				"department": appointment.Department,
				"createdAt":  appointment.CreatedAt,
			})
		}

		c.JSON(http.StatusOK, gin.H{
			"data":      appointmentReports,
			"total":     len(appointmentReports),
			"period":    query.Period,
			"dateRange": []string{query.DateFrom.Format("2006-01-02"), query.DateTo.Format("2006-01-02")},
		})
	}
}

// ExportReport exports the report data in Excel or PDF format
func (rh *ReportsHandler) ExportReport() gin.HandlerFunc {
	return func(c *gin.Context) {
		var query QueryParams

		if err := c.ShouldBindQuery(&query); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Parámetros de consulta inválidos"})
			return
		}

		// Set default date range if not provided
		if query.DateFrom == nil || query.DateTo == nil {
			start, end := getPeriodRange(query.Period)
			query.DateFrom = &start
			query.DateTo = &end
		}

		// For now, return a simple CSV export
		// In a production environment, you would use libraries like excelize for Excel or wkhtmltopdf for PDF
		c.Header("Content-Type", "text/csv")
		c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=reporte-%s-%s-%s.csv",
			query.ReportType, query.Period, time.Now().Format("2006-01-02")))

		// Generate CSV content based on report type
		var csvContent string
		switch query.ReportType {
		case "cases":
			csvContent = rh.generateEnhancedCasesCSV(query)
		case "appointments":
			csvContent = rh.generateEnhancedAppointmentsCSV(query)
		case "summary":
			csvContent = rh.generateEnhancedSummaryCSV(query)
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tipo de reporte no válido"})
			return
		}

		c.String(http.StatusOK, csvContent)
	}
}

// Helper function to generate CSV for cases
func (rh *ReportsHandler) generateCasesCSV(query QueryParams) string {
	// This is a simplified CSV generation
	// In production, you would query the database and format the data properly
	csv := "ID,Título,Departamento,Estado,Fase,Cliente,Oficina,Personal Asignado,N° Expediente,Juzgado,Fecha Creación,Última Actualización\n"

	// Add data rows here based on the query parameters
	// For now, return header only
	return csv
}

// Helper function to generate CSV for appointments
func (rh *ReportsHandler) generateAppointmentsCSV(query QueryParams) string {
	csv := "ID,Título,Caso,Cliente,Personal,Fecha Inicio,Fecha Fin,Estado,Categoría,Departamento,Fecha Creación\n"

	// Add data rows here based on the query parameters
	// For now, return header only
	return csv
}

// Helper function to generate CSV for summary
func (rh *ReportsHandler) generateSummaryCSV(query QueryParams) string {
	csv := "Métrica,Valor\n"
	csv += "Período," + query.Period + "\n"
	csv += "Fecha Desde," + query.DateFrom.Format("2006-01-02") + "\n"
	csv += "Fecha Hasta," + query.DateTo.Format("2006-01-02") + "\n"

	// Add summary data here based on the query parameters
	// For now, return basic structure only
	return csv
}

// Helper function to escape CSV values with enhanced security
func escapeCSV(value string) string {
	if value == "" {
		return "N/A"
	}

	// Clean and sanitize the value
	cleanValue := strings.TrimSpace(value)

	// Check if value contains special characters that need escaping
	if strings.Contains(cleanValue, ",") || strings.Contains(cleanValue, "\"") ||
		strings.Contains(cleanValue, "\n") || strings.Contains(cleanValue, "\r") {
		// Escape quotes and wrap in quotes
		escapedValue := strings.ReplaceAll(cleanValue, "\"", "\"\"")
		return fmt.Sprintf("\"%s\"", escapedValue)
	}

	return cleanValue
}

// logExportActivity logs export activities for audit purposes
func (rh *ReportsHandler) logExportActivity(userID string, query QueryParams, contentSize int) {
	// This function runs asynchronously to avoid blocking the main response
	// Note: AuditLog structure may need to be updated based on your models
	log.Printf("Export activity: User %s exported %s report in %s format, size: %d bytes",
		userID, query.ReportType, query.Format, contentSize)
}

// getPeriodRange returns the start and end dates for the specified period with enhanced logic
func getPeriodRange(period string) (time.Time, time.Time) {
	now := time.Now()
	var start, end time.Time

	switch period {
	case "daily":
		start = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		end = start.Add(24 * time.Hour).Add(-time.Nanosecond)
	case "weekly":
		// Start from Monday of current week
		weekday := int(now.Weekday())
		if weekday == 0 { // Sunday
			weekday = 7
		}
		start = time.Date(now.Year(), now.Month(), now.Day()-weekday+1, 0, 0, 0, 0, now.Location())
		end = start.AddDate(0, 0, 7).Add(-time.Nanosecond)
	case "monthly":
		// Start from first day of current month
		start = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		end = start.AddDate(0, 1, 0).Add(-time.Nanosecond)
	case "yearly":
		start = time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location())
		end = time.Date(now.Year(), 12, 31, 23, 59, 59, 999999999, now.Location())
	default:
		// Default to daily
		start = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		end = start.Add(24 * time.Hour).Add(-time.Nanosecond)
	}

	return start, end
}

// generateFormattedCasesPDF generates formatted content for PDF cases report
func (rh *ReportsHandler) generateFormattedCasesPDF(query QueryParams) string {
	// For now, return enhanced CSV content (can be enhanced with actual PDF formatting)
	return rh.generateEnhancedCasesCSV(query)
}

// generateFormattedAppointmentsPDF generates formatted content for PDF appointments report
func (rh *ReportsHandler) generateFormattedAppointmentsPDF(query QueryParams) string {
	// For now, return enhanced CSV content (can be enhanced with actual PDF formatting)
	return rh.generateEnhancedAppointmentsCSV(query)
}

// generateFormattedSummaryPDF generates formatted content for PDF summary report
func (rh *ReportsHandler) generateFormattedSummaryPDF(query QueryParams) string {
	// For now, return enhanced CSV content (can be enhanced with actual PDF formatting)
	return rh.generateEnhancedSummaryCSV(query)
}

// generateEnhancedCasesCSV generates detailed CSV content for cases report with performance optimizations
func (rh *ReportsHandler) generateEnhancedCasesCSV(query QueryParams) string {
	var content strings.Builder

	// Add cases header with enhanced formatting
	content.WriteString("REPORTE DETALLADO DE CASOS\n")
	content.WriteString(strings.Repeat("-", 50) + "\n")
	content.WriteString("ID,Título,Departamento,Estado,Fase,Cliente,Oficina,Personal Asignado,N° Expediente,Juzgado,Fecha Creación,Última Actualización,Prioridad\n")

	// Use optimized query with proper indexing
	dbq := rh.db.Model(&models.Case{}).
		Preload("Client").
		Preload("Office").
		Preload("PrimaryStaff").
		Where("created_at BETWEEN ? AND ?", query.DateFrom, query.DateTo)

	// Apply filters with proper indexing
	if query.Department != "" {
		dbq = dbq.Where("category = ?", query.Department)
	}
	if query.OfficeID != nil {
		dbq = dbq.Where("office_id = ?", *query.OfficeID)
	}
	if query.CaseStatus != "" {
		dbq = dbq.Where("status = ?", query.CaseStatus)
	}

	// Use pagination for large datasets to prevent memory issues
	const batchSize = 1000
	var offset int
	// Initialize with empty slice to prevent null JSON response
	allCases := make([]models.Case, 0)

	for {
		// Initialize with empty slice to prevent null JSON response
		batch := make([]models.Case, 0)
		if err := dbq.Offset(offset).Limit(batchSize).Order("created_at DESC").Find(&batch).Error; err != nil {
			return "Error al consultar casos: " + err.Error()
		}

		if len(batch) == 0 {
			break
		}

		allCases = append(allCases, batch...)
		offset += batchSize

		// Safety check to prevent infinite loops
		if offset > 10000 {
			break
		}
	}

	// Generate CSV rows with enhanced data
	for _, caseRecord := range allCases {
		clientName := ""
		if caseRecord.Client != nil {
			clientName = fmt.Sprintf("%s %s", caseRecord.Client.FirstName, caseRecord.Client.LastName)
		}

		officeName := ""
		if caseRecord.Office != nil {
			officeName = caseRecord.Office.Name
		}

		staffName := ""
		if caseRecord.PrimaryStaff != nil {
			staffName = fmt.Sprintf("%s %s", caseRecord.PrimaryStaff.FirstName, caseRecord.PrimaryStaff.LastName)
		}

		// Calculate case age for priority assessment
		caseAge := time.Since(caseRecord.CreatedAt).Hours() / 24
		priority := "Normal"
		if caseAge > 30 {
			priority = "Alta"
		} else if caseAge > 7 {
			priority = "Media"
		}

		content.WriteString(fmt.Sprintf("%d,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s\n",
			caseRecord.ID,
			escapeCSV(caseRecord.Title),
			escapeCSV(caseRecord.Category),
			escapeCSV(caseRecord.Status),
			escapeCSV(caseRecord.CurrentStage),
			escapeCSV(clientName),
			escapeCSV(officeName),
			escapeCSV(staffName),
			escapeCSV(caseRecord.DocketNumber),
			escapeCSV(caseRecord.Court),
			caseRecord.CreatedAt.Format("02/01/2006"),
			caseRecord.UpdatedAt.Format("02/01/2006"),
			priority,
		))
	}

	// Add summary statistics
	content.WriteString(fmt.Sprintf("\nRESUMEN ESTADÍSTICO\n"))
	content.WriteString(fmt.Sprintf("Total de Casos: %d\n", len(allCases)))
	content.WriteString(fmt.Sprintf("Casos por Departamento:\n"))

	// Group by department for summary
	deptStats := make(map[string]int)
	for _, c := range allCases {
		deptStats[c.Category]++
	}

	for dept, count := range deptStats {
		content.WriteString(fmt.Sprintf("  %s: %d\n", dept, count))
	}

	return content.String()
}

// generateEnhancedAppointmentsCSV generates detailed CSV content for appointments report
func (rh *ReportsHandler) generateEnhancedAppointmentsCSV(query QueryParams) string {
	var content strings.Builder

	// Add appointments header with enhanced formatting
	content.WriteString("REPORTE DETALLADO DE CITAS\n")
	content.WriteString(strings.Repeat("-", 50) + "\n")
	content.WriteString("ID,Título,Caso,Cliente,Personal,Fecha Inicio,Fecha Fin,Duración,Estado,Categoría,Departamento,Fecha Creación\n")

	// Use optimized query with proper indexing
	dbq := rh.db.Model(&models.Appointment{}).
		Preload("Staff").
		Preload("Case").
		Preload("Case.Client").
		Where("start_time BETWEEN ? AND ?", query.DateFrom, query.DateTo)

	// Apply filters
	if query.Department != "" {
		dbq = dbq.Where("department = ?", query.Department)
	}
	if query.AppointmentStatus != "" {
		dbq = dbq.Where("status = ?", query.AppointmentStatus)
	}

	// Use pagination for large datasets
	const batchSize = 1000
	var offset int
	var allAppointments []models.Appointment = make([]models.Appointment, 0)

	for {
		var batch []models.Appointment = make([]models.Appointment, 0)
		if err := dbq.Offset(offset).Limit(batchSize).Order("start_time DESC").Find(&batch).Error; err != nil {
			return "Error al consultar citas: " + err.Error()
		}

		if len(batch) == 0 {
			break
		}

		allAppointments = append(allAppointments, batch...)
		offset += batchSize

		if offset > 10000 {
			break
		}
	}

	// Generate CSV rows with enhanced data
	for _, appointment := range allAppointments {
		caseTitle := ""
		if appointment.Case.ID > 0 {
			caseTitle = appointment.Case.Title
		}

		clientName := ""
		if appointment.Case.ID > 0 && appointment.Case.Client != nil {
			clientName = fmt.Sprintf("%s %s", appointment.Case.Client.FirstName, appointment.Case.Client.LastName)
		}

		staffName := ""
		if appointment.Staff.ID > 0 {
			staffName = fmt.Sprintf("%s %s", appointment.Staff.FirstName, appointment.Staff.LastName)
		}

		// Calculate appointment duration
		duration := appointment.EndTime.Sub(appointment.StartTime)
		durationStr := fmt.Sprintf("%.1f horas", duration.Hours())

		content.WriteString(fmt.Sprintf("%d,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s\n",
			appointment.ID,
			escapeCSV(appointment.Title),
			escapeCSV(caseTitle),
			escapeCSV(clientName),
			escapeCSV(staffName),
			appointment.StartTime.Format("02/01/2006 15:04"),
			appointment.EndTime.Format("02/01/2006 15:04"),
			durationStr,
			escapeCSV(string(appointment.Status)),
			escapeCSV(appointment.Category),
			escapeCSV(appointment.Department),
			appointment.CreatedAt.Format("02/01/2006"),
		))
	}

	// Add summary statistics
	content.WriteString(fmt.Sprintf("\nRESUMEN ESTADÍSTICO\n"))
	content.WriteString(fmt.Sprintf("Total de Citas: %d\n", len(allAppointments)))
	content.WriteString(fmt.Sprintf("Citas por Estado:\n"))

	// Group by status for summary
	statusStats := make(map[string]int)
	for _, a := range allAppointments {
		statusStats[string(a.Status)]++
	}

	for status, count := range statusStats {
		content.WriteString(fmt.Sprintf("  %s: %d\n", status, count))
	}

	return content.String()
}

// generateEnhancedSummaryCSV generates comprehensive summary CSV content
func (rh *ReportsHandler) generateEnhancedSummaryCSV(query QueryParams) string {
	var content strings.Builder

	// Add summary header with enhanced formatting
	content.WriteString("REPORTE RESUMEN COMPREHENSIVO DEL SISTEMA\n")
	content.WriteString(strings.Repeat("=", 60) + "\n")
	content.WriteString(fmt.Sprintf("Período: %s\n", strings.ToUpper(query.Period)))
	content.WriteString(fmt.Sprintf("Fecha Desde: %s\n", query.DateFrom.Format("02/01/2006")))
	content.WriteString(fmt.Sprintf("Fecha Hasta: %s\n", query.DateTo.Format("02/01/2006")))
	content.WriteString(fmt.Sprintf("Fecha Generación: %s\n", time.Now().Format("02/01/2006 15:04:05")))
	content.WriteString(strings.Repeat("=", 60) + "\n\n")

	// Get comprehensive summary data with performance optimizations
	summaryData := rh.getEnhancedSummaryData(query)

	// General Overview
	content.WriteString("RESUMEN GENERAL\n")
	content.WriteString(strings.Repeat("-", 30) + "\n")
	content.WriteString(fmt.Sprintf("Total de Casos: %d\n", summaryData.TotalCases))
	content.WriteString(fmt.Sprintf("Total de Citas: %d\n", summaryData.TotalAppointments))
	content.WriteString(fmt.Sprintf("Tasa de Resolución: %.2f%%\n", summaryData.CaseResolutionRate))
	content.WriteString(fmt.Sprintf("Eficiencia de Citas: %.2f%%\n", summaryData.AppointmentCompletionRate))
	content.WriteString("\n")

	// Cases by Status
	content.WriteString("CASOS POR ESTADO\n")
	content.WriteString(strings.Repeat("-", 30) + "\n")
	for _, status := range summaryData.CasesByStatus {
		content.WriteString(fmt.Sprintf("%s: %d (%.1f%%)\n",
			status.Status,
			status.Count,
			float64(status.Count)/float64(summaryData.TotalCases)*100))
	}
	content.WriteString("\n")

	// Cases by Department
	content.WriteString("CASOS POR DEPARTAMENTO\n")
	content.WriteString(strings.Repeat("-", 30) + "\n")
	for _, dept := range summaryData.CasesByDepartment {
		content.WriteString(fmt.Sprintf("%s: %d (%.1f%%)\n",
			dept.Department,
			dept.Count,
			float64(dept.Count)/float64(summaryData.TotalCases)*100))
	}
	content.WriteString("\n")

	// Appointments by Status
	content.WriteString("CITAS POR ESTADO\n")
	content.WriteString(strings.Repeat("-", 30) + "\n")
	for _, status := range summaryData.AppointmentsByStatus {
		content.WriteString(fmt.Sprintf("%s: %d (%.1f%%)\n",
			status.Status,
			status.Count,
			float64(status.Count)/float64(summaryData.TotalAppointments)*100))
	}
	content.WriteString("\n")

	// Cases by Stage
	content.WriteString("CASOS POR FASE\n")
	content.WriteString(strings.Repeat("-", 30) + "\n")
	for _, stage := range summaryData.CasesByStage {
		content.WriteString(fmt.Sprintf("%s: %d (%.1f%%)\n",
			stage.Stage,
			stage.Count,
			float64(stage.Count)/float64(summaryData.TotalCases)*100))
	}

	return content.String()
}

// getEnhancedSummaryData retrieves comprehensive summary data with performance optimizations
func (rh *ReportsHandler) getEnhancedSummaryData(query QueryParams) struct {
	TotalCases        int64
	TotalAppointments int64
	CasesByStatus     []struct {
		Status string
		Count  int64
	}
	CasesByDepartment []struct {
		Department string
		Count      int64
	}
	AppointmentsByStatus []struct {
		Status string
		Count  int64
	}
	CasesByStage []struct {
		Stage string
		Count int64
	}
	CaseResolutionRate        float64
	AppointmentCompletionRate float64
} {
	// Use optimized queries with proper indexing
	var totalCases int64
	rh.db.Model(&models.Case{}).Where("created_at BETWEEN ? AND ?", query.DateFrom, query.DateTo).Count(&totalCases)

	var totalAppointments int64
	apptQuery := rh.db.Model(&models.Appointment{})
	if query.Department != "" {
		apptQuery = apptQuery.Where("department = ?", query.Department)
	}
	apptQuery.Where("start_time BETWEEN ? AND ?", query.DateFrom, query.DateTo).Count(&totalAppointments)

	// Get aggregated data with single queries for better performance
	var casesByStatus []struct {
		Status string
		Count  int64
	}
	rh.db.Model(&models.Case{}).
		Where("created_at BETWEEN ? AND ?", query.DateFrom, query.DateTo).
		Select("status, COUNT(*) as count").
		Group("status").
		Scan(&casesByStatus)

	var casesByDepartment []struct {
		Department string
		Count      int64
	}
	rh.db.Model(&models.Case{}).
		Where("created_at BETWEEN ? AND ?", query.DateFrom, query.DateTo).
		Select("category as department, COUNT(*) as count").
		Group("category").
		Scan(&casesByDepartment)

	var casesByStage []struct {
		Stage string
		Count int64
	}
	rh.db.Model(&models.Case{}).
		Where("created_at BETWEEN ? AND ?", query.DateFrom, query.DateTo).
		Select("current_stage as stage, COUNT(*) as count").
		Group("current_stage").
		Scan(&casesByStage)

	var appointmentsByStatus []struct {
		Status string
		Count  int64
	}
	apptQuery.Where("start_time BETWEEN ? AND ?", query.DateFrom, query.DateTo).
		Select("status, COUNT(*) as count").
		Group("status").
		Scan(&appointmentsByStatus)

	// Calculate rates
	var caseResolutionRate float64
	var appointmentCompletionRate float64

	if totalCases > 0 {
		var closedCases int64
		for _, status := range casesByStatus {
			if status.Status == "closed" {
				closedCases = status.Count
				break
			}
		}
		caseResolutionRate = float64(closedCases) / float64(totalCases) * 100
	}

	if totalAppointments > 0 {
		var completedAppointments int64
		for _, status := range appointmentsByStatus {
			if status.Status == "completed" {
				completedAppointments = status.Count
				break
			}
		}
		appointmentCompletionRate = float64(completedAppointments) / float64(totalAppointments) * 100
	}

	return struct {
		TotalCases        int64
		TotalAppointments int64
		CasesByStatus     []struct {
			Status string
			Count  int64
		}
		CasesByDepartment []struct {
			Department string
			Count      int64
		}
		AppointmentsByStatus []struct {
			Status string
			Count  int64
		}
		CasesByStage []struct {
			Stage string
			Count int64
		}
		CaseResolutionRate        float64
		AppointmentCompletionRate float64
	}{
		TotalCases:                totalCases,
		TotalAppointments:         totalAppointments,
		CasesByStatus:             casesByStatus,
		CasesByDepartment:         casesByDepartment,
		AppointmentsByStatus:      appointmentsByStatus,
		CasesByStage:              casesByStage,
		CaseResolutionRate:        caseResolutionRate,
		AppointmentCompletionRate: appointmentCompletionRate,
	}
}
