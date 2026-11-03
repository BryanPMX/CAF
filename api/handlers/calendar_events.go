package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/BryanPMX/CAF/api/config"
	"github.com/BryanPMX/CAF/api/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	calendarEventMaxRangeDays = 370
	calendarEventMaxAttendees = 50
)

var validCalendarResponses = map[string]struct{}{
	"accepted":  {},
	"tentative": {},
	"declined":  {},
}

type calendarEventInput struct {
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Location    string    `json:"location"`
	StartTime   time.Time `json:"startTime"`
	EndTime     time.Time `json:"endTime"`
	AttendeeIDs []uint    `json:"attendeeIds"`
}

type updateCalendarEventInput struct {
	Title       *string    `json:"title"`
	Description *string    `json:"description"`
	Location    *string    `json:"location"`
	StartTime   *time.Time `json:"startTime"`
	EndTime     *time.Time `json:"endTime"`
	AttendeeIDs *[]uint    `json:"attendeeIds"`
}

type calendarEventResponseInput struct {
	ResponseStatus string `json:"responseStatus"`
}

type calendarStaffOption struct {
	ID         uint   `json:"id"`
	FirstName  string `json:"firstName"`
	LastName   string `json:"lastName"`
	Email      string `json:"email"`
	Role       string `json:"role"`
	OfficeID   *uint  `json:"officeId,omitempty"`
	OfficeName string `json:"officeName,omitempty"`
}

func currentCalendarUser(c *gin.Context) (models.User, bool) {
	value, exists := c.Get("currentUser")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Usuario no autenticado"})
		return models.User{}, false
	}

	user, ok := value.(models.User)
	if !ok || user.ID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Contexto de usuario inválido"})
		return models.User{}, false
	}
	return user, true
}

func normalizeCalendarEventInput(input calendarEventInput, organizerID uint) (calendarEventInput, error) {
	input.Title = strings.TrimSpace(input.Title)
	input.Description = strings.TrimSpace(input.Description)
	input.Location = strings.TrimSpace(input.Location)

	if titleLength := utf8.RuneCountInString(input.Title); titleLength < 3 || titleLength > 200 {
		return input, errors.New("El título debe tener entre 3 y 200 caracteres")
	}
	if utf8.RuneCountInString(input.Description) > 2000 {
		return input, errors.New("La descripción no puede exceder 2000 caracteres")
	}
	if utf8.RuneCountInString(input.Location) > 255 {
		return input, errors.New("La ubicación no puede exceder 255 caracteres")
	}
	if input.StartTime.IsZero() || input.EndTime.IsZero() {
		return input, errors.New("La fecha de inicio y fin son requeridas")
	}
	if !input.EndTime.After(input.StartTime) {
		return input, errors.New("La fecha de fin debe ser posterior al inicio")
	}
	if input.EndTime.Sub(input.StartTime) > 31*24*time.Hour {
		return input, errors.New("El evento no puede durar más de 31 días")
	}

	seen := map[uint]struct{}{organizerID: {}}
	attendeeIDs := []uint{organizerID}
	for _, attendeeID := range input.AttendeeIDs {
		if attendeeID == 0 {
			return input, errors.New("La lista de participantes contiene un usuario inválido")
		}
		if _, exists := seen[attendeeID]; exists {
			continue
		}
		seen[attendeeID] = struct{}{}
		attendeeIDs = append(attendeeIDs, attendeeID)
	}
	if len(attendeeIDs) > calendarEventMaxAttendees+1 {
		return input, fmt.Errorf("El evento admite un máximo de %d invitados", calendarEventMaxAttendees)
	}
	input.AttendeeIDs = attendeeIDs

	return input, nil
}

func parseCalendarRangeBoundary(value string, inclusiveEnd bool) (time.Time, error) {
	if parsed, err := time.Parse(time.RFC3339, value); err == nil {
		return parsed, nil
	}
	parsed, err := time.Parse("2006-01-02", value)
	if err != nil {
		return time.Time{}, err
	}
	if inclusiveEnd {
		parsed = parsed.AddDate(0, 0, 1)
	}
	return parsed, nil
}

func validateCalendarEmployees(db *gorm.DB, attendeeIDs []uint) error {
	var count int64
	if err := db.Model(&models.User{}).
		Where("id IN ? AND is_active = ? AND role <> ? AND deleted_at IS NULL", attendeeIDs, true, "client").
		Count(&count).Error; err != nil {
		return err
	}
	if count != int64(len(attendeeIDs)) {
		return errors.New("Uno o más participantes no están disponibles")
	}
	return nil
}

func calendarEventPreload(db *gorm.DB) *gorm.DB {
	return db.
		Preload("Organizer", func(query *gorm.DB) *gorm.DB {
			return query.Select("id, first_name, last_name, email, role, office_id")
		}).
		Preload("Attendees", func(query *gorm.DB) *gorm.DB {
			return query.Order("created_at ASC")
		}).
		Preload("Attendees.User", func(query *gorm.DB) *gorm.DB {
			return query.Select("id, first_name, last_name, email, role, office_id")
		})
}

func buildCalendarAttendees(input calendarEventInput, organizerID uint, existing map[uint]string) []models.CalendarEventAttendee {
	attendees := make([]models.CalendarEventAttendee, 0, len(input.AttendeeIDs))
	for _, userID := range input.AttendeeIDs {
		status := "pending"
		if userID == organizerID {
			status = "accepted"
		} else if previous, exists := existing[userID]; exists {
			status = previous
		}
		attendees = append(attendees, models.CalendarEventAttendee{
			UserID:         userID,
			ResponseStatus: status,
		})
	}
	return attendees
}

func notifyCalendarInvitees(db *gorm.DB, event models.CalendarEvent, organizer models.User, attendeeIDs []uint, action string) {
	link := "/app/calendar"
	organizerName := strings.TrimSpace(organizer.FirstName + " " + organizer.LastName)
	for _, attendeeID := range attendeeIDs {
		if attendeeID == organizer.ID {
			continue
		}
		message := fmt.Sprintf("%s te invitó a «%s». Consulta el calendario para ver la fecha y hora.", organizerName, event.Title)
		if action == "updated" {
			message = fmt.Sprintf("%s actualizó «%s». Consulta el calendario para ver los cambios.", organizerName, event.Title)
		} else if action == "cancelled" {
			message = fmt.Sprintf("%s canceló «%s».", organizerName, event.Title)
		} else if action == "removed" {
			message = fmt.Sprintf("%s retiró tu invitación a «%s».", organizerName, event.Title)
		}
		dedupKey := fmt.Sprintf("calendar_event:%d:%s:%d", event.ID, action, attendeeID)
		_ = CreateNotificationWithMeta(db, attendeeID, message, "info", &link, "calendar_event", &event.ID, dedupKey)
		SendUserNotification(strconv.FormatUint(uint64(attendeeID), 10), map[string]interface{}{
			"message": message, "type": "info", "link": link, "entityType": "calendar_event", "entityId": event.ID,
		})
	}
}

// GetCalendarStaff returns the minimal active employee directory needed by the attendee selector.
func GetCalendarStaff(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		if _, ok := currentCalendarUser(c); !ok {
			return
		}

		staff := make([]calendarStaffOption, 0)
		if err := db.Model(&models.User{}).
			Select("users.id, users.first_name, users.last_name, users.email, users.role, users.office_id, COALESCE(offices.name, '') AS office_name").
			Joins("LEFT JOIN offices ON offices.id = users.office_id").
			Where("users.is_active = ? AND users.role <> ? AND users.deleted_at IS NULL", true, "client").
			Order("users.first_name ASC, users.last_name ASC").
			Scan(&staff).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "No fue posible cargar el directorio de personal"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"data": staff})
	}
}

// GetCalendarEvents returns meetings organized by or addressed to the current employee.
func GetCalendarEvents(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		user, ok := currentCalendarUser(c)
		if !ok {
			return
		}

		now := time.Now().UTC()
		dateFrom := now.AddDate(0, -1, 0)
		dateTo := now.AddDate(0, 3, 0)
		var err error
		if raw := strings.TrimSpace(c.Query("dateFrom")); raw != "" {
			dateFrom, err = parseCalendarRangeBoundary(raw, false)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "dateFrom no es una fecha válida"})
				return
			}
		}
		if raw := strings.TrimSpace(c.Query("dateTo")); raw != "" {
			dateTo, err = parseCalendarRangeBoundary(raw, true)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "dateTo no es una fecha válida"})
				return
			}
		}
		if !dateTo.After(dateFrom) || dateTo.Sub(dateFrom) > calendarEventMaxRangeDays*24*time.Hour {
			c.JSON(http.StatusBadRequest, gin.H{"error": "El rango de calendario debe ser válido y no exceder 370 días"})
			return
		}

		events := make([]models.CalendarEvent, 0)
		attendeeEventIDs := db.Model(&models.CalendarEventAttendee{}).
			Select("event_id").Where("user_id = ?", user.ID)
		query := calendarEventPreload(db.Model(&models.CalendarEvent{})).
			Where("(organizer_id = ? OR id IN (?))", user.ID, attendeeEventIDs).
			Where("start_time < ? AND end_time > ?", dateTo, dateFrom).
			Order("start_time ASC").Limit(500)
		if err := query.Find(&events).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "No fue posible cargar el calendario"})
			return
		}

		c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
		c.JSON(http.StatusOK, gin.H{"data": events})
	}
}

// CreateCalendarEvent creates an employee meeting and invitations atomically.
func CreateCalendarEvent(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		organizer, ok := currentCalendarUser(c)
		if !ok {
			return
		}

		var input calendarEventInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Datos de evento inválidos"})
			return
		}
		normalized, err := normalizeCalendarEventInput(input, organizer.ID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if err := validateCalendarEmployees(db, normalized.AttendeeIDs); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		event := models.CalendarEvent{
			OrganizerID: organizer.ID,
			Title:       normalized.Title, Description: normalized.Description, Location: normalized.Location,
			StartTime: normalized.StartTime, EndTime: normalized.EndTime,
			Attendees: buildCalendarAttendees(normalized, organizer.ID, nil),
		}
		if err := db.Transaction(func(tx *gorm.DB) error {
			return tx.Create(&event).Error
		}); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "No fue posible crear el evento"})
			return
		}

		notifyCalendarInvitees(db, event, organizer, normalized.AttendeeIDs, "created")
		if err := calendarEventPreload(db).First(&event, event.ID).Error; err != nil {
			c.JSON(http.StatusCreated, event)
			return
		}
		c.JSON(http.StatusCreated, event)
	}
}

// UpdateCalendarEvent allows the organizer (or an administrator) to update a meeting.
func UpdateCalendarEvent(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		user, ok := currentCalendarUser(c)
		if !ok {
			return
		}

		var event models.CalendarEvent
		if err := db.Preload("Attendees").First(&event, c.Param("id")).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Evento no encontrado"})
			return
		}
		if event.OrganizerID != user.ID && user.Role != config.RoleAdmin {
			c.JSON(http.StatusForbidden, gin.H{"error": "Solo el organizador puede editar este evento"})
			return
		}

		var patch updateCalendarEventInput
		if err := c.ShouldBindJSON(&patch); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Datos de evento inválidos"})
			return
		}
		attendeeIDs := make([]uint, 0, len(event.Attendees))
		existingResponses := make(map[uint]string, len(event.Attendees))
		for _, attendee := range event.Attendees {
			attendeeIDs = append(attendeeIDs, attendee.UserID)
			existingResponses[attendee.UserID] = attendee.ResponseStatus
		}
		input := calendarEventInput{
			Title: event.Title, Description: event.Description, Location: event.Location,
			StartTime: event.StartTime, EndTime: event.EndTime, AttendeeIDs: attendeeIDs,
		}
		if patch.Title != nil {
			input.Title = *patch.Title
		}
		if patch.Description != nil {
			input.Description = *patch.Description
		}
		if patch.Location != nil {
			input.Location = *patch.Location
		}
		if patch.StartTime != nil {
			input.StartTime = *patch.StartTime
		}
		if patch.EndTime != nil {
			input.EndTime = *patch.EndTime
		}
		if patch.AttendeeIDs != nil {
			input.AttendeeIDs = *patch.AttendeeIDs
		}

		normalized, err := normalizeCalendarEventInput(input, event.OrganizerID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if err := validateCalendarEmployees(db, normalized.AttendeeIDs); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		removedAttendeeIDs := make([]uint, 0)
		if patch.AttendeeIDs != nil {
			nextAttendees := make(map[uint]struct{}, len(normalized.AttendeeIDs))
			for _, attendeeID := range normalized.AttendeeIDs {
				nextAttendees[attendeeID] = struct{}{}
			}
			for attendeeID := range existingResponses {
				if attendeeID == event.OrganizerID {
					continue
				}
				if _, remainsInvited := nextAttendees[attendeeID]; !remainsInvited {
					removedAttendeeIDs = append(removedAttendeeIDs, attendeeID)
				}
			}
		}

		err = db.Transaction(func(tx *gorm.DB) error {
			updates := map[string]interface{}{
				"title": normalized.Title, "description": normalized.Description, "location": normalized.Location,
				"start_time": normalized.StartTime, "end_time": normalized.EndTime,
			}
			if err := tx.Model(&event).Updates(updates).Error; err != nil {
				return err
			}
			if patch.AttendeeIDs != nil {
				if err := tx.Where("event_id = ?", event.ID).Delete(&models.CalendarEventAttendee{}).Error; err != nil {
					return err
				}
				attendees := buildCalendarAttendees(normalized, event.OrganizerID, existingResponses)
				for index := range attendees {
					attendees[index].EventID = event.ID
				}
				if err := tx.Create(&attendees).Error; err != nil {
					return err
				}
			}
			return nil
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "No fue posible actualizar el evento"})
			return
		}

		event.Title, event.Description, event.Location = normalized.Title, normalized.Description, normalized.Location
		event.StartTime, event.EndTime = normalized.StartTime, normalized.EndTime
		notifyCalendarInvitees(db, event, user, normalized.AttendeeIDs, "updated")
		if len(removedAttendeeIDs) > 0 {
			notifyCalendarInvitees(db, event, user, removedAttendeeIDs, "removed")
		}
		if err := calendarEventPreload(db).First(&event, event.ID).Error; err != nil {
			c.JSON(http.StatusOK, event)
			return
		}
		c.JSON(http.StatusOK, event)
	}
}

// RespondToCalendarEvent updates only the current attendee's invitation state.
func RespondToCalendarEvent(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		user, ok := currentCalendarUser(c)
		if !ok {
			return
		}
		var input calendarEventResponseInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Respuesta inválida"})
			return
		}
		input.ResponseStatus = strings.ToLower(strings.TrimSpace(input.ResponseStatus))
		if _, valid := validCalendarResponses[input.ResponseStatus]; !valid {
			c.JSON(http.StatusBadRequest, gin.H{"error": "La respuesta debe ser accepted, tentative o declined"})
			return
		}

		var event models.CalendarEvent
		if err := db.First(&event, c.Param("id")).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Evento no encontrado"})
			return
		}
		if event.OrganizerID == user.ID && input.ResponseStatus != "accepted" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "El organizador no puede rechazar su propio evento"})
			return
		}
		result := db.Model(&models.CalendarEventAttendee{}).
			Where("event_id = ? AND user_id = ?", event.ID, user.ID).
			Update("response_status", input.ResponseStatus)
		if result.Error != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "No fue posible actualizar la respuesta"})
			return
		}
		if result.RowsAffected == 0 {
			c.JSON(http.StatusForbidden, gin.H{"error": "No eres participante de este evento"})
			return
		}

		if event.OrganizerID != user.ID {
			link := "/app/calendar"
			statusLabel := map[string]string{"accepted": "aceptó", "tentative": "marcó como tentativa", "declined": "rechazó"}[input.ResponseStatus]
			message := fmt.Sprintf("%s %s la invitación a «%s».", strings.TrimSpace(user.FirstName+" "+user.LastName), statusLabel, event.Title)
			_ = CreateNotificationWithMeta(db, event.OrganizerID, message, "info", &link, "calendar_event", &event.ID, "")
			SendUserNotification(strconv.FormatUint(uint64(event.OrganizerID), 10), map[string]interface{}{
				"message": message, "type": "info", "link": link, "entityType": "calendar_event", "entityId": event.ID,
			})
		}
		c.JSON(http.StatusOK, gin.H{"responseStatus": input.ResponseStatus})
	}
}

// DeleteCalendarEvent soft-deletes a meeting for every attendee.
func DeleteCalendarEvent(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		user, ok := currentCalendarUser(c)
		if !ok {
			return
		}
		var event models.CalendarEvent
		if err := db.Preload("Attendees").First(&event, c.Param("id")).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Evento no encontrado"})
			return
		}
		if event.OrganizerID != user.ID && user.Role != config.RoleAdmin {
			c.JSON(http.StatusForbidden, gin.H{"error": "Solo el organizador puede cancelar este evento"})
			return
		}
		if err := db.Delete(&event).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "No fue posible cancelar el evento"})
			return
		}
		attendeeIDs := make([]uint, 0, len(event.Attendees))
		for _, attendee := range event.Attendees {
			attendeeIDs = append(attendeeIDs, attendee.UserID)
		}
		notifyCalendarInvitees(db, event, user, attendeeIDs, "cancelled")
		c.Status(http.StatusNoContent)
	}
}
