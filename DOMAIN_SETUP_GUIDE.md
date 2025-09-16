# CAF Domain Setup & HTTPS Configuration Guide

## Overview
This guide will help you set up a custom domain for your Vercel deployment and configure HTTPS for your AWS API to resolve the HTTP/HTTPS mismatch.

## Current Architecture
- **Frontend**: Next.js app on Vercel (requires HTTPS)
- **Backend**: Go API on AWS (currently HTTP only)
- **Issue**: Mixed content policy blocks HTTP API calls from HTTPS frontend

## Step 1: Domain Registration & DNS Setup

### 1.1 Purchase Domain
Choose a domain provider and register your domain (e.g., `yourdomain.com`)

### 1.2 Configure DNS Records
Add these DNS records to your domain:

```
# For Vercel frontend
admin.yourdomain.com    CNAME    cname.vercel-dns.com

# For AWS API (after HTTPS setup)
api.yourdomain.com      A        [ALB-IP-ADDRESS]
```

## Step 2: AWS HTTPS Configuration

### 2.1 Option A: Application Load Balancer (Recommended)

#### Create SSL Certificate
```bash
# Request SSL certificate via AWS Certificate Manager
aws acm request-certificate \
  --domain-name api.yourdomain.com \
  --validation-method DNS \
  --region us-east-1
```

#### Configure Application Load Balancer
1. Go to EC2 → Load Balancers
2. Create Application Load Balancer
3. Configure HTTPS listener (port 443)
4. Attach SSL certificate from ACM
5. Point to your existing EC2 instances
6. Update security groups to allow HTTPS traffic

#### Update DNS
Create A record for `api.yourdomain.com` pointing to ALB DNS name

### 2.2 Option B: CloudFront Distribution

#### Create CloudFront Distribution
1. Go to CloudFront console
2. Create distribution
3. Origin: Your existing AWS ALB endpoint
4. Configure custom SSL certificate
5. Set up custom domain `api.yourdomain.com`

#### Benefits
- Global CDN
- Automatic HTTPS
- Better performance
- DDoS protection

## Step 3: Vercel Configuration

### 3.1 Add Custom Domain
1. Go to Vercel dashboard
2. Select your `admin-portal` project
3. Go to Settings → Domains
4. Add `admin.yourdomain.com`

### 3.2 Update Environment Variables
The `vercel.json` has been updated with HTTPS API URL:
```json
{
  "env": {
    "NEXT_PUBLIC_API_URL": "https://api.yourdomain.com/api/v1"
  }
}
```

### 3.3 Deploy Changes
```bash
cd admin-portal
git add .
git commit -m "Update API URL to HTTPS"
git push
```

## Step 4: Testing & Validation

### 4.1 Test HTTPS API
```bash
# Test your API endpoint
curl -I https://api.yourdomain.com/api/v1/health
```

### 4.2 Test Frontend
1. Visit `https://admin.yourdomain.com`
2. Check browser console for mixed content errors
3. Verify API calls are working

### 4.3 SSL Certificate Validation
Use online tools to verify SSL configuration:
- SSL Labs: https://www.ssllabs.com/ssltest/
- SSL Checker: https://www.sslchecker.com/

## Step 5: Production Environment Variables

### 5.1 Update Vercel Environment Variables
In Vercel dashboard, update:
- `NEXT_PUBLIC_API_URL`: `https://api.yourdomain.com/api/v1`
- `NODE_ENV`: `production`

### 5.2 Update AWS Environment Variables
Ensure your Go API has proper CORS configuration for the new domain:
```go
// Add to your CORS middleware
allowedOrigins := []string{
    "https://admin.yourdomain.com",
    "https://yourdomain.com",
}
```

## Step 6: Security Headers

### 6.1 Update Next.js Headers
The `next.config.js` already includes security headers. Verify they're working:
- X-Content-Type-Options
- X-Frame-Options
- X-XSS-Protection

### 6.2 AWS Security Groups
Ensure your AWS security groups allow:
- HTTPS (port 443) from anywhere
- HTTP (port 80) for redirects
- Your application port from ALB only

## Troubleshooting

### Common Issues

1. **Mixed Content Errors**
   - Ensure all API calls use HTTPS
   - Check for hardcoded HTTP URLs in code

2. **SSL Certificate Issues**
   - Verify DNS propagation (can take 24-48 hours)
   - Check certificate validation status in ACM

3. **CORS Errors**
   - Update CORS configuration in Go API
   - Add new domain to allowed origins

4. **DNS Propagation**
   - Use `dig` or `nslookup` to check DNS
   - Wait for full propagation before testing

### Debug Commands
```bash
# Check DNS resolution
nslookup api.yourdomain.com
dig api.yourdomain.com

# Test SSL certificate
openssl s_client -connect api.yourdomain.com:443 -servername api.yourdomain.com

# Check HTTP redirects
curl -I http://api.yourdomain.com/api/v1/health
curl -I https://api.yourdomain.com/api/v1/health
```

## Cost Considerations

### AWS Costs
- Application Load Balancer: ~$16/month
- SSL Certificate: Free (AWS Certificate Manager)
- CloudFront: Pay-per-use (if using Option B)

### Domain Costs
- Domain registration: ~$10-15/year
- DNS hosting: Usually included with domain

## Next Steps

1. **Immediate**: Set up SSL certificate and ALB
2. **Short-term**: Configure custom domains
3. **Long-term**: Consider CloudFront for better performance
4. **Monitoring**: Set up CloudWatch alarms for API health

## Support

If you encounter issues:
1. Check AWS CloudWatch logs
2. Verify Vercel deployment logs
3. Test API endpoints independently
4. Check browser developer tools for errors
