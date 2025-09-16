# AWS HTTPS Setup - Manual Instructions for caf-mexico.org

## 🚀 Step-by-Step AWS Configuration

### Prerequisites
- AWS CLI installed and configured
- Domain registered: `caf-mexico.org`
- AWS account with EC2, ELB, and ACM permissions

### Step 1: Request SSL Certificate

```powershell
# Request SSL certificate via AWS Certificate Manager
aws acm request-certificate --domain-name "api.caf-mexico.org" --validation-method DNS --region us-east-1
```

**Note the Certificate ARN** - you'll need it for the Load Balancer setup.

### Step 2: Validate SSL Certificate

1. Go to AWS Certificate Manager console
2. Find your certificate for `api.caf-mexico.org`
3. Click "Create record in Route 53" or manually add DNS validation record
4. Wait for certificate to show "Issued" status

### Step 3: Find Your EC2 Instances

```powershell
# List running EC2 instances
aws ec2 describe-instances --filters "Name=instance-state-name,Values=running" --query 'Reservations[].Instances[].[InstanceId,PublicIpAddress,PrivateIpAddress]' --output table
```

**Note the Instance IDs** - you'll need them for the Target Group.

### Step 4: Get VPC and Subnet Information

```powershell
# Get VPC ID from instances
aws ec2 describe-instances --instance-ids [YOUR_INSTANCE_ID] --query 'Reservations[0].Instances[0].VpcId' --output text

# Get Subnets in the VPC
aws ec2 describe-subnets --filters "Name=vpc-id,Values=[YOUR_VPC_ID]" --query 'Subnets[].[SubnetId,AvailabilityZone]' --output table
```

### Step 5: Create Target Group

```powershell
# Create target group (replace VPC_ID with actual value)
aws elbv2 create-target-group --name "caf-api-targets" --protocol HTTP --port 8080 --vpc-id [YOUR_VPC_ID] --health-check-path "/api/v1/health" --health-check-interval-seconds 30 --health-check-timeout-seconds 5 --healthy-threshold-count 2 --unhealthy-threshold-count 3
```

**Note the Target Group ARN** from the output.

### Step 6: Register Instances with Target Group

```powershell
# Register each instance (replace TARGET_GROUP_ARN and INSTANCE_ID)
aws elbv2 register-targets --target-group-arn "[TARGET_GROUP_ARN]" --targets "Id=[INSTANCE_ID],Port=8080"
```

### Step 7: Create Application Load Balancer

```powershell
# Get default security group
aws ec2 describe-security-groups --filters "Name=group-name,Values=default" --query 'SecurityGroups[0].GroupId' --output text

# Create Load Balancer (replace SUBNET_IDS and SECURITY_GROUP_ID)
aws elbv2 create-load-balancer --name "caf-api-alb" --subnets [SUBNET_ID_1] [SUBNET_ID_2] --security-groups [SECURITY_GROUP_ID]
```

**Note the Load Balancer ARN and DNS name** from the output.

### Step 8: Create HTTPS Listener

```powershell
# Create HTTPS listener (replace LOAD_BALANCER_ARN, CERTIFICATE_ARN, TARGET_GROUP_ARN)
aws elbv2 create-listener --load-balancer-arn "[LOAD_BALANCER_ARN]" --protocol HTTPS --port 443 --certificates "CertificateArn=[CERTIFICATE_ARN]" --default-actions "Type=forward,TargetGroupArn=[TARGET_GROUP_ARN]"
```

### Step 9: Create HTTP Listener (Redirect to HTTPS)

```powershell
# Create HTTP listener with redirect (replace LOAD_BALANCER_ARN)
aws elbv2 create-listener --load-balancer-arn "[LOAD_BALANCER_ARN]" --protocol HTTP --port 80 --default-actions "Type=redirect,RedirectConfig={Protocol=HTTPS,Port=443,StatusCode=HTTP_301}"
```

### Step 10: Get Load Balancer DNS Name

```powershell
# Get Load Balancer DNS name
aws elbv2 describe-load-balancers --load-balancer-arns "[LOAD_BALANCER_ARN]" --query 'LoadBalancers[0].DNSName' --output text
```

## 📋 DNS Configuration

### Add A Records to Your Domain Provider

```
Type: A
Name: api
Value: [LOAD_BALANCER_DNS_NAME]
TTL: 300

Type: A
Name: mobile  
Value: [LOAD_BALANCER_DNS_NAME]
TTL: 300
```

### Add CNAME Records to Your Domain Provider

```
Type: CNAME
Name: admin
Value: cname.vercel-dns.com
TTL: 300

Type: CNAME
Name: www
Value: cname.vercel-dns.com
TTL: 300
```

## 🔧 Security Group Updates

### Update Security Groups to Allow HTTPS

```powershell
# Get your security group ID
aws ec2 describe-security-groups --filters "Name=group-name,Values=default" --query 'SecurityGroups[0].GroupId' --output text

# Add HTTPS rule (replace SECURITY_GROUP_ID)
aws ec2 authorize-security-group-ingress --group-id [SECURITY_GROUP_ID] --protocol tcp --port 443 --cidr 0.0.0.0/0

# Add HTTP rule (for redirects)
aws ec2 authorize-security-group-ingress --group-id [SECURITY_GROUP_ID] --protocol tcp --port 80 --cidr 0.0.0.0/0
```

## 🧪 Testing

### Test Load Balancer
```powershell
# Test HTTP (should redirect to HTTPS)
curl -I http://[LOAD_BALANCER_DNS_NAME]/api/v1/health

# Test HTTPS
curl -I https://[LOAD_BALANCER_DNS_NAME]/api/v1/health
```

### Test Domain (after DNS propagation)
```powershell
# Test API domain
curl -I https://api.caf-mexico.org/api/v1/health

# Test admin domain (after Vercel setup)
curl -I https://admin.caf-mexico.org
```

## 📊 Expected Costs

- **Application Load Balancer**: ~$16/month
- **SSL Certificate**: Free (AWS Certificate Manager)
- **Data Transfer**: ~$0.01/GB
- **Target Group**: Free

## ⚠️ Troubleshooting

### Certificate Issues
- Ensure DNS validation record is added
- Wait for certificate to show "Issued" status
- Check certificate is in correct region (us-east-1)

### Load Balancer Issues
- Verify security groups allow traffic
- Check target group health checks
- Ensure instances are running and healthy

### DNS Issues
- Wait 24-48 hours for full propagation
- Use `nslookup` to verify DNS resolution
- Check with different DNS servers

## 🎯 Next Steps

1. **Complete AWS setup** using commands above
2. **Add DNS records** to your domain provider
3. **Configure Vercel** custom domain
4. **Test all endpoints**
5. **Update CORS** in your Go API
