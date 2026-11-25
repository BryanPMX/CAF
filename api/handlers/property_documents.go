package handlers

import (
	"github.com/BryanPMX/CAF/api/security"
	"github.com/BryanPMX/CAF/api/services"
	"github.com/BryanPMX/CAF/api/storage"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"io"
	"mime"
	"net/http"
)

func registerPropertyDocuments(group *gin.RouterGroup, db *gorm.DB) {
	group.POST("/properties/:id/documents", func(c *gin.Context) {
		actor, ok := propertyActor(c)
		if !ok {
			return
		}
		id, ok := propertyID(c, "id")
		if !ok {
			return
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, security.MaxDocumentBytes+(1<<20))
		file, err := c.FormFile("file")
		if c.Request.MultipartForm != nil {
			defer c.Request.MultipartForm.RemoveAll()
		}
		if err != nil {
			c.JSON(400, gin.H{"error": "Seleccione un archivo válido dentro del tamaño permitido"})
			return
		}
		record, err := services.NewPropertyDocumentService(db.WithContext(c.Request.Context()), storage.GetActiveStorage()).Upload(actor, id, file)
		if err != nil {
			propertyFailure(c, err)
			return
		}
		c.JSON(201, record)
	})
	group.GET("/properties/:id/documents/:documentId", func(c *gin.Context) {
		actor, ok := propertyActor(c)
		if !ok {
			return
		}
		id, ok := propertyID(c, "id")
		if !ok {
			return
		}
		documentID, ok := propertyID(c, "documentId")
		if !ok {
			return
		}
		store := storage.GetActiveStorage()
		record, err := services.NewPropertyDocumentService(db.WithContext(c.Request.Context()), store).Get(actor, id, documentID)
		if err != nil {
			propertyFailure(c, err)
			return
		}
		if store == nil {
			c.JSON(503, gin.H{"error": "Almacenamiento no disponible"})
			return
		}
		file, mimeType, err := store.Get(record.FileURL)
		if err != nil {
			c.JSON(404, gin.H{"error": "Archivo no disponible"})
			return
		}
		defer file.Close()
		c.Header("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": record.FileName}))
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("Content-Security-Policy", "default-src 'none'; sandbox")
		c.Header("Content-Type", mimeType)
		c.Status(200)
		_, _ = io.Copy(c.Writer, file)
	})
}
