package security

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"strings"
	"unicode"
	"unicode/utf8"

	"golang.org/x/crypto/bcrypt"
)

const (
	MinPasswordLength = 12
	MaxPasswordBytes  = 72 // bcrypt ignores input after 72 bytes
)

var blockedPasswords = map[string]struct{}{
	"admin123":           {},
	"defaultpassword123": {},
	"password123":        {},
	"password123!":       {},
	"temppassword123!":   {},
}

// ValidatePassword enforces the password policy used by privileged account
// creation and the explicit bootstrap flow.
func ValidatePassword(password string) error {
	if len(password) > MaxPasswordBytes {
		return fmt.Errorf("password must be at most %d bytes", MaxPasswordBytes)
	}
	if utf8.RuneCountInString(password) < MinPasswordLength {
		return fmt.Errorf("password must be at least %d characters", MinPasswordLength)
	}
	if _, blocked := blockedPasswords[strings.ToLower(strings.TrimSpace(password))]; blocked {
		return fmt.Errorf("password is a known insecure default")
	}

	var lower, upper, digit, symbol bool
	for _, r := range password {
		switch {
		case unicode.IsLower(r):
			lower = true
		case unicode.IsUpper(r):
			upper = true
		case unicode.IsDigit(r):
			digit = true
		case unicode.IsPunct(r) || unicode.IsSymbol(r):
			symbol = true
		}
	}
	if !lower || !upper || !digit || !symbol {
		return fmt.Errorf("password must include uppercase, lowercase, number, and symbol")
	}
	return nil
}

func HashPassword(password string) (string, error) {
	if err := ValidatePassword(password); err != nil {
		return "", err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("hash password: %w", err)
	}
	return string(hash), nil
}

// HashRandomPassword creates an inaccessible, high-entropy credential for
// accounts that must not be usable until an administrator explicitly sets a
// password through an approved provisioning flow.
func HashRandomPassword() (string, error) {
	randomBytes := make([]byte, 32)
	if _, err := rand.Read(randomBytes); err != nil {
		return "", fmt.Errorf("generate random password: %w", err)
	}
	randomPassword := base64.RawURLEncoding.EncodeToString(randomBytes)
	hash, err := bcrypt.GenerateFromPassword([]byte(randomPassword), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("hash random password: %w", err)
	}
	return string(hash), nil
}
