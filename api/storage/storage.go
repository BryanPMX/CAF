// api/storage/storage.go
// Defines the FileStorage interface (Strategy Pattern + Dependency Inversion Principle).
// All storage backends (S3, local filesystem) implement this contract,
// allowing handlers to depend on the abstraction rather than concrete types.
package storage

import (
	"io"
	"mime/multipart"
)

// FileStorage defines the contract for document storage operations.
// Implementations: S3Storage (AWS/LocalStack) and LocalStorage (server filesystem).
type FileStorage interface {
	// Upload saves a file for the given case and returns its stored URL.
	Upload(file *multipart.FileHeader, caseID string) (string, error)

	// UploadAvatar saves a profile image for the given user and returns its stored URL.
	UploadAvatar(file *multipart.FileHeader, userID string) (string, error)

	// Get retrieves a file by its stored URL.
	// Returns a ReadCloser for the file body and the detected content type.
	Get(fileURL string) (io.ReadCloser, string, error)

	// Delete removes a file by its stored URL. Idempotent — deleting a
	// non-existent file is not an error.
	Delete(fileURL string) error

	// HealthCheck verifies the storage backend is accessible.
	HealthCheck() error
}

// activeStorage holds the initialized storage provider chosen at startup.
var activeStorage FileStorage

// GetActiveStorage returns the current storage provider.
// Returns nil if no provider has been initialized.
func GetActiveStorage() FileStorage {
	return activeStorage
}

// SetActiveStorage sets the global storage provider.
func SetActiveStorage(s FileStorage) {
	activeStorage = s
}
