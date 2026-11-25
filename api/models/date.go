package models

import (
	"database/sql/driver"
	"fmt"
	"time"
)

// Date preserves date-only values across PostgreSQL, SQLite and JSON.
type Date string

func (d *Date) Scan(value interface{}) error {
	if value == nil {
		*d = ""
		return nil
	}
	var text string
	switch v := value.(type) {
	case time.Time:
		text = v.Format("2006-01-02")
	case string:
		text = v
	case []byte:
		text = string(v)
	default:
		return fmt.Errorf("unsupported date type %T", value)
	}
	if len(text) > 10 {
		text = text[:10]
	}
	if _, err := time.Parse("2006-01-02", text); err != nil {
		return err
	}
	*d = Date(text)
	return nil
}
func (d Date) Value() (driver.Value, error) {
	if d == "" {
		return nil, nil
	}
	if _, err := time.Parse("2006-01-02", string(d)); err != nil {
		return nil, err
	}
	return string(d), nil
}
func DatePointer(value *string) *Date {
	if value == nil {
		return nil
	}
	date := Date(*value)
	return &date
}
