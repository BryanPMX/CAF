#!/bin/bash
# AWS HTTPS Setup Script for CAF API
# This script helps configure HTTPS for your AWS API

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DOMAIN_NAME="caf-mexico.org"
REGION="us-east-1"
ALB_NAME="caf-api-alb"
TARGET_GROUP_NAME="caf-api-targets"

echo -e "${GREEN}🚀 CAF AWS HTTPS Setup Script${NC}"
echo "=================================="

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if user is logged in
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not configured. Please run 'aws configure' first.${NC}"
    exit 1
fi

# Get domain name from user
read -p "Enter your domain name (default: caf-mexico.org): " USER_DOMAIN
if [ -z "$USER_DOMAIN" ]; then
    DOMAIN_NAME="caf-mexico.org"
else
    DOMAIN_NAME="$USER_DOMAIN"
fi

API_DOMAIN="api.$DOMAIN_NAME"
ADMIN_DOMAIN="admin.$DOMAIN_NAME"

echo -e "${YELLOW}📋 Configuration:${NC}"
echo "  Domain: $DOMAIN_NAME"
echo "  API Domain: $API_DOMAIN"
echo "  Admin Domain: $ADMIN_DOMAIN"
echo "  Region: $REGION"
echo ""

# Step 1: Request SSL Certificate
echo -e "${GREEN}🔐 Step 1: Requesting SSL Certificate${NC}"
CERT_ARN=$(aws acm request-certificate \
    --domain-name "$API_DOMAIN" \
    --validation-method DNS \
    --region "$REGION" \
    --query 'CertificateArn' \
    --output text)

echo "Certificate ARN: $CERT_ARN"
echo -e "${YELLOW}⚠️  You need to validate this certificate via DNS before proceeding.${NC}"
echo "Check AWS Certificate Manager console for DNS validation records."
echo ""

# Step 2: Get existing EC2 instances
echo -e "${GREEN}🖥️  Step 2: Finding EC2 Instances${NC}"
INSTANCES=$(aws ec2 describe-instances \
    --filters "Name=instance-state-name,Values=running" \
    --query 'Reservations[].Instances[].InstanceId' \
    --output text)

if [ -z "$INSTANCES" ]; then
    echo -e "${RED}❌ No running EC2 instances found${NC}"
    exit 1
fi

echo "Found instances: $INSTANCES"
echo ""

# Step 3: Create Target Group
echo -e "${GREEN}🎯 Step 3: Creating Target Group${NC}"
TARGET_GROUP_ARN=$(aws elbv2 create-target-group \
    --name "$TARGET_GROUP_NAME" \
    --protocol HTTP \
    --port 8080 \
    --vpc-id $(aws ec2 describe-instances --instance-ids $INSTANCES --query 'Reservations[0].Instances[0].VpcId' --output text) \
    --health-check-path "/api/v1/health" \
    --health-check-interval-seconds 30 \
    --health-check-timeout-seconds 5 \
    --healthy-threshold-count 2 \
    --unhealthy-threshold-count 3 \
    --query 'TargetGroups[0].TargetGroupArn' \
    --output text)

echo "Target Group ARN: $TARGET_GROUP_ARN"

# Register instances with target group
for instance in $INSTANCES; do
    aws elbv2 register-targets \
        --target-group-arn "$TARGET_GROUP_ARN" \
        --targets "Id=$instance,Port=8080"
    echo "Registered instance: $instance"
done
echo ""

# Step 4: Create Application Load Balancer
echo -e "${GREEN}⚖️  Step 4: Creating Application Load Balancer${NC}"
VPC_ID=$(aws ec2 describe-instances --instance-ids $INSTANCES --query 'Reservations[0].Instances[0].VpcId' --output text)
SUBNETS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --query 'Subnets[].SubnetId' --output text)

ALB_ARN=$(aws elbv2 create-load-balancer \
    --name "$ALB_NAME" \
    --subnets $SUBNETS \
    --security-groups $(aws ec2 describe-security-groups --filters "Name=group-name,Values=default" --query 'SecurityGroups[0].GroupId' --output text) \
    --query 'LoadBalancers[0].LoadBalancerArn' \
    --output text)

echo "Load Balancer ARN: $ALB_ARN"
echo ""

# Step 5: Create HTTPS Listener
echo -e "${GREEN}🔒 Step 5: Creating HTTPS Listener${NC}"
echo -e "${YELLOW}⚠️  Note: This will fail if the SSL certificate is not validated yet.${NC}"

aws elbv2 create-listener \
    --load-balancer-arn "$ALB_ARN" \
    --protocol HTTPS \
    --port 443 \
    --certificates "CertificateArn=$CERT_ARN" \
    --default-actions "Type=forward,TargetGroupArn=$TARGET_GROUP_ARN" || {
    echo -e "${RED}❌ Failed to create HTTPS listener. Please validate your SSL certificate first.${NC}"
    echo "You can run this script again after certificate validation."
}

# Step 6: Create HTTP Listener (redirect to HTTPS)
echo -e "${GREEN}🔄 Step 6: Creating HTTP Listener (redirect to HTTPS)${NC}"
aws elbv2 create-listener \
    --load-balancer-arn "$ALB_ARN" \
    --protocol HTTP \
    --port 80 \
    --default-actions "Type=redirect,RedirectConfig={Protocol=HTTPS,Port=443,StatusCode=HTTP_301}" || {
    echo -e "${YELLOW}⚠️  HTTP listener creation failed or already exists${NC}"
}

# Get ALB DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers --load-balancer-arns "$ALB_ARN" --query 'LoadBalancers[0].DNSName' --output text)

echo ""
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo "=================================="
echo -e "${YELLOW}📋 Next Steps:${NC}"
echo "1. Validate your SSL certificate in AWS Certificate Manager"
echo "2. Create DNS A record: $API_DOMAIN -> $ALB_DNS"
echo "3. Update your Vercel environment variables:"
echo "   NEXT_PUBLIC_API_URL=https://$API_DOMAIN/api/v1"
echo "4. Test your API: curl -I https://$API_DOMAIN/api/v1/health"
echo ""
echo -e "${GREEN}🔗 Load Balancer DNS: $ALB_DNS${NC}"
echo -e "${GREEN}🔗 API URL: https://$API_DOMAIN/api/v1${NC}"
echo ""
echo -e "${YELLOW}⚠️  Remember to update your security groups to allow HTTPS traffic!${NC}"
