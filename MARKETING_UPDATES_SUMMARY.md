# Marketing Site Updates - Hardcoded URL Fixed

## ✅ Changes Made

### 1. Created Configuration File
**File**: `marketing/src/lib/config.js`
- Centralized environment variable management
- Helper functions for getting URLs
- Fallback values for development

### 2. Updated Main Page
**File**: `marketing/src/routes/+page.svelte`
- **Before**: `href="http://localhost:37507"`
- **After**: `href={adminPortalUrl}`
- Added import for configuration
- Added variable to store admin portal URL

### 3. Created Environment Template
**File**: `marketing/env.example`
- Template for environment variables
- All required variables listed
- Optional variables included

## 🔧 Environment Variables Required

### Essential Variables
```bash
VITE_SITE_URL=https://portal.caf-mexico.org
VITE_API_URL=https://api.caf-mexico.org/api/v1
VITE_ADMIN_PORTAL_URL=https://admin.caf-mexico.org
```

### Contact Information
```bash
VITE_CONTACT_EMAIL=info@caf-mexico.org
VITE_CONTACT_PHONE=+1-915-555-0123
VITE_ADDRESS=El Paso, Texas
```

## 🚀 How It Works Now

### Development Mode
- Uses fallback values from config.js
- Admin portal URL defaults to `https://admin.caf-mexico.org`

### Production Mode
- Uses environment variables from Vercel
- Admin portal URL comes from `VITE_ADMIN_PORTAL_URL`

### Dynamic URL Resolution
```javascript
// In config.js
export const getAdminPortalUrl = () => {
  return config.api.adminPortalUrl;
};

// In +page.svelte
let adminPortalUrl = getAdminPortalUrl();
```

## 📋 Next Steps

### 1. Add Environment Variables to Vercel
When deploying to Vercel, add these environment variables:

```
VITE_SITE_URL=https://portal.caf-mexico.org
VITE_API_URL=https://api.caf-mexico.org/api/v1
VITE_ADMIN_PORTAL_URL=https://admin.caf-mexico.org
VITE_CONTACT_EMAIL=info@caf-mexico.org
VITE_CONTACT_PHONE=+1-915-555-0123
VITE_ADDRESS=El Paso, Texas
```

### 2. Deploy Marketing Site
1. Go to Vercel Dashboard
2. Add new project: `caf-marketing-portal`
3. Import marketing folder
4. Add environment variables
5. Deploy

### 3. Test the Fix
After deployment, test that:
- "Solicitar Ayuda" button points to `https://admin.caf-mexico.org`
- No more localhost URLs
- All links work correctly

## 🧪 Testing

### Local Development
```bash
cd marketing
npm run dev
# Check that "Solicitar Ayuda" button works
```

### Production Testing
```bash
# Test deployed site
curl -I https://portal.caf-mexico.org
# Verify admin portal link
```

## ✅ Benefits of This Update

1. **No More Hardcoded URLs** - All URLs are now configurable
2. **Environment-Specific** - Different URLs for dev/prod
3. **Centralized Config** - Easy to manage all URLs in one place
4. **Production Ready** - Ready for Vercel deployment
5. **Maintainable** - Easy to update URLs in the future

## 🎯 Ready for Deployment

Your marketing site is now ready for Vercel deployment with:
- ✅ Environment variables configured
- ✅ Hardcoded URLs removed
- ✅ Configuration file created
- ✅ Template file provided

The "Solicitar Ayuda" button will now correctly point to your admin portal at `https://admin.caf-mexico.org` instead of the localhost URL.
