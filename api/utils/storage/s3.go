// api/utils/storage/s3.go
package storage

import (
	"context"
	"fmt"
	"log"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/google/uuid"
)

var s3Client *s3.Client

// InitS3 initializes the S3 client.
func InitS3() error {
	endpoint := os.Getenv("S3_ENDPOINT")
	region := os.Getenv("AWS_REGION")

	resolver := aws.EndpointResolverFunc(func(service, region string) (aws.Endpoint, error) {
		if endpoint != "" {
			return aws.Endpoint{
				URL:           endpoint,
				SigningRegion: region,
				Source:        aws.EndpointSourceCustom,
			}, nil
		}
		return aws.Endpoint{}, &aws.EndpointNotFoundError{}
	})

	cfg, err := config.LoadDefaultConfig(context.TODO(),
		config.WithRegion(region),
		config.WithEndpointResolver(resolver),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider("test", "test", "")),
	)
	if err != nil {
		return fmt.Errorf("failed to load AWS config: %w", err)
	}

	s3Client = s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.UsePathStyle = true
	})

	return nil
}

// --- NEW FUNCTION ---
// CreateBucketIfNotExists checks if our S3 bucket exists and creates it if it doesn't.
// This is a robust way to ensure our environment is always ready.
func CreateBucketIfNotExists() error {
	bucketName := os.Getenv("S3_BUCKET")
	if s3Client == nil {
		return fmt.Errorf("S3 client not initialized")
	}

	_, err := s3Client.HeadBucket(context.TODO(), &s3.HeadBucketInput{
		Bucket: &bucketName,
	})

	if err != nil {
		// Check if the error is because the bucket does not exist
		if strings.Contains(err.Error(), "NotFound") || strings.Contains(err.Error(), "NoSuchBucket") {
			log.Printf("Bucket '%s' not found. Creating it...", bucketName)
			_, createErr := s3Client.CreateBucket(context.TODO(), &s3.CreateBucketInput{
				Bucket: &bucketName,
				ACL:    types.BucketCannedACLPublicRead,
			})
			if createErr != nil {
				return fmt.Errorf("failed to create bucket: %w", createErr)
			}
			log.Printf("Bucket '%s' created successfully.", bucketName)
		} else {
			// Some other error occurred
			return fmt.Errorf("failed to check for bucket: %w", err)
		}
	} else {
		log.Printf("S3 Bucket '%s' already exists.", bucketName)
	}

	return nil
}

// UploadFile handles uploading a file to the S3 bucket.
func UploadFile(file *multipart.FileHeader, caseID string) (string, error) {
	bucketName := os.Getenv("S3_BUCKET")
	if s3Client == nil {
		return "", fmt.Errorf("S3 client not initialized")
	}

	src, err := file.Open()
	if err != nil {
		return "", fmt.Errorf("failed to open file: %w", err)
	}
	defer src.Close()

	uniqueFileName := uuid.New().String() + filepath.Ext(file.Filename)
	objectKey := fmt.Sprintf("cases/%s/%s", caseID, uniqueFileName)

	_, err = s3Client.PutObject(context.TODO(), &s3.PutObjectInput{
		Bucket: &bucketName,
		Key:    &objectKey,
		Body:   src,
		ACL:    types.ObjectCannedACLPublicRead,
	})

	if err != nil {
		return "", fmt.Errorf("failed to upload file to S3: %w", err)
	}

	endpoint := os.Getenv("S3_ENDPOINT")
	fileURL := fmt.Sprintf("%s/%s/%s", endpoint, bucketName, objectKey)

	return fileURL, nil
}
