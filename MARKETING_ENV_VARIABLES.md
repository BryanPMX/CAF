# Marketing Site Environment Variables for Vercel

## 🔧 Required Environment Variables

### Production Environment Variables

```bash
# Basic Configuration
NODE_ENV=production
NEXT_PUBLIC_SITE_URL=https://portal.caf-mexico.org

# API Configuration
NEXT_PUBLIC_API_URL=https://api.caf-mexico.org/api/v1
NEXT_PUBLIC_ADMIN_PORTAL_URL=https://admin.caf-mexico.org

# Contact Information
NEXT_PUBLIC_CONTACT_EMAIL=info@caf-mexico.org
NEXT_PUBLIC_CONTACT_PHONE=+1-XXX-XXX-XXXX
NEXT_PUBLIC_ADDRESS=El Paso, Texas

# Social Media (if applicable)
NEXT_PUBLIC_FACEBOOK_URL=https://facebook.com/caf-mexico
NEXT_PUBLIC_TWITTER_URL=https://twitter.com/caf_mexico
NEXT_PUBLIC_INSTAGRAM_URL=https://instagram.com/caf_mexico

# Analytics (optional)
NEXT_PUBLIC_GA_TRACKING_ID=G-XXXXXXXXXX
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key

# Build Configuration
NEXT_PUBLIC_BUILD_TIME=${BUILD_TIME}
NEXT_PUBLIC_VERSION=${VERSION}
```

## 🚀 Vercel Deployment Configuration

### Step 1: Add Environment Variables in Vercel

1. **Go to Vercel Dashboard**
2. **Select your `caf-marketing-portal` project**
3. **Go to Settings → Environment Variables**
4. **Add each variable** with these settings:
   - **Environment**: Production, Preview, Development
   - **Value**: As shown above

### Step 2: Update Marketing Site Code

Let me create an environment configuration file for your marketing site:

```javascript
// marketing/src/lib/config.js
export const config = {
  site: {
    name: 'Centro de Apoyo para la Familia A.C.',
    url: import.meta.env.VITE_SITE_URL || 'https://portal.caf-mexico.org',
    description: 'Brindamos apoyo legal, psicológico y social a familias vulnerables'
  },
  api: {
    baseUrl: import.meta.env.VITE_API_URL || 'https://api.caf-mexico.org/api/v1',
    adminPortalUrl: import.meta.env.VITE_ADMIN_PORTAL_URL || 'https://admin.caf-mexico.org'
  },
  contact: {
    email: import.meta.env.VITE_CONTACT_EMAIL || 'info@caf-mexico.org',
    phone: import.meta.env.VITE_CONTACT_PHONE || '+1-XXX-XXX-XXXX',
    address: import.meta.env.VITE_ADDRESS || 'El Paso, Texas'
  },
  social: {
    facebook: import.meta.env.VITE_FACEBOOK_URL,
    twitter: import.meta.env.VITE_TWITTER_URL,
    instagram: import.meta.env.VITE_INSTAGRAM_URL
  }
};
```

## 📋 Environment Variables Breakdown

### Essential Variables (Required)
```bash
NODE_ENV=production
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

### Optional Variables
```bash
# Social Media
VITE_FACEBOOK_URL=https://facebook.com/caf-mexico
VITE_TWITTER_URL=https://twitter.com/caf_mexico
VITE_INSTAGRAM_URL=https://instagram.com/caf_mexico

# Analytics
VITE_GA_TRACKING_ID=G-XXXXXXXXXX
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_key
```

## 🔧 Fix the Hardcoded URL

I noticed this hardcoded URL in your marketing site:

```svelte
<!-- Current (hardcoded) -->
<a href="http://localhost:37507" target="_blank">
  Solicitar Ayuda
</a>

<!-- Should be (environment variable) -->
<a href={config.api.adminPortalUrl} target="_blank">
  Solicitar Ayuda
</a>
```

## 🚀 Vercel Environment Variables Setup

### Method 1: Vercel Dashboard
1. Go to your project settings
2. Click "Environment Variables"
3. Add each variable:
   - **Name**: `VITE_SITE_URL`
   - **Value**: `https://portal.caf-mexico.org`
   - **Environment**: Production, Preview, Development

### Method 2: Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Add environment variables
vercel env add VITE_SITE_URL
vercel env add VITE_API_URL
vercel env add VITE_ADMIN_PORTAL_URL
```

## 📝 Environment Variables Template

Copy this template for your Vercel deployment:

```
NODE_ENV=production
VITE_SITE_URL=https://portal.caf-mexico.org
VITE_API_URL=https://api.caf-mexico.org/api/v1
VITE_ADMIN_PORTAL_URL=https://admin.caf-mexico.org
VITE_CONTACT_EMAIL=info@caf-mexico.org
VITE_CONTACT_PHONE=+1-915-555-0123
VITE_ADDRESS=El Paso, Texas
```

## 🧪 Testing Environment Variables

After deployment, test that variables are working:

```bash
# Check if environment variables are loaded
curl https://portal.caf-mexico.org | grep -i "caf-mexico.org"

# Test API connection
curl https://api.caf-mexico.org/api/v1/health
```

## ⚠️ Important Notes

### Vite Environment Variables
- **Prefix**: Must start with `VITE_` to be accessible in client-side code
- **Build Time**: Variables are embedded at build time
- **Security**: Don't put sensitive data in `VITE_` variables

### Vercel Environment Variables
- **Scope**: Can be set for Production, Preview, or Development
- **Build**: Variables are available during build process
- **Runtime**: Available in server-side code

## 🎯 Next Steps

1. **Add environment variables** to Vercel project
2. **Update marketing site code** to use environment variables
3. **Deploy and test** the updated site
4. **Verify all URLs** are working correctly

Would you like me to help you update the marketing site code to use these environment variables?
