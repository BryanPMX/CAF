package handlers

import (
	"net/http"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/net/websocket"
)

// Simple in-memory subscription registry: userID -> set of connections
var (
	UserConnMu sync.RWMutex
	UserConns  = map[string]map[*websocket.Conn]struct{}{}
)

// NotificationsWebSocket handles per-user WebSocket connections.
// Auth via JWT token passed as query param `token` (stateless).
func NotificationsWebSocket(jwtSecret string) gin.HandlerFunc {
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

		// In stateless JWT system, token validation is sufficient
		// No additional session validation needed

		handler := websocket.Handler(func(conn *websocket.Conn) {
			RegisterConn(userID, conn)
			defer UnregisterConn(userID, conn)

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

func RegisterConn(userID string, conn *websocket.Conn) {
	UserConnMu.Lock()
	defer UserConnMu.Unlock()
	set, ok := UserConns[userID]
	if !ok {
		set = map[*websocket.Conn]struct{}{}
		UserConns[userID] = set
	}
	set[conn] = struct{}{}
}

func UnregisterConn(userID string, conn *websocket.Conn) {
	UserConnMu.Lock()
	defer UserConnMu.Unlock()
	if set, ok := UserConns[userID]; ok {
		delete(set, conn)
		_ = conn.Close()
		if len(set) == 0 {
			delete(UserConns, userID)
		}
	}
}

// SendUserNotification allows other handlers to push a notification to a user.
func SendUserNotification(userID string, payload any) {
	UserConnMu.RLock()
	defer UserConnMu.RUnlock()
	if set, ok := UserConns[userID]; ok {
		for conn := range set {
			_ = websocket.JSON.Send(conn, gin.H{"type": "notification", "notification": payload})
		}
	}
}

// BroadcastNotification sends a notification to all connected users
func BroadcastNotification(payload any) {
	UserConnMu.RLock()
	defer UserConnMu.RUnlock()
	for userID := range UserConns {
		if set, ok := UserConns[userID]; ok {
			for conn := range set {
				_ = websocket.JSON.Send(conn, gin.H{"type": "notification", "notification": payload})
			}
		}
	}
}
