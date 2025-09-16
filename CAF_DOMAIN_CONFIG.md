# CAF Domain Configuration - caf-mexico.org

## 🌐 Recommended Domain Structure

### Primary Domain: `caf-mexico.org`

```
# Main Website (Marketing)
www.caf-mexico.org          → Marketing website (Svelte)

# Admin Portal (Vercel)
admin.caf-mexico.org        → Next.js admin portal

# API Backend (AWS)
api.caf-mexico.org          → Go API server

# Mobile App API (if needed)
mobile.caf-mexico.org       → Mobile-specific endpoints
```

## 📋 DNS Configuration

### A Records (Point to AWS Load Balancer)
```
api.caf-mexico.org          A    [ALB-IP-ADDRESS]
mobile.caf-mexico.org       A    [ALB-IP-ADDRESS]
```

### CNAME Records (Point to Vercel)
```
admin.caf-mexico.org        CNAME    cname.vercel-dns.com
www.caf-mexico.org          CNAME    cname.vercel-dns.com
```

## 🔧 Environment Variables

### Vercel Environment Variables
```bash
NEXT_PUBLIC_API_URL=https://api.caf-mexico.org/api/v1
NODE_ENV=production
```

### AWS Environment Variables
```bash
# Update CORS origins in your Go API
allowedOrigins := []string{
    "https://admin.caf-mexico.org",
    "https://www.caf-mexico.org",
    "http://localhost:3000", // for development
}
```

## 🚀 Deployment URLs

### Production URLs
- **Admin Portal**: https://admin.caf-mexico.org
- **API Health**: https://api.caf-mexico.org/api/v1/health
- **Marketing Site**: https://www.caf-mexico.org
- **API Login**: https://api.caf-mexico.org/api/v1/auth/login

### Development URLs
- **Admin Portal**: http://localhost:3000
- **API**: http://localhost:8080/api/v1

## 📊 SSL Certificates Required

### AWS Certificate Manager
- **Primary**: `api.caf-mexico.org`
- **Wildcard**: `*.caf-mexico.org` (optional, covers all subdomains)

### Vercel SSL
- Automatically provided by Vercel for `admin.caf-mexico.org`
- Automatically provided by Vercel for `www.caf-mexico.org`

## 🔒 Security Headers

### CORS Configuration
```go
// In your Go API middleware
c.Header("Access-Control-Allow-Origin", "https://admin.caf-mexico.org")
c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
```

### Content Security Policy
```javascript
// In Next.js config
Content-Security-Policy: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.caf-mexico.org"
```

## 📱 Mobile App Configuration

### Flutter App API Configuration
```dart
// In your Flutter app
const String apiBaseUrl = 'https://api.caf-mexico.org/api/v1';
const String adminPortalUrl = 'https://admin.caf-mexico.org';
```

## 🧪 Testing Checklist

### Domain Resolution
- [ ] `nslookup admin.caf-mexico.org`
- [ ] `nslookup api.caf-mexico.org`
- [ ] `nslookup www.caf-mexico.org`

### SSL Certificate Validation
- [ ] `openssl s_client -connect api.caf-mexico.org:443`
- [ ] Test SSL Labs: https://www.ssllabs.com/ssltest/

### Application Testing
- [ ] Admin portal loads: https://admin.caf-mexico.org
- [ ] API health check: https://api.caf-mexico.org/api/v1/health
- [ ] Login functionality works
- [ ] CORS headers are correct
- [ ] No mixed content errors

## 💰 Cost Estimation

### Domain Registration
- **caf-mexico.org**: ~$12-15/year
- **DNS hosting**: Usually included

### AWS Costs
- **Application Load Balancer**: ~$16/month
- **SSL Certificate**: Free (AWS Certificate Manager)
- **Route 53**: ~$0.50/month (if using AWS DNS)

### Vercel Costs
- **Custom Domain**: Free on Pro plan
- **SSL Certificate**: Free

## 🎯 Next Steps

1. **Register Domain**: Purchase `caf-mexico.org`
2. **Configure DNS**: Set up DNS records as shown above
3. **Request SSL Certificate**: Use AWS Certificate Manager
4. **Update Vercel**: Add custom domain in Vercel dashboard
5. **Deploy**: Push changes and test all endpoints
6. **Monitor**: Set up monitoring and alerts

## 📞 Support Contacts

- **Domain Registrar**: [Your chosen provider]
- **DNS Provider**: [Your DNS service]
- **AWS Support**: AWS Console → Support
- **Vercel Support**: Vercel Dashboard → Support
