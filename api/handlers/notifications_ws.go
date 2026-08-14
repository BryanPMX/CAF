package handlers

import (
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/BryanPMX/CAF/api/models"
	securityutil "github.com/BryanPMX/CAF/api/security"
	"github.com/gin-gonic/gin"
	"golang.org/x/net/websocket"
	"gorm.io/gorm"
)

// Simple in-memory subscription registry: userID -> set of connections
var (
	UserConnMu sync.RWMutex
	UserConns  = map[string]map[*websocket.Conn]struct{}{}
)

// NotificationsWebSocket handles per-user WebSocket connections.
// Auth uses a WebSocket subprotocol instead of a URL query parameter so JWTs
// are not copied into proxy access logs, browser history, or analytics.
func NotificationsWebSocket(database *gorm.DB, jwtSecret string, allowedOrigins []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		protocol, tokenStr := websocketTokenProtocol(c.GetHeader("Sec-WebSocket-Protocol"))
		if tokenStr == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing token"})
			return
		}

		userID, err := securityutil.ParseJWT(tokenStr, jwtSecret, time.Now())
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}

		// JWTs are intentionally short-lived, but a disabled/deleted account must
		// lose WebSocket access immediately rather than when its token expires.
		var user models.User
		if err := database.Select("id", "is_active").First(&user, userID).Error; err != nil || !user.IsActive {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "account is not active"})
			return
		}

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

		server := websocket.Server{
			Handler: handler,
			Handshake: func(config *websocket.Config, request *http.Request) error {
				origin, err := websocket.Origin(config, request)
				if err != nil {
					return err
				}
				if origin != nil && !originAllowed(origin.Scheme+"://"+origin.Host, allowedOrigins) {
					return fmt.Errorf("origin not allowed")
				}
				config.Origin = origin
				config.Protocol = []string{protocol}
				return nil
			},
		}
		server.ServeHTTP(c.Writer, c.Request)
	}
}

const websocketJWTProtocolPrefix = "caf.jwt."

func websocketTokenProtocol(header string) (string, string) {
	for _, item := range strings.Split(header, ",") {
		protocol := strings.TrimSpace(item)
		if strings.HasPrefix(protocol, websocketJWTProtocolPrefix) {
			return protocol, strings.TrimPrefix(protocol, websocketJWTProtocolPrefix)
		}
	}
	return "", ""
}

func originAllowed(origin string, allowed []string) bool {
	for _, candidate := range allowed {
		candidate = strings.TrimSuffix(strings.TrimSpace(candidate), "/")
		if candidate == "*" || strings.EqualFold(candidate, origin) {
			return true
		}
	}
	return false
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
