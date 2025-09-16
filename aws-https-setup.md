# AWS HTTPS Setup Guide

## Option A: Application Load Balancer (Recommended)

### 1. Create SSL Certificate
```bash
# Request SSL certificate via AWS Certificate Manager
aws acm request-certificate \
  --domain-name api.yourdomain.com \
  --validation-method DNS \
  --region us-east-1
```

### 2. Configure Application Load Balancer
- Create ALB in AWS Console
- Configure HTTPS listener (port 443)
- Attach SSL certificate
- Point to your existing EC2 instances

### 3. Update DNS
- Create A record for `api.yourdomain.com` pointing to ALB DNS name

## Option B: CloudFront Distribution

### 1. Create CloudFront Distribution
- Origin: Your existing AWS ALB endpoint
- Configure custom SSL certificate
- Set up custom domain

### 2. Benefits
- Global CDN
- Automatic HTTPS
- Better performance
- DDoS protection

## Option C: API Gateway (If migrating to serverless)

### 1. Create API Gateway
- REST API or HTTP API
- Configure custom domain
- Set up SSL certificate

### 2. Benefits
- Serverless
- Built-in HTTPS
- Rate limiting
- Request/response transformation
