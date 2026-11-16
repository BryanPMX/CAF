// Package handlers: profile endpoints for current user (avatar, update).
package handlers

import (
	"crypto/sha256"
	"encoding/hex"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/BryanPMX/CAF/api/config"
	"github.com/BryanPMX/CAF/api/models"
	securityutil "github.com/BryanPMX/CAF/api/security"
	"github.com/BryanPMX/CAF/api/storage"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const maxAvatarURLLen = 512

// isSafeAvatarURL returns true only for http/https URLs to prevent javascript:, data:, etc.
func isSafeAvatarURL(s string) bool {
	s = strings.TrimSpace(s)
	if len(s) > maxAvatarURLLen {
		return false
	}
	parsed, err := url.ParseRequestURI(s)
	return err == nil && parsed.Hostname() != "" && (strings.EqualFold(parsed.Scheme, "https") || strings.EqualFold(parsed.Scheme, "http"))
}

// ProfileResponse is the shared, explicit self-profile contract for staff and clients.
// Credential, payment and private address fields are intentionally excluded.
type ProfileResponse struct {
	UserID       string         `json:"userID"`
	Role         string         `json:"role"`
	FirstName    string         `json:"firstName"`
	LastName     string         `json:"lastName"`
	Email        string         `json:"email"`
	Phone        string         `json:"phone"`
	Department   *string        `json:"department"`
	Specialty    *string        `json:"specialty"`
	Office       *models.Office `json:"office"`
	OfficeID     *uint          `json:"officeId"`
	AvatarURL    string         `json:"avatarUrl"`
	IsActive     bool           `json:"isActive"`
	CreatedAt    time.Time      `json:"createdAt"`
	LastLogin    *time.Time     `json:"lastLogin"`
	AvatarPolicy struct {
		MaxBytes         int64    `json:"maxBytes"`
		MaxURLBytes      int      `json:"maxURLBytes"`
		AllowedMIMETypes []string `json:"allowedMimeTypes"`
	} `json:"avatarPolicy"`
}

// GetProfile uses the database-backed actor set by DataAccessControl. Reading a
// profile never changes last_login; only successful sign-in records that time.
func GetProfile(baseURL string, avatarPaths ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		value, exists := c.Get("currentUser")
		user, ok := value.(models.User)
		if !exists || !ok || !user.IsActive {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "No autenticado"})
			return
		}
		response := ProfileResponse{
			UserID: strconv.FormatUint(uint64(user.ID), 10), Role: user.Role,
			FirstName: user.FirstName, LastName: user.LastName, Email: user.Email, Phone: user.Phone,
			Department: user.Department, Specialty: user.Specialty,
			Office: user.Office, OfficeID: user.OfficeID,
			AvatarURL: BuildProfileAvatarURL(user.AvatarURL, baseURL, avatarPaths...),
			IsActive:  user.IsActive, CreatedAt: user.CreatedAt, LastLogin: user.LastLogin,
		}
		if config.CanAccessAllOffices(user.Role) {
			response.Office = nil
			response.OfficeID = nil
		}
		response.AvatarPolicy.MaxBytes = securityutil.MaxImageBytes
		response.AvatarPolicy.MaxURLBytes = maxAvatarURLLen
		response.AvatarPolicy.AllowedMIMETypes = securityutil.ImageUploadMIMETypes()
		c.Header("Cache-Control", "private, no-store")
		c.JSON(http.StatusOK, response)
	}
}

// ProfileUpdateInput is the body for PATCH /profile (optional fields).
type ProfileUpdateInput struct {
	AvatarURL *string `json:"avatarUrl"` // set URL (external or clear with empty string)
}

// UpdateProfile updates the current user's profile (e.g. avatar URL). PATCH /profile
func UpdateProfile(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "No autenticado"})
			return
		}
		uidStr, _ := userID.(string)
		uid, err := strconv.ParseUint(uidStr, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ID de usuario inválido"})
			return
		}

		var input ProfileUpdateInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
			return
		}

		var user models.User
		if err := db.First(&user, uid).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Usuario no encontrado"})
			return
		}
		previousAvatarURL := user.AvatarURL

		if input.AvatarURL != nil {
			s := strings.TrimSpace(*input.AvatarURL)
			if s == "" {
				user.AvatarURL = nil
			} else {
				if !isSafeAvatarURL(s) {
					c.JSON(http.StatusBadRequest, gin.H{"error": "URL no válida. Use solo enlaces http o https (máx. 512 caracteres)."})
					return
				}
				user.AvatarURL = &s
			}
		}
		if err := db.Model(&user).Update("avatar_url", user.AvatarURL).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al actualizar perfil"})
			return
		}
		deleteReplacedLocalAvatar(storage.GetActiveStorage(), previousAvatarURL, user.AvatarURL)

		c.JSON(http.StatusOK, gin.H{
			"message":   "Perfil actualizado",
			"avatarUrl": user.AvatarURL,
		})
	}
}

// UploadProfileAvatar accepts a multipart image and sets it as the current user's avatar. POST /profile/avatar
func UploadProfileAvatar(db *gorm.DB, baseURL string, avatarPaths ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "No autenticado"})
			return
		}
		uidStr, _ := userID.(string)
		uid, err := strconv.ParseUint(uidStr, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ID de usuario inválido"})
			return
		}

		var user models.User
		if err := db.Select("avatar_url").First(&user, uid).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Usuario no encontrado"})
			return
		}

		file, err := c.FormFile("avatar")
		if err != nil || file == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Se requiere un archivo 'avatar'"})
			return
		}
		detectedType, err := securityutil.ValidateImageUpload(file)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		file.Header.Set("Content-Type", detectedType)

		st := storage.GetActiveStorage()
		if st == nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Almacenamiento no configurado"})
			return
		}
		avatarURL, err := st.UploadAvatar(file, uidStr)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al subir la imagen"})
			return
		}

		if err := db.Model(&models.User{}).Where("id = ?", uid).Update("avatar_url", avatarURL).Error; err != nil {
			// The database remains authoritative. Remove the new file if its
			// reference could not be persisted.
			_ = st.Delete(avatarURL)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al guardar avatar"})
			return
		}
		newAvatarURL := &avatarURL
		deleteReplacedLocalAvatar(st, user.AvatarURL, newAvatarURL)

		// Return a versioned protected endpoint for local storage. The version
		// changes with each immutable file reference, so clients refresh now and
		// can safely cache it across sessions afterward.
		displayURL := BuildProfileAvatarURL(newAvatarURL, baseURL, avatarPaths...)
		c.JSON(http.StatusOK, gin.H{
			"message":   "Avatar actualizado",
			"avatarUrl": displayURL,
		})
	}
}

// GetProfileAvatar streams the current user's avatar image. GET /avatar
func GetProfileAvatar(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "No autenticado"})
			return
		}
		var user models.User
		if err := db.Select("avatar_url").First(&user, userID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Usuario no encontrado"})
			return
		}
		if user.AvatarURL == nil || *user.AvatarURL == "" {
			c.Status(http.StatusNotFound)
			return
		}
		url := *user.AvatarURL
		if strings.HasPrefix(url, "http://") || strings.HasPrefix(url, "https://") {
			c.Redirect(http.StatusFound, url)
			return
		}
		st := storage.GetActiveStorage()
		if st == nil {
			c.Status(http.StatusNotFound)
			return
		}
		rc, contentType, err := st.Get(url)
		if err != nil {
			c.Status(http.StatusNotFound)
			return
		}
		defer rc.Close()
		if c.Query("v") == avatarVersion(url) {
			c.Header("Cache-Control", "private, max-age=31536000, immutable")
		} else {
			c.Header("Cache-Control", "private, no-store")
		}
		c.DataFromReader(http.StatusOK, -1, contentType, rc, nil)
	}
}

// BuildProfileAvatarURL returns the URL the frontend should use for the current user's avatar.
// If avatar is stored locally, it returns a versioned, authenticated API URL.
func BuildProfileAvatarURL(avatarURL *string, baseURL string, avatarPaths ...string) string {
	if avatarURL == nil || *avatarURL == "" {
		return ""
	}
	s := *avatarURL
	if storage.IsLocalURL(s) {
		avatarPath := "/api/v1/avatar"
		if len(avatarPaths) > 0 && strings.HasPrefix(avatarPaths[0], "/") {
			avatarPath = avatarPaths[0]
		}
		versionedPath := avatarPath + "?v=" + avatarVersion(s)
		if baseURL != "" {
			return strings.TrimSuffix(baseURL, "/") + versionedPath
		}
		return versionedPath
	}
	return s
}

func avatarVersion(storedURL string) string {
	sum := sha256.Sum256([]byte(storedURL))
	return hex.EncodeToString(sum[:8])
}

func deleteReplacedLocalAvatar(st storage.FileStorage, previous, current *string) {
	if st == nil || previous == nil || *previous == "" || !storage.IsLocalURL(*previous) {
		return
	}
	if current != nil && *current == *previous {
		return
	}
	if err := st.Delete(*previous); err != nil {
		log.Printf("WARN: Failed to remove replaced local avatar: %v", err)
	}
}
