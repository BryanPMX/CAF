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

// GetS3Client returns the initialized S3 client
func GetS3Client() *s3.Client {
	return s3Client
}

// HealthCheck checks if the S3 service is accessible
func HealthCheck() error {
	if s3Client == nil {
		return fmt.Errorf("S3 client not initialized")
	}

	bucketName := os.Getenv("S3_BUCKET")
	if bucketName == "" {
		bucketName = "caf-system-bucket" // fallback
	}

	_, err := s3Client.HeadBucket(context.TODO(), &s3.HeadBucketInput{
		Bucket: &bucketName,
	})

	return err
}

// InitS3 initializes the S3 client.
func InitS3() error {
	endpoint := os.Getenv("AWS_ENDPOINT_URL")
	region := os.Getenv("AWS_REGION")

	resolver := aws.EndpointResolverFunc(func(service, region string) (aws.Endpoint, error) {
		if endpoint != "" {
			log.Printf("Using custom S3 endpoint: %s", endpoint)
			return aws.Endpoint{
				URL:           endpoint,
				SigningRegion: region,
				Source:        aws.EndpointSourceCustom,
			}, nil
		}
		log.Printf("No custom endpoint specified, using default AWS endpoint")
		return aws.Endpoint{}, &aws.EndpointNotFoundError{}
	})

	// Get AWS credentials from environment variables
	awsAccessKey := os.Getenv("AWS_ACCESS_KEY_ID")
	awsSecretKey := os.Getenv("AWS_SECRET_ACCESS_KEY")

	var configOptions []func(*config.LoadOptions) error
	configOptions = append(configOptions, config.WithRegion(region))
	configOptions = append(configOptions, config.WithEndpointResolver(resolver))

	if awsAccessKey != "" && awsSecretKey != "" {
		log.Printf("Using AWS credentials from environment variables")
		credentialProvider := credentials.NewStaticCredentialsProvider(awsAccessKey, awsSecretKey, "")
		configOptions = append(configOptions, config.WithCredentialsProvider(credentialProvider))
	} else {
		log.Printf("No AWS credentials found in environment, using default credential chain (IAM roles)")
	}

	cfg, err := config.LoadDefaultConfig(context.TODO(), configOptions...)
	if err != nil {
		return fmt.Errorf("failed to load AWS config: %w", err)
	}

	s3Client = s3.NewFromConfig(cfg, func(o *s3.Options) {
		// Only use path style for LocalStack, not for production AWS
		if endpoint != "" {
			o.UsePathStyle = true
		}
	})

	return nil
}

// --- NEW FUNCTION ---
// CreateBucketIfNotExists checks if our S3 bucket exists and creates it if it doesn't.
// This is a robust way to ensure our environment is always ready.
func CreateBucketIfNotExists() error {
	bucketName := os.Getenv("S3_BUCKET")
	log.Printf("Checking for S3 bucket: %s", bucketName)

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

	// Generate the correct file URL based on environment
	endpoint := os.Getenv("AWS_ENDPOINT_URL")
	region := os.Getenv("AWS_REGION")
	
	var fileURL string
	if endpoint != "" {
		// LocalStack or custom endpoint
		fileURL = fmt.Sprintf("%s/%s/%s", endpoint, bucketName, objectKey)
	} else {
		// Production AWS S3
		fileURL = fmt.Sprintf("https://%s.s3.%s.amazonaws.com/%s", bucketName, region, objectKey)
	}

	return fileURL, nil
}

// UploadAvatarFile uploads a profile image to S3 at avatars/{userID}.{ext} and returns the public URL.
func UploadAvatarFile(file *multipart.FileHeader, userID string) (string, error) {
	bucketName := os.Getenv("S3_BUCKET")
	if s3Client == nil {
		return "", fmt.Errorf("S3 client not initialized")
	}

	src, err := file.Open()
	if err != nil {
		return "", fmt.Errorf("failed to open file: %w", err)
	}
	defer src.Close()

	ext := filepath.Ext(file.Filename)
	if ext == "" {
		ext = ".jpg"
	}
	objectKey := fmt.Sprintf("avatars/%s%s", userID, ext)

	_, err = s3Client.PutObject(context.TODO(), &s3.PutObjectInput{
		Bucket: &bucketName,
		Key:    &objectKey,
		Body:   src,
		ACL:    types.ObjectCannedACLPublicRead,
	})
	if err != nil {
		return "", fmt.Errorf("failed to upload avatar to S3: %w", err)
	}

	endpoint := os.Getenv("AWS_ENDPOINT_URL")
	region := os.Getenv("AWS_REGION")
	if endpoint != "" {
		return fmt.Sprintf("%s/%s/%s", endpoint, bucketName, objectKey), nil
	}
	return fmt.Sprintf("https://%s.s3.%s.amazonaws.com/%s", bucketName, region, objectKey), nil
}
