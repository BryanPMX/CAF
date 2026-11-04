package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/BryanPMX/CAF/api/config"
	"github.com/BryanPMX/CAF/api/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// Only time intervals are disclosed, never client or meeting details.
type appointmentBusyInterval struct {
	StartTime time.Time `json:"startTime"`
	EndTime   time.Time `json:"endTime"`
}

func canScheduleEmployee(actor, employee models.User) bool {
	return actor.ID != 0 && actor.Role != "client" && employee.IsActive && employee.Role != "client" &&
		(actor.Role == config.RoleAdmin || (actor.OfficeID != nil && employee.OfficeID != nil && *actor.OfficeID == *employee.OfficeID))
}

func employeeBusyIntervals(db *gorm.DB, staffID uint, from, to time.Time) ([]appointmentBusyInterval, error) {
	busy := make([]appointmentBusyInterval, 0)
	if err := db.Model(&models.Appointment{}).Select("start_time, end_time").
		Where("staff_id = ? AND status <> ? AND start_time < ? AND end_time > ?", staffID, config.StatusCancelled, to, from).
		Scan(&busy).Error; err != nil {
		return nil, err
	}
	meetings := make([]appointmentBusyInterval, 0)
	if err := db.Model(&models.CalendarEvent{}).Select("start_time, end_time").
		Where("start_time < ? AND end_time > ?", to, from).
		Where("organizer_id = ? OR id IN (SELECT event_id FROM calendar_event_attendees WHERE user_id = ? AND response_status <> ?)", staffID, staffID, "declined").
		Scan(&meetings).Error; err != nil {
		return nil, err
	}
	return append(busy, meetings...), nil
}

func validateSchedulingTime(start, end, now time.Time, zone string) error {
	if !start.After(now) || !end.After(start) {
		return fmt.Errorf("Seleccione un horario futuro válido")
	}
	return validateWorkingHours(start, end, zone, clientSchedule)
}

func GetAppointmentAvailability(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		actor, ok := currentCalendarUser(c)
		if !ok {
			return
		}
		if actor.Role == "client" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Acceso exclusivo para personal"})
			return
		}
		staffID, err := strconv.ParseUint(c.Query("staffId"), 10, 32)
		from, fromErr := time.Parse(time.RFC3339, c.Query("from"))
		to, toErr := time.Parse(time.RFC3339, c.Query("to"))
		if err != nil || staffID == 0 || fromErr != nil || toErr != nil || !to.After(from) || to.Sub(from) > 45*24*time.Hour {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Empleado y rango de fechas inválidos (máximo 45 días)"})
			return
		}
		var employee models.User
		if err := db.First(&employee, staffID).Error; err != nil || !canScheduleEmployee(actor, employee) {
			c.JSON(http.StatusForbidden, gin.H{"error": "No puede consultar la disponibilidad de este empleado"})
			return
		}
		busy, err := employeeBusyIntervals(db, uint(staffID), from, to)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "No se pudo consultar la disponibilidad"})
			return
		}
		c.Header("Cache-Control", "no-store")
		c.JSON(http.StatusOK, gin.H{"staffId": staffID, "busy": busy})
	}
}
