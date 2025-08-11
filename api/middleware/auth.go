/*
Package middleware contains Gin middleware functions. Middleware are functions
that are executed on a request before it reaches the final route handler.
They are perfect for handling cross-cutting concerns like authentication,
logging, and rate-limiting.
*/
package middleware

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// JWTAuth is a middleware that validates a JSON Web Token (JWT) from the
// Authorization header. If the token is valid, it extracts the user ID
// from the token's claims and adds it to the request context.
func JWTAuth(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Step 1: Extract the token from the Authorization header.
		// The header is expected to be in the format "Bearer <token>".
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authorization header is required"})
			return
		}

		// The token string is the part after "Bearer ".
		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == authHeader { // If no "Bearer " prefix was found
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token format"})
			return
		}

		// Step 2: Parse and validate the token.
		// jwt.Parse checks the token's signature, expiration time, and format.
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			// Ensure the signing method is what we expect (HS256).
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			// Return the secret key for validation.
			return []byte(jwtSecret), nil
		})

		// If there was an error during parsing or the token is not valid.
		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			return
		}

		// Step 3: Extract claims and set user ID in the context.
		// If the token is valid, we can access the claims we stored in it.
		if claims, ok := token.Claims.(jwt.MapClaims); ok {
			// The 'sub' (Subject) claim contains our user ID.
			userID, ok := claims["sub"].(string)
			if !ok {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token claims"})
				return
			}

			// We add the user ID to the Gin context.
			// This allows subsequent handlers in the chain to know which user is making the request.
			c.Set("userID", userID)

			// The request is valid, so we call c.Next() to pass it to the next handler.
			c.Next()
		} else {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token claims"})
		}
	}
}
