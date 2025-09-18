# Environment Variables Configuration

## Vercel Environment Variables
Update these in your Vercel dashboard (Settings → Environment Variables):

### Production Environment
```
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api/v1
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
NEXT_WEBPACK_USE_WORKER_THREADS=1
SWC_MINIFY=true
EXPERIMENTAL_OPTIMIZE_PACKAGE_IMPORTS=true
NEXT_PUBLIC_DEV_MODE=false
NEXT_PUBLIC_ENABLE_PERFORMANCE_MONITORING=false
```

### Development Environment (Local)
```
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
NODE_ENV=development
```

## AWS Environment Variables
Update these in your Go API environment:

### Production Environment
```
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_HOST=your_rds_endpoint
DB_NAME=your_db_name
DB_PORT=5432
DB_SSLMODE=require
PORT=8080
JWT_SECRET=your_jwt_secret
```

## CORS Configuration
Update your Go API CORS middleware to include the new domain:

```go
allowedOrigins := []string{
    "https://admin.yourdomain.com",
    "https://yourdomain.com",
    "http://localhost:3000", // for development
}
```

## DNS Records
Add these DNS records to your domain provider:

```
# Vercel frontend
admin.yourdomain.com    CNAME    cname.vercel-dns.com

# AWS API (after ALB setup)
api.yourdomain.com      A        [ALB-DNS-NAME]
```

## Testing URLs
After setup, test these URLs:

- Frontend: https://admin.yourdomain.com
- API Health: https://api.yourdomain.com/api/v1/health
- API Login: https://api.yourdomain.com/api/v1/auth/login
