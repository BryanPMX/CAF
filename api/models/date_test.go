package models

import (
	"testing"
	"time"
)

func TestDatePreservesCalendarDayAcrossDatabaseDrivers(t *testing.T) {
	for _, value := range []interface{}{"1978-07-07", []byte("1978-07-07"), time.Date(1978, 7, 7, 0, 0, 0, 0, time.FixedZone("source", -7*3600))} {
		var date Date
		if err := date.Scan(value); err != nil || string(date) != "1978-07-07" {
			t.Fatalf("scan %v: %s %v", value, date, err)
		}
		v, err := date.Value()
		if err != nil || v != "1978-07-07" {
			t.Fatal("date changed during persistence")
		}
	}
	var invalid Date
	if invalid.Scan("2026-02-31") == nil {
		t.Fatal("accepted impossible date")
	}
}
