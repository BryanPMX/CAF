# Vercel Custom Domain Setup Guide

## 🚀 Step 2: Configure Vercel Custom Domains

### Prerequisites
- ✅ DNS CNAME records added (admin and portal)
- ✅ Vercel account
- ✅ Admin portal project deployed
- ✅ Marketing site ready for deployment

## 📋 Step 2A: Configure Admin Portal Domain

### 1. Access Vercel Dashboard
1. Go to: https://vercel.com/dashboard
2. Log in to your account
3. Find your `admin-portal` project

### 2. Add Custom Domain
1. Click on your `admin-portal` project
2. Go to **Settings** tab
3. Click **Domains** in the left sidebar
4. Click **Add Domain**
5. Enter: `admin.caf-mexico.org`
6. Click **Add**

### 3. Verify Domain
- Vercel will check DNS configuration
- Should show "Valid Configuration" (green checkmark)
- If "Invalid Configuration", wait 5-10 minutes for DNS propagation

## 📋 Step 2B: Deploy Marketing Site

### 1. Prepare Marketing Site
Your marketing site is already configured for Vercel with:
- ✅ `svelte.config.js` - Uses adapter-auto
- ✅ `vite.config.js` - Vite configuration
- ✅ `package.json` - Build scripts

### 2. Deploy to Vercel
1. Go to Vercel Dashboard
2. Click **Add New Project**
3. Import from GitHub (if connected) or drag `marketing` folder
4. Configure build settings:
   - **Framework Preset**: SvelteKit
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`
   - **Install Command**: `npm install`

### 3. Add Custom Domain
1. Once deployed, go to Settings → Domains
2. Add: `portal.caf-mexico.org`
3. Verify the domain

## 🔧 Alternative: Manual Deployment

If you prefer to deploy manually:

### 1. Build Marketing Site
```bash
cd marketing
npm install
npm run build
```

### 2. Deploy to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

## 🧪 Testing Your Domains

### After Vercel Setup
```bash
# Test admin portal
curl -I https://admin.caf-mexico.org

# Test marketing portal
curl -I https://portal.caf-mexico.org
```

### Expected Results
```
HTTP/2 200
server: Vercel
x-vercel-id: [some-id]
```

## ⚠️ Common Issues & Solutions

### Issue: "Invalid Configuration"
**Solution**: 
- Wait 5-10 minutes for DNS propagation
- Check DNS records are correct
- Try refreshing the Vercel page

### Issue: "Domain Already in Use"
**Solution**: 
- Check if domain is already added
- Remove duplicate entries
- Wait for DNS changes

### Issue: "SSL Certificate Pending"
**Solution**: 
- Wait 5-15 minutes for SSL provisioning
- Vercel automatically provides SSL certificates
- Check certificate status in domain settings

## 🎯 Success Indicators

### ✅ Admin Portal Ready When:
- [ ] `admin.caf-mexico.org` shows "Valid Configuration"
- [ ] SSL certificate is active
- [ ] Site loads without errors
- [ ] Login functionality works

### ✅ Marketing Portal Ready When:
- [ ] `portal.caf-mexico.org` shows "Valid Configuration"
- [ ] SSL certificate is active
- [ ] Site loads without errors
- [ ] All pages accessible

## 📊 Expected Timeline

- **DNS Propagation**: 5-15 minutes
- **Vercel Domain Verification**: 1-5 minutes
- **SSL Certificate**: 5-15 minutes
- **Full Setup**: 15-30 minutes

## 🚀 Next Steps After Vercel

Once Vercel domains are configured:

1. **Test Both Domains** - Verify they load correctly
2. **Set Up AWS** - Create Load Balancer and SSL certificate
3. **Add API A Records** - Point `api.caf-mexico.org` to AWS
4. **Test Complete System** - Verify all endpoints work

## 💡 Pro Tips

### DNS Propagation Check
```bash
# Check DNS propagation
nslookup admin.caf-mexico.org
nslookup portal.caf-mexico.org
```

### Vercel CLI Commands
```bash
# Check deployment status
vercel ls

# View logs
vercel logs [deployment-url]

# Check domain status
vercel domains ls
```

## 📞 Support

### Vercel Support
- **Documentation**: https://vercel.com/docs
- **Support**: https://vercel.com/support
- **Status**: https://vercel.com/status

### Common Commands
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy project
vercel --prod

# Check domains
vercel domains ls
```

---

**Next Action**: Configure Vercel custom domains
**Timeline**: 15-30 minutes
**Priority**: High - Required for production access
