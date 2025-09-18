# Updated CAF Domain Configuration - caf-mexico.org

## 🌐 Final Domain Structure

### Squarespace (Existing)
```
www.caf-mexico.org          → Squarespace marketing site
```

### Vercel (New)
```
admin.caf-mexico.org        → Next.js admin portal
portal.caf-mexico.org       → Svelte marketing site
```

### AWS (Later)
```
api.caf-mexico.org          → Go API server
mobile.caf-mexico.org       → Mobile API endpoints
```

## 📋 DNS Records to Add

### CNAME Records (Add Now)
```
Host: admin
Type: CNAME
Priority: 0
TTL: 300
Data: cname.vercel-dns.com

Host: portal
Type: CNAME
Priority: 0
TTL: 300
Data: cname.vercel-dns.com
```

### A Records (Add After AWS Setup)
```
Host: api
Type: A
Priority: 0
TTL: 300
Data: [LOAD_BALANCER_IP]

Host: mobile
Type: A
Priority: 0
TTL: 300
Data: [LOAD_BALANCER_IP]
```

## 🚀 Deployment URLs

### Production URLs
- **Squarespace Site**: https://www.caf-mexico.org
- **Admin Portal**: https://admin.caf-mexico.org
- **Marketing Portal**: https://portal.caf-mexico.org
- **API Backend**: https://api.caf-mexico.org/api/v1

### Development URLs
- **Admin Portal**: http://localhost:3000
- **API**: http://localhost:8080/api/v1

## 🔧 Environment Variables

### Vercel Environment Variables
```bash
NEXT_PUBLIC_API_URL=https://api.caf-mexico.org/api/v1
NODE_ENV=production
```

### AWS CORS Configuration
```go
allowedOrigins := []string{
    "https://admin.caf-mexico.org",
    "https://portal.caf-mexico.org",
    "https://www.caf-mexico.org",  // Squarespace site
    "http://localhost:3000",       // development
}
```

## 📱 Mobile App Configuration

### Flutter App API Configuration
```dart
const String apiBaseUrl = 'https://api.caf-mexico.org/api/v1';
const String adminPortalUrl = 'https://admin.caf-mexico.org';
const String marketingPortalUrl = 'https://portal.caf-mexico.org';
```

## 🧪 Testing Checklist

### DNS Resolution
- [ ] `nslookup admin.caf-mexico.org`
- [ ] `nslookup portal.caf-mexico.org`
- [ ] `nslookup api.caf-mexico.org` (after AWS setup)

### Application Testing
- [ ] Admin portal loads: https://admin.caf-mexico.org
- [ ] Marketing portal loads: https://portal.caf-mexico.org
- [ ] Squarespace site loads: https://www.caf-mexico.org
- [ ] API health check: https://api.caf-mexico.org/api/v1/health
- [ ] Login functionality works
- [ ] No mixed content errors

## 💡 Benefits of This Setup

### Clear Separation
- **Squarespace**: Professional marketing site
- **Vercel**: Dynamic admin portal and marketing portal
- **AWS**: Robust API backend

### Professional URLs
- `admin.caf-mexico.org` - Clear admin access
- `portal.caf-mexico.org` - Professional portal
- `www.caf-mexico.org` - Main marketing site

### Scalability
- Each service can scale independently
- Easy to add more subdomains
- Clear service boundaries

## 🎯 Next Steps

1. **Add DNS CNAME records** (admin and portal)
2. **Configure Vercel** custom domains
3. **Set up AWS** Load Balancer and SSL
4. **Add DNS A records** for API
5. **Test all endpoints**

## 📞 Support

- **Squarespace**: Keep existing www setup
- **Vercel**: Add admin and portal domains
- **AWS**: Set up API infrastructure
- **DNS**: Manage all subdomains centrally
