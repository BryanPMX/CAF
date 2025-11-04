# AWS Migration Guide

This guide explains how to migrate from local development back to AWS production when you're ready.

## Current Local Setup

Your application is currently configured for local development with:
- **LocalStack**: Simulates AWS S3 services locally
- **PostgreSQL**: Local database container
- **No AWS costs**: Everything runs locally

## Switching to AWS Production

### 1. Environment Configuration

#### API Environment Variables (api/.env)
Replace the LocalStack configuration with real AWS settings:

```env
# Replace LocalStack config with AWS
AWS_REGION=us-east-2
S3_BUCKET=your-production-s3-bucket
AWS_ACCESS_KEY_ID=your_real_aws_access_key
AWS_SECRET_ACCESS_KEY=your_real_aws_secret_key
# Remove this line: AWS_ENDPOINT_URL=http://localhost:4566
```

#### Admin Portal Environment Variables (admin-portal/.env.local)
Update the API URL to point to your AWS infrastructure:

```env
NEXT_PUBLIC_API_URL=https://your-api-domain.com/api/v1
```

### 2. AWS Services Setup

#### Required AWS Services:
1. **S3 Bucket**: For file storage
2. **RDS PostgreSQL**: For database (or use managed PostgreSQL)
3. **ECS/EC2**: For running the API
4. **ALB/ELB**: For load balancing (optional)

#### S3 Bucket Configuration:
```bash
# Create S3 bucket
aws s3 mb s3://your-production-bucket-name --region us-east-2

# Enable public read access for uploaded files
aws s3api put-bucket-policy --bucket your-production-bucket-name --policy '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-production-bucket-name/*"
    }
  ]
}'
```

### 3. Database Migration

#### Option A: Migrate from Local to AWS RDS
```bash
# Export local database
docker exec caf_postgres pg_dump -U user caf_db > backup.sql

# Import to AWS RDS
psql -h your-rds-endpoint -U your-db-user -d your-db-name < backup.sql
```

#### Option B: Fresh Start
Run the application with AWS database connection to create fresh schema.

### 4. Deployment Options

#### Option 1: ECS (Recommended)
Use the existing ECS scripts in the `scripts/` directory:
```bash
./scripts/create-ecs-task-role.sh
./scripts/update-task-definition-with-role.sh
./scripts/optimize-ecs-service.sh
```

#### Option 2: EC2 Instance
Deploy using Docker on EC2:
```bash
# On EC2 instance
git clone <your-repo>
cd CAF
docker-compose up -d
```

### 5. Domain and SSL Configuration

#### Route 53 + CloudFront (Recommended)
1. Register domain in Route 53
2. Set up CloudFront distribution for admin portal
3. Configure SSL certificate via ACM
4. Point domain to CloudFront/API Gateway

#### ALB Configuration
```bash
# Update admin-portal/env.production
NEXT_PUBLIC_API_URL=https://your-alb-endpoint.us-east-2.elb.amazonaws.com/api/v1
```

### 6. Security Configuration

#### IAM Permissions
Ensure your AWS credentials have these permissions:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::your-bucket-name",
        "arn:aws:s3:::your-bucket-name/*"
      ]
    }
  ]
}
```

#### Security Groups
- API (port 8080): Allow from ALB/load balancer
- Database: Restrict to API server only
- S3: Public read access for uploaded files

### 7. Monitoring and Backup

#### Enable AWS Monitoring
- CloudWatch for logs and metrics
- RDS automated backups
- S3 versioning for file safety

#### Cost Optimization
- Use reserved instances for consistent workloads
- Set up billing alerts
- Monitor S3 storage costs

## Rollback Plan

If you need to rollback to local development:

1. **Stop AWS services**
2. **Restore environment files** with LocalStack configuration
3. **Run locally**: `docker-compose up -d`

## Cost Estimation

Expected monthly AWS costs (approximate):
- **EC2 t3.micro**: $8-15/month
- **RDS PostgreSQL micro**: $15-25/month
- **S3 storage**: $0.50-5/month (depending on usage)
- **Data transfer**: $5-20/month

**Total**: $30-65/month for small-scale production

## Support

If you encounter issues during migration:
1. Check AWS service health dashboard
2. Review CloudWatch logs
3. Verify IAM permissions
4. Test connectivity with `telnet` or `curl`

## Quick Migration Checklist

- [ ] Create AWS account and IAM user
- [ ] Set up S3 bucket with public read policy
- [ ] Configure RDS PostgreSQL instance
- [ ] Update environment variables
- [ ] Deploy API to ECS/EC2
- [ ] Update admin portal API URL
- [ ] Test file uploads and all features
- [ ] Set up monitoring and backups
