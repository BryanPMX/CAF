package handlers

import (
	"net/http"

	"github.com/BryanPMX/CAF/api/config"
	"github.com/BryanPMX/CAF/api/models"
	"github.com/BryanPMX/CAF/api/services"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Direct appointments keep the company's real client ID and never create a case.
func createDirectClientAppointment(db *gorm.DB, c *gin.Context, input SmartAppointmentInput, actor models.User) {
	var appointment models.Appointment
	err := db.Transaction(func(tx *gorm.DB) error {
		var client, staff models.User
		if err := tx.Where("id = ? AND office_id = ? AND role = ? AND client_type = ? AND is_active = ?", *input.ClientID, input.OfficeID, "client", models.ClientOrganization, true).First(&client).Error; err != nil {
			return services.InvalidOrganization("Seleccione la cuenta de una constructora activa")
		}
		if client.OfficeID == nil || *client.OfficeID != input.OfficeID {
			return services.InvalidOrganization("La cita debe usar la oficina de la constructora")
		}
		if !config.CanAccessAllOffices(actor.Role) && (actor.OfficeID == nil || *actor.OfficeID != input.OfficeID) {
			return services.InvalidOrganization("Oficina fuera de su alcance")
		}
		var company models.Organization
		if err := tx.Where("account_client_id = ? AND kind = ?", client.ID, models.OrganizationContractor).First(&company).Error; err != nil {
			return services.InvalidOrganization("Constructora no disponible")
		}
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ? AND role <> ? AND is_active = ?", input.StaffID, "client", true).First(&staff).Error; err != nil {
			return services.InvalidOrganization("Personal no disponible")
		}
		if staff.OfficeID == nil || *staff.OfficeID != input.OfficeID {
			return services.InvalidOrganization("El personal debe pertenecer a la oficina de la cita")
		}
		busy, err := employeeBusyIntervals(tx, staff.ID, input.StartTime, input.EndTime)
		if err != nil {
			return err
		}
		if len(busy) > 0 {
			return services.InvalidOrganization("El personal no está disponible en ese horario")
		}
		appointment = models.Appointment{ClientID: &client.ID, StaffID: staff.ID, OfficeID: input.OfficeID, Title: input.Title, StartTime: input.StartTime, EndTime: input.EndTime, Status: config.AppointmentStatus(input.Status), Category: input.Category, Department: input.Department}
		return tx.Create(&appointment).Error
	})
	if err != nil {
		organizationFailure(c, err)
		return
	}
	if err := db.Preload("Client").Preload("Staff").Preload("Office").First(&appointment, appointment.ID).Error; err != nil {
		c.JSON(500, gin.H{"error": "No se pudo cargar la cita"})
		return
	}
	BroadcastNotification(gin.H{"type": "appointment_created"})
	c.JSON(http.StatusCreated, appointment)
}
