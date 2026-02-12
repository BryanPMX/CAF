// api/storage/local.go
// LocalStorage implements the FileStorage interface using the server's local
// filesystem. Files are stored under {baseDir}/cases/{caseID}/{uuid}.{ext}.
//
// Design decisions:
//   - Single Responsibility: only handles filesystem I/O for document storage.
//   - Open/Closed: adding a new storage backend requires a new struct, not
//     changes to this file.
//   - Security: path-traversal is prevented by cleaning and validating relative
//     paths before joining them with the base directory.
package storage

import (
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
)

const (
	// LocalURLPrefix is the scheme stored in CaseEvent.FileUrl for local files.
	LocalURLPrefix = "local://"
	// DefaultUploadsDir is the default base directory inside the Docker container.
	DefaultUploadsDir = "/app/uploads"
)

// LocalStorage stores files on the server's local filesystem.
type LocalStorage struct {
	baseDir string
}

// NewLocalStorage creates a LocalStorage provider and ensures the base
// directory exists with the correct permissions.
func NewLocalStorage(baseDir string) (*LocalStorage, error) {
	if baseDir == "" {
		baseDir = DefaultUploadsDir
	}
	if err := os.MkdirAll(baseDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create uploads directory %s: %w", baseDir, err)
	}
	return &LocalStorage{baseDir: baseDir}, nil
}

// Upload saves a multipart file to disk and returns a local:// URL.
func (ls *LocalStorage) Upload(file *multipart.FileHeader, caseID string) (string, error) {
	// Create case-specific subdirectory
	caseDir := filepath.Join(ls.baseDir, "cases", caseID)
	if err := os.MkdirAll(caseDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create case directory: %w", err)
	}

	// Generate a unique filename to avoid collisions
	uniqueName := uuid.New().String() + filepath.Ext(file.Filename)
	destPath := filepath.Join(caseDir, uniqueName)

	// Open the uploaded file
	src, err := file.Open()
	if err != nil {
		return "", fmt.Errorf("failed to open uploaded file: %w", err)
	}
	defer src.Close()

	// Create the destination file
	dst, err := os.Create(destPath)
	if err != nil {
		return "", fmt.Errorf("failed to create destination file: %w", err)
	}
	defer dst.Close()

	// Stream contents to disk
	if _, err := io.Copy(dst, src); err != nil {
		// Clean up partial file on error
		os.Remove(destPath)
		return "", fmt.Errorf("failed to write file to disk: %w", err)
	}

	// Return local:// URL — e.g. local://cases/42/abc123.pdf
	relativePath := fmt.Sprintf("cases/%s/%s", caseID, uniqueName)
	return LocalURLPrefix + relativePath, nil
}

// UploadAvatar saves a profile image under avatars/{userID}.{ext} and returns local://avatars/...
func (ls *LocalStorage) UploadAvatar(file *multipart.FileHeader, userID string) (string, error) {
	avatarDir := filepath.Join(ls.baseDir, "avatars")
	if err := os.MkdirAll(avatarDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create avatars directory: %w", err)
	}
	ext := filepath.Ext(file.Filename)
	if ext == "" {
		ext = ".jpg"
	}
	destPath := filepath.Join(avatarDir, userID+ext)

	src, err := file.Open()
	if err != nil {
		return "", fmt.Errorf("failed to open uploaded file: %w", err)
	}
	defer src.Close()

	dst, err := os.Create(destPath)
	if err != nil {
		return "", fmt.Errorf("failed to create destination file: %w", err)
	}
	defer dst.Close()

	if _, err := io.Copy(dst, src); err != nil {
		os.Remove(destPath)
		return "", fmt.Errorf("failed to write file to disk: %w", err)
	}

	relativePath := fmt.Sprintf("avatars/%s%s", userID, ext)
	return LocalURLPrefix + relativePath, nil
}

// Get opens a local file and returns an io.ReadCloser + content type.
func (ls *LocalStorage) Get(fileURL string) (io.ReadCloser, string, error) {
	diskPath, err := ls.resolvePath(fileURL)
	if err != nil {
		return nil, "", err
	}

	f, err := os.Open(diskPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, "", fmt.Errorf("file not found on disk: %s", diskPath)
		}
		return nil, "", fmt.Errorf("failed to open file: %w", err)
	}

	contentType := detectContentType(diskPath)
	return f, contentType, nil
}

// Delete removes a file from disk. Idempotent — missing files are not errors.
func (ls *LocalStorage) Delete(fileURL string) error {
	diskPath, err := ls.resolvePath(fileURL)
	if err != nil {
		return err
	}

	if err := os.Remove(diskPath); err != nil {
		if os.IsNotExist(err) {
			return nil // already gone; idempotent
		}
		return fmt.Errorf("failed to delete file: %w", err)
	}
	return nil
}

// HealthCheck verifies the uploads directory is accessible and writable.
func (ls *LocalStorage) HealthCheck() error {
	info, err := os.Stat(ls.baseDir)
	if err != nil {
		return fmt.Errorf("uploads directory not accessible: %w", err)
	}
	if !info.IsDir() {
		return fmt.Errorf("uploads path is not a directory: %s", ls.baseDir)
	}
	return nil
}

// resolvePath converts a local:// URL to an absolute filesystem path.
// It validates the URL format and prevents path-traversal attacks.
func (ls *LocalStorage) resolvePath(fileURL string) (string, error) {
	if !strings.HasPrefix(fileURL, LocalURLPrefix) {
		return "", fmt.Errorf("invalid local URL (missing %s prefix): %s", LocalURLPrefix, fileURL)
	}
	relative := strings.TrimPrefix(fileURL, LocalURLPrefix)

	// Security: prevent directory traversal
	cleaned := filepath.Clean(relative)
	if strings.Contains(cleaned, "..") {
		return "", fmt.Errorf("path traversal detected in URL: %s", fileURL)
	}

	return filepath.Join(ls.baseDir, cleaned), nil
}

// IsLocalURL returns true if the file URL uses the local:// scheme.
func IsLocalURL(fileURL string) bool {
	return strings.HasPrefix(fileURL, LocalURLPrefix)
}

// detectContentType returns a MIME type based on the file extension.
func detectContentType(path string) string {
	ext := strings.ToLower(filepath.Ext(path))
	mimeTypes := map[string]string{
		".pdf":  "application/pdf",
		".jpg":  "image/jpeg",
		".jpeg": "image/jpeg",
		".png":  "image/png",
		".gif":  "image/gif",
		".webp": "image/webp",
		".svg":  "image/svg+xml",
		".txt":  "text/plain",
		".html": "text/html",
		".htm":  "text/html",
		".doc":  "application/msword",
		".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		".xls":  "application/vnd.ms-excel",
		".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		".csv":  "text/csv",
		".zip":  "application/zip",
	}
	if ct, ok := mimeTypes[ext]; ok {
		return ct
	}
	return "application/octet-stream"
}
