// Package handlers: profile endpoints for current user (avatar, update).
package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/BryanPMX/CAF/api/models"
	"github.com/BryanPMX/CAF/api/storage"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const maxAvatarURLLen = 512

// isSafeAvatarURL returns true only for http/https URLs to prevent javascript:, data:, etc.
func isSafeAvatarURL(s string) bool {
	s = strings.TrimSpace(s)
	if len(s) > maxAvatarURLLen || len(s) < 12 {
		return false
	}
	lower := strings.ToLower(s)
	return strings.HasPrefix(lower, "https://") || strings.HasPrefix(lower, "http://")
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

		c.JSON(http.StatusOK, gin.H{
			"message":   "Perfil actualizado",
			"avatarUrl": user.AvatarURL,
		})
	}
}

// UploadProfileAvatar accepts a multipart image and sets it as the current user's avatar. POST /profile/avatar
func UploadProfileAvatar(db *gorm.DB, baseURL string) gin.HandlerFunc {
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

		file, err := c.FormFile("avatar")
		if err != nil || file == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Se requiere un archivo 'avatar'"})
			return
		}
		// Basic image type check
		ct := file.Header.Get("Content-Type")
		allowed := map[string]bool{
			"image/jpeg": true, "image/png": true, "image/gif": true, "image/webp": true,
		}
		if !allowed[ct] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Solo se permiten imágenes (JPEG, PNG, GIF, WebP)"})
			return
		}

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
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al guardar avatar"})
			return
		}

		// Return URL the client can use: for local storage, that's the API avatar endpoint
		displayURL := avatarURL
		if storage.IsLocalURL(avatarURL) && baseURL != "" {
			displayURL = strings.TrimSuffix(baseURL, "/") + "/api/v1/avatar"
		}
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
		c.DataFromReader(http.StatusOK, -1, contentType, rc, nil)
	}
}

// BuildProfileAvatarURL returns the URL the frontend should use for the current user's avatar.
// If avatar is stored locally, returns baseURL + "/api/v1/avatar" or "/api/v1/avatar" when baseURL is empty.
func BuildProfileAvatarURL(avatarURL *string, baseURL string) string {
	if avatarURL == nil || *avatarURL == "" {
		return ""
	}
	s := *avatarURL
	if storage.IsLocalURL(s) {
		if baseURL != "" {
			return strings.TrimSuffix(baseURL, "/") + "/api/v1/avatar"
		}
		return "/api/v1/avatar"
	}
	return s
}
