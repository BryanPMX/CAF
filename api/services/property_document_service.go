package services

import (
	"fmt"
	"mime/multipart"
	"path/filepath"
	"strings"
	"unicode/utf8"

	"github.com/BryanPMX/CAF/api/models"
	"github.com/BryanPMX/CAF/api/security"
	"github.com/BryanPMX/CAF/api/storage"
	"gorm.io/gorm"
)

// Document storage is injected so authorization and cleanup are testable without
// S3 or filesystem globals. Existing storage adapters own file I/O and safe keys.
type PropertyDocumentService struct {
	db    *gorm.DB
	store storage.FileStorage
}

func NewPropertyDocumentService(db *gorm.DB, store storage.FileStorage) *PropertyDocumentService {
	return &PropertyDocumentService{db, store}
}
func (s *PropertyDocumentService) Upload(actor models.User, propertyID uint, file *multipart.FileHeader) (*models.PropertyDocument, error) {
	if err := propertyAccess(actor); err != nil {
		return nil, err
	}
	var property models.Property
	if err := NewPropertyService(s.db).scope(actor).First(&property, propertyID).Error; err != nil {
		return nil, propertyDBError(err)
	}
	if s.store == nil {
		return nil, PropertyError{503, "El almacenamiento de documentos no está disponible"}
	}
	mimeType, err := security.ValidateDocumentUpload(file)
	if err != nil {
		return nil, propertyInvalid("No se pudo aceptar el archivo. Revise el formato, el contenido y el límite de 25 MB.")
	}
	name := filepath.Base(strings.ReplaceAll(file.Filename, "\\", "/"))
	if name == "" || name == "." || strings.ContainsAny(name, "\r\n\x00") || utf8.RuneCountInString(name) > 255 {
		return nil, propertyInvalid("Nombre de archivo no válido")
	}
	url, err := s.store.Upload(file, fmt.Sprintf("property-%d", propertyID))
	if err != nil {
		return nil, err
	}
	record := models.PropertyDocument{PropertyID: propertyID, FileName: name, FileURL: url, FileType: mimeType, CreatedBy: actor.ID}
	if err := s.db.Create(&record).Error; err != nil {
		_ = s.store.Delete(url)
		return nil, err
	}
	return &record, nil
}
func (s *PropertyDocumentService) Get(actor models.User, propertyID, id uint) (*models.PropertyDocument, error) {
	if err := propertyAccess(actor); err != nil {
		return nil, err
	}
	var property models.Property
	if err := NewPropertyService(s.db).scope(actor).First(&property, propertyID).Error; err != nil {
		return nil, propertyDBError(err)
	}
	var record models.PropertyDocument
	if err := s.db.Where("id = ? AND property_id = ?", id, propertyID).First(&record).Error; err != nil {
		return nil, PropertyError{404, "Documento no disponible"}
	}
	return &record, nil
}
