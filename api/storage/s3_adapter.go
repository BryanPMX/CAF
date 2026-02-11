// api/storage/s3_adapter.go
// S3Storage wraps the existing S3 client and implements the FileStorage
// interface, enabling it to be used interchangeably with LocalStorage via
// the Strategy Pattern.
//
// This adapter delegates to the existing package-level S3 functions where
// possible, minimizing changes to the well-tested S3 code path.
package storage

import (
	"context"
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"strings"

	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// S3Storage implements FileStorage using AWS S3 or LocalStack.
type S3Storage struct {
	client   *s3.Client
	bucket   string
	region   string
	endpoint string
}

// NewS3Storage creates an S3Storage provider from the already-initialized
// package-level S3 client. Call InitS3() before creating this adapter.
func NewS3Storage() (*S3Storage, error) {
	client := GetS3Client()
	if client == nil {
		return nil, fmt.Errorf("S3 client not initialized — call InitS3() first")
	}

	bucket := os.Getenv("S3_BUCKET")
	if bucket == "" {
		bucket = "caf-system-bucket"
	}

	return &S3Storage{
		client:   client,
		bucket:   bucket,
		region:   os.Getenv("AWS_REGION"),
		endpoint: os.Getenv("AWS_ENDPOINT_URL"),
	}, nil
}

// Upload delegates to the existing UploadFile function.
func (ss *S3Storage) Upload(file *multipart.FileHeader, caseID string) (string, error) {
	return UploadFile(file, caseID)
}

// Get retrieves a file from S3 and returns an io.ReadCloser + content type.
func (ss *S3Storage) Get(fileURL string) (io.ReadCloser, string, error) {
	objectKey, err := ss.extractObjectKey(fileURL)
	if err != nil {
		return nil, "", err
	}

	result, err := ss.client.GetObject(context.TODO(), &s3.GetObjectInput{
		Bucket: &ss.bucket,
		Key:    &objectKey,
	})
	if err != nil {
		return nil, "", fmt.Errorf("failed to get object from S3: %w", err)
	}

	contentType := "application/octet-stream"
	if result.ContentType != nil {
		contentType = *result.ContentType
	}

	return result.Body, contentType, nil
}

// Delete removes a file from S3. Idempotent — deleting a non-existent
// object in S3 does not return an error.
func (ss *S3Storage) Delete(fileURL string) error {
	objectKey, err := ss.extractObjectKey(fileURL)
	if err != nil {
		return err
	}

	_, err = ss.client.DeleteObject(context.TODO(), &s3.DeleteObjectInput{
		Bucket: &ss.bucket,
		Key:    &objectKey,
	})
	if err != nil {
		return fmt.Errorf("failed to delete object from S3: %w", err)
	}

	return nil
}

// HealthCheck delegates to the existing package-level HealthCheck.
func (ss *S3Storage) HealthCheck() error {
	return HealthCheck()
}

// extractObjectKey parses the S3 object key from a stored file URL.
// Supported formats:
//   - http(s)://endpoint/bucket/cases/ID/file.ext  (LocalStack / path-style)
//   - https://bucket.s3.region.amazonaws.com/cases/ID/file.ext (virtual-hosted)
func (ss *S3Storage) extractObjectKey(fileURL string) (string, error) {
	parts := strings.Split(fileURL, "/")
	if len(parts) < 4 {
		return "", fmt.Errorf("invalid S3 URL format: %s", fileURL)
	}

	// Try to find the bucket name in the URL path
	bucketIndex := -1
	for i, part := range parts {
		if part == ss.bucket {
			bucketIndex = i
			break
		}
	}

	if bucketIndex != -1 && bucketIndex+1 < len(parts) {
		// Path-style: everything after the bucket name is the key
		return strings.Join(parts[bucketIndex+1:], "/"), nil
	}

	// Virtual-hosted style: bucket is in the hostname, key starts after protocol+host
	// https://bucket.s3.region.amazonaws.com/cases/ID/file.ext
	// parts[0]="https:", parts[1]="", parts[2]="bucket.s3...", parts[3+]=key
	if len(parts) > 3 {
		return strings.Join(parts[3:], "/"), nil
	}

	return "", fmt.Errorf("could not extract object key from URL: %s", fileURL)
}
