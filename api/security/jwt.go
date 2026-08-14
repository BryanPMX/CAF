package security

import (
	"fmt"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	JWTIssuer   = "caf-api"
	JWTAudience = "caf-clients"
	JWTLifetime = 24 * time.Hour
)

func IssueJWT(secret string, userID uint, now time.Time) (string, time.Time, error) {
	now = now.UTC()
	expiresAt := now.Add(JWTLifetime)
	claims := jwt.RegisteredClaims{
		Issuer:    JWTIssuer,
		Audience:  jwt.ClaimStrings{JWTAudience},
		Subject:   strconv.FormatUint(uint64(userID), 10),
		ExpiresAt: jwt.NewNumericDate(expiresAt),
		NotBefore: jwt.NewNumericDate(now),
		IssuedAt:  jwt.NewNumericDate(now),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		return "", time.Time{}, fmt.Errorf("sign JWT: %w", err)
	}
	return signed, expiresAt, nil
}

func ParseJWT(tokenString, secret string, now time.Time) (string, error) {
	claims := &jwt.RegisteredClaims{}
	token, err := jwt.ParseWithClaims(
		tokenString,
		claims,
		func(token *jwt.Token) (interface{}, error) {
			if token.Method != jwt.SigningMethodHS256 {
				return nil, fmt.Errorf("unexpected signing method")
			}
			return []byte(secret), nil
		},
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithIssuer(JWTIssuer),
		jwt.WithAudience(JWTAudience),
		jwt.WithExpirationRequired(),
		jwt.WithTimeFunc(func() time.Time { return now.UTC() }),
	)
	if err != nil || !token.Valid {
		return "", fmt.Errorf("invalid token")
	}
	if claims.Subject == "" {
		return "", fmt.Errorf("missing subject")
	}
	if _, err := strconv.ParseUint(claims.Subject, 10, 32); err != nil {
		return "", fmt.Errorf("invalid subject")
	}
	return claims.Subject, nil
}
