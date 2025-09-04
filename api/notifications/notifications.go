// api/utils/notifications/notifications.go
package notifications

import (
	"log"
	"time"

	"github.com/BryanPMX/CAF/api/models"
)

// SendAppointmentConfirmation is a placeholder function for sending notifications.
// In a real application, this would integrate with an email service (like SendGrid)
// or an SMS service (like Twilio).
func SendAppointmentConfirmation(appointment models.Appointment, client models.User) {
	// For now, we just print a log message to simulate the action.
	log.Printf("--- NOTIFICATION SIMULATION ---")
	log.Printf("To: %s", client.Email)
	log.Printf("Subject: Confirmación de su Cita en CAF")
	log.Printf("Body: Hola %s, su cita para '%s' ha sido programada para el %s.",
		client.FirstName,
		appointment.Title,
		appointment.StartTime.Format(time.RFC822),
	)
	log.Printf("-----------------------------")
}
