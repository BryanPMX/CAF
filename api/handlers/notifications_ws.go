package handlers

import (
	"net/http"
	"sync"

	"github.com/BryanPMX/CAF/api/services"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/net/websocket"
)

// Simple in-memory subscription registry: userID -> set of connections
var (
	userConnMu sync.RWMutex
	userConns  = map[string]map[*websocket.Conn]struct{}{}
)

// NotificationsWebSocket handles per-user WebSocket connections.
// Auth via JWT token passed as query param `token`.
func NotificationsWebSocket(jwtSecret string, sessionService *services.SessionService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Validate JWT from query param
		tokenStr := c.Query("token")
		if tokenStr == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing token"})
			return
		}

		token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
			return []byte(jwtSecret), nil
		})
		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid claims"})
			return
		}

		userID, _ := claims["sub"].(string)
		if userID == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid subject"})
			return
		}

		// Validate session via hashed token
		hash := sessionService.HashToken(tokenStr)
		if _, err := sessionService.ValidateSession(hash); err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid session"})
			return
		}

		handler := websocket.Handler(func(conn *websocket.Conn) {
			registerConn(userID, conn)
			defer unregisterConn(userID, conn)

			for {
				var msg map[string]any
				if err := websocket.JSON.Receive(conn, &msg); err != nil {
					break
				}
				_ = websocket.JSON.Send(conn, gin.H{"type": "ack"})
			}
		})

		handler.ServeHTTP(c.Writer, c.Request)
	}
}

func registerConn(userID string, conn *websocket.Conn) {
	userConnMu.Lock()
	defer userConnMu.Unlock()
	set, ok := userConns[userID]
	if !ok {
		set = map[*websocket.Conn]struct{}{}
		userConns[userID] = set
	}
	set[conn] = struct{}{}
}

func unregisterConn(userID string, conn *websocket.Conn) {
	userConnMu.Lock()
	defer userConnMu.Unlock()
	if set, ok := userConns[userID]; ok {
		delete(set, conn)
		_ = conn.Close()
		if len(set) == 0 {
			delete(userConns, userID)
		}
	}
}

// SendUserNotification allows other handlers to push a notification to a user.
func SendUserNotification(userID string, payload any) {
	userConnMu.RLock()
	defer userConnMu.RUnlock()
	if set, ok := userConns[userID]; ok {
		for conn := range set {
			_ = websocket.JSON.Send(conn, gin.H{"type": "notification", "notification": payload})
		}
	}
}
