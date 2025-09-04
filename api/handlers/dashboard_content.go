package handlers

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/BryanPMX/CAF/api/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type AnnouncementsResponse struct {
	Announcements []models.Announcement `json:"announcements"`
}

type NotesResponse struct {
	AdminNotes []models.AdminNote `json:"adminNotes"`
	UserNotes  []models.UserNote  `json:"userNotes"`
}

// GetAnnouncements returns active announcements scoped by role/department/time
func GetAnnouncements(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole, _ := c.Get("userRole")
		userDepartment, _ := c.Get("userDepartment")
		userIDVal, _ := c.Get("userID")
		now := time.Now()

		// Debug logging
		fmt.Printf("GetAnnouncements: userRole=%v, userDepartment=%v, userID=%v\n", userRole, userDepartment, userIDVal)

		var items []models.Announcement = make([]models.Announcement, 0)
		q := db.Model(&models.Announcement{}).
			Where("(start_at IS NULL OR start_at <= ?) AND (end_at IS NULL OR end_at >= ?)", now, now)

		// Only apply role filtering if userRole is not empty
		if userRoleStr, ok := userRole.(string); ok && userRoleStr != "" {
			q = q.Where("(array_length(visible_roles,1) IS NULL) OR (? = ANY(visible_roles))", userRoleStr)
		}

		// Only apply department filtering if userDepartment is not empty
		if dept, ok := userDepartment.(string); ok && dept != "" {
			q = q.Where("(array_length(visible_departments,1) IS NULL) OR (? = ANY(visible_departments))", dept)
		}

		// Exclude announcements dismissed by current user
		if uid := toUint(userIDVal); uid != 0 {
			q = q.Where("id NOT IN (SELECT announcement_id FROM announcement_dismissals WHERE user_id = ?)", uid)
		}

		q = q.Order("pinned DESC, start_at DESC NULLS LAST, created_at DESC").Limit(20)
		if err := q.Find(&items).Error; err != nil {
			fmt.Printf("GetAnnouncements error: %v\n", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "No se pudieron cargar los anuncios"})
			return
		}

		fmt.Printf("GetAnnouncements: found %d announcements\n", len(items))
		c.Header("Cache-Control", "public, max-age=60")
		c.JSON(http.StatusOK, AnnouncementsResponse{Announcements: items})
	}
}

// GetNotes returns admin broadcast notes and the user's personal notes
func GetNotes(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole, _ := c.Get("userRole")
		userDepartment, _ := c.Get("userDepartment")
		userIDVal, _ := c.Get("userID")
		now := time.Now()

		var adminNotes []models.AdminNote = make([]models.AdminNote, 0)
		qa := db.Model(&models.AdminNote{}).
			Where("(start_at IS NULL OR start_at <= ?) AND (end_at IS NULL OR end_at >= ?)", now, now)
		if role, ok := userRole.(string); ok && role != "" {
			qa = qa.Where("(array_length(visible_roles,1) IS NULL) OR (? = ANY(visible_roles))", role)
		}
		if dept, ok := userDepartment.(string); ok && dept != "" {
			qa = qa.Where("(array_length(visible_departments,1) IS NULL) OR (? = ANY(visible_departments))", dept)
		}
		qa = qa.Order("pinned DESC, start_at DESC NULLS LAST, created_at DESC").Limit(50)
		if err := qa.Find(&adminNotes).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "No se pudieron cargar las notas"})
			return
		}

		// Personal notes
		var userNotes []models.UserNote = make([]models.UserNote, 0)
		if userIDStr, ok := userIDVal.(string); ok && userIDStr != "" {
			if err := db.Where("user_id = ?", userIDStr).Order("pinned DESC, updated_at DESC").Find(&userNotes).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "No se pudieron cargar tus notas"})
				return
			}
		}

		c.Header("Cache-Control", "public, max-age=60")
		c.JSON(http.StatusOK, NotesResponse{AdminNotes: adminNotes, UserNotes: userNotes})
	}
}

// Admin CRUD for announcements (create/update/delete)
func CreateAnnouncement(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input models.Announcement
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
			return
		}
		// sanitize HTML body
		input.BodyHTML = sanitizeHTML(input.BodyHTML)
		currentUser, _ := c.Get("currentUser")
		user := currentUser.(models.User)
		input.CreatedBy = user.ID
		if err := db.Create(&input).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "No se pudo crear el anuncio"})
			return
		}
		c.JSON(http.StatusCreated, input)
	}
}

func UpdateAnnouncement(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var existing models.Announcement
		if err := db.First(&existing, c.Param("id")).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Anuncio no encontrado"})
			return
		}
		var input models.Announcement
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
			return
		}
		input.BodyHTML = sanitizeHTML(input.BodyHTML)
		currentUser, _ := c.Get("currentUser")
		user := currentUser.(models.User)
		input.ID = existing.ID
		input.CreatedBy = existing.CreatedBy
		input.UpdatedBy = &user.ID
		if err := db.Model(&existing).Select("title", "body_html", "images", "tags", "pinned", "start_at", "end_at", "visible_roles", "visible_departments", "updated_by").Updates(input).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "No se pudo actualizar el anuncio"})
			return
		}
		c.JSON(http.StatusOK, input)
	}
}

func DeleteAnnouncement(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		if err := db.Delete(&models.Announcement{}, c.Param("id")).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "No se pudo eliminar el anuncio"})
			return
		}
		c.Status(http.StatusNoContent)
	}
}

// Admin CRUD for AdminNotes
func CreateAdminNote(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input models.AdminNote
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
			return
		}
		currentUser, _ := c.Get("currentUser")
		user := currentUser.(models.User)
		input.CreatedBy = user.ID
		if err := db.Create(&input).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "No se pudo crear la nota"})
			return
		}
		c.JSON(http.StatusCreated, input)
	}
}

func UpdateAdminNote(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var existing models.AdminNote
		if err := db.First(&existing, c.Param("id")).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Nota no encontrada"})
			return
		}
		var input models.AdminNote
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
			return
		}
		currentUser, _ := c.Get("currentUser")
		user := currentUser.(models.User)
		input.ID = existing.ID
		input.CreatedBy = existing.CreatedBy
		input.UpdatedBy = &user.ID
		if err := db.Model(&existing).Select("body_text", "image_url", "pinned", "start_at", "end_at", "visible_roles", "visible_departments", "updated_by").Updates(input).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "No se pudo actualizar la nota"})
			return
		}
		c.JSON(http.StatusOK, input)
	}
}

func DeleteAdminNote(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		if err := db.Delete(&models.AdminNote{}, c.Param("id")).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "No se pudo eliminar la nota"})
			return
		}
		c.Status(http.StatusNoContent)
	}
}

// Personal notes CRUD (user scoped)
func CreateUserNote(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input models.UserNote
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
			return
		}
		userIDVal, _ := c.Get("userID")
		input.UserID = toUint(userIDVal)
		if err := db.Create(&input).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "No se pudo crear tu nota"})
			return
		}
		c.JSON(http.StatusCreated, input)
	}
}

func UpdateUserNote(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDVal, _ := c.Get("userID")
		uid := toUint(userIDVal)
		var existing models.UserNote
		if err := db.Where("id = ? AND user_id = ?", c.Param("id"), uid).First(&existing).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Nota no encontrada"})
			return
		}
		var input models.UserNote
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
			return
		}
		input.ID = existing.ID
		input.UserID = existing.UserID
		if err := db.Model(&existing).Select("body_text", "pinned").Updates(input).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "No se pudo actualizar tu nota"})
			return
		}
		c.JSON(http.StatusOK, input)
	}
}

func DeleteUserNote(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDVal, _ := c.Get("userID")
		uid := toUint(userIDVal)
		if err := db.Where("user_id = ?", uid).Delete(&models.UserNote{}, c.Param("id")).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "No se pudo eliminar tu nota"})
			return
		}
		c.Status(http.StatusNoContent)
	}
}

// Dismiss an announcement for current user
func DismissAnnouncement(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDVal, _ := c.Get("userID")
		uid := toUint(userIDVal)
		if uid == 0 {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "No autorizado"})
			return
		}
		if err := db.Exec(
			"INSERT INTO announcement_dismissals (user_id, announcement_id, dismissed_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
			uid, c.Param("id"), time.Now(),
		).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "No se pudo descartar el anuncio"})
			return
		}
		c.Status(http.StatusNoContent)
	}
}

func toUint(v interface{}) uint {
	s, _ := v.(string)
	var out uint
	for i := 0; i < len(s); i++ {
		out = out*10 + uint(s[i]-'0')
	}
	return out
}

// sanitizeHTML removes script/style tags and unsafe on* attributes.
func sanitizeHTML(html string) string {
	// Very light sanitization; for production-grade, consider a dedicated sanitizer lib
	// Remove <script>...</script> and <style>...</style>
	clean := html
	for _, pair := range []struct{ open, close string }{{"<script", "</script>"}, {"<style", "</style>"}} {
		for {
			start := indexCaseInsensitive(clean, pair.open)
			if start == -1 {
				break
			}
			end := indexCaseInsensitiveFrom(clean, pair.close, start)
			if end == -1 {
				clean = clean[:start]
				break
			}
			endTag := end + len(pair.close)
			clean = clean[:start] + clean[endTag:]
		}
	}
	// Remove common event attributes like onclick=, onload=, onerror=
	lower := strings.ToLower(clean)
	for _, attr := range []string{"onload=", "onclick=", "onerror=", "onmouseover=", "onfocus=", "onblur="} {
		for {
			idx := strings.Index(lower, attr)
			if idx == -1 {
				break
			}
			j := idx
			for j < len(clean) && clean[j] != ' ' && clean[j] != '>' {
				j++
			}
			clean = clean[:idx] + clean[j:]
			lower = strings.ToLower(clean)
		}
	}
	return clean
}

func indexCaseInsensitive(s, sub string) int {
	ls, lsub := len(s), len(sub)
	if lsub == 0 || lsub > ls {
		return -1
	}
	lowerS := strings.ToLower(s)
	lowerSub := strings.ToLower(sub)
	return strings.Index(lowerS, lowerSub)
}

func indexCaseInsensitiveFrom(s, sub string, start int) int {
	if start < 0 || start >= len(s) {
		return -1
	}
	off := indexCaseInsensitive(s[start:], sub)
	if off == -1 {
		return -1
	}
	return start + off
}
