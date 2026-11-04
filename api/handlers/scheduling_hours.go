package handlers

import (
	"fmt"
	"time"
)

type scheduleKind string

const (
	clientSchedule   scheduleKind = "client"
	internalSchedule scheduleKind = "internal"
)

// Both policies use local wall time. The entire event must fit in one day's window.
func validateWorkingHours(start, end time.Time, zone string, kind scheduleKind) error {
	if start.IsZero() || !end.After(start) {
		return fmt.Errorf("Seleccione un horario válido")
	}
	location := start.Location()
	if zone != "" {
		var err error
		location, err = time.LoadLocation(zone)
		if err != nil {
			return fmt.Errorf("Zona horaria inválida")
		}
	}
	localStart := start.In(location)
	opening, closing := 9, 18
	label := "Lunes a Viernes 09:00–18:00; Sábado 08:00–15:00"
	if kind == internalSchedule {
		opening, closing = 7, 20
		label = "Lunes a Viernes 07:00–20:00; Sábado 08:00–15:00"
	}
	if localStart.Weekday() == time.Saturday {
		opening, closing = 8, 15
	}
	open := time.Date(localStart.Year(), localStart.Month(), localStart.Day(), opening, 0, 0, 0, location)
	close := time.Date(localStart.Year(), localStart.Month(), localStart.Day(), closing, 0, 0, 0, location)
	if localStart.Weekday() == time.Sunday || start.Before(open) || end.After(close) {
		return fmt.Errorf("Horario permitido: %s. Inicio y fin deben ser el mismo día", label)
	}
	return nil
}
