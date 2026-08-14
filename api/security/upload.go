package security

import (
	"fmt"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strings"
)

const (
	MaxDocumentBytes int64 = 25 * 1024 * 1024
	MaxImageBytes    int64 = 10 * 1024 * 1024
)

var imageTypes = map[string]map[string]bool{
	".jpg":  {"image/jpeg": true},
	".jpeg": {"image/jpeg": true},
	".png":  {"image/png": true},
	".gif":  {"image/gif": true},
	".webp": {"image/webp": true},
}

var documentTypes = map[string]map[string]bool{
	".pdf":  {"application/pdf": true},
	".jpg":  {"image/jpeg": true},
	".jpeg": {"image/jpeg": true},
	".png":  {"image/png": true},
	".gif":  {"image/gif": true},
	".webp": {"image/webp": true},
	".txt":  {"text/plain": true},
	".csv":  {"text/plain": true, "text/csv": true, "application/octet-stream": true},
	".doc":  {"application/msword": true, "application/octet-stream": true},
	".docx": {"application/zip": true, "application/octet-stream": true},
	".xls":  {"application/vnd.ms-excel": true, "application/octet-stream": true},
	".xlsx": {"application/zip": true, "application/octet-stream": true},
	".zip":  {"application/zip": true, "application/octet-stream": true},
}

func ValidateImageUpload(file *multipart.FileHeader) (string, error) {
	return validateUpload(file, MaxImageBytes, imageTypes)
}

func ValidateDocumentUpload(file *multipart.FileHeader) (string, error) {
	return validateUpload(file, MaxDocumentBytes, documentTypes)
}

func validateUpload(file *multipart.FileHeader, maxBytes int64, allowed map[string]map[string]bool) (string, error) {
	if file == nil || file.Size <= 0 {
		return "", fmt.Errorf("file is empty")
	}
	if file.Size > maxBytes {
		return "", fmt.Errorf("file exceeds the %d MB limit", maxBytes/(1024*1024))
	}
	ext := strings.ToLower(filepath.Ext(strings.TrimSpace(file.Filename)))
	allowedMIMEs, ok := allowed[ext]
	if !ok {
		return "", fmt.Errorf("file extension is not allowed")
	}

	source, err := file.Open()
	if err != nil {
		return "", fmt.Errorf("open upload: %w", err)
	}
	defer source.Close()
	buffer := make([]byte, 512)
	n, err := source.Read(buffer)
	if err != nil && n == 0 {
		return "", fmt.Errorf("read upload: %w", err)
	}
	detected := strings.ToLower(strings.TrimSpace(strings.Split(http.DetectContentType(buffer[:n]), ";")[0]))
	if !allowedMIMEs[detected] {
		return "", fmt.Errorf("file contents do not match the allowed type")
	}
	return detected, nil
}
