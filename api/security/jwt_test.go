package security

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestIssueAndParseJWT(t *testing.T) {
	now := time.Date(2026, time.August, 10, 12, 0, 0, 0, time.UTC)
	token, expiresAt, err := IssueJWT("0123456789abcdef0123456789abcdef", 42, now)
	if err != nil {
		t.Fatal(err)
	}
	if expiresAt.Sub(now) != JWTLifetime {
		t.Fatalf("unexpected lifetime: %s", expiresAt.Sub(now))
	}
	subject, err := ParseJWT(token, "0123456789abcdef0123456789abcdef", now.Add(time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	if subject != "42" {
		t.Fatalf("subject = %q, want 42", subject)
	}
}

func TestParseJWTRejectsWrongAlgorithmAndMissingClaims(t *testing.T) {
	now := time.Now().UTC()
	claims := jwt.RegisteredClaims{
		Subject:   "42",
		ExpiresAt: jwt.NewNumericDate(now.Add(time.Hour)),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS384, claims)
	signed, err := token.SignedString([]byte("0123456789abcdef0123456789abcdef"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ParseJWT(signed, "0123456789abcdef0123456789abcdef", now); err == nil {
		t.Fatal("expected token to be rejected")
	}
}
