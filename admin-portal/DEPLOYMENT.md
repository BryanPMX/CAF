# CAF Admin Portal - Vercel Deployment Guide

## 🚀 Deployment Checklist

### ✅ Pre-Deployment Verification
- [x] Dependencies are up-to-date
- [x] Build configuration is optimized
- [x] API integration is properly configured
- [x] TypeScript compilation is clean
- [x] Authentication system is complete
- [x] UI components are ready

### 🔧 Required Environment Variables

Configure these in your Vercel dashboard. You can copy the values from `env.production` file:

**CRITICAL**: Update `NEXT_PUBLIC_API_URL` to your actual AWS ALB endpoint:
```bash
NEXT_PUBLIC_API_URL=https://your-alb-endpoint.us-east-2.elb.amazonaws.com/api/v1
```

See `env.production` file for complete environment variable configuration.

### 📋 Deployment Steps

1. **Connect Repository**
   - Go to Vercel dashboard
   - Import your GitHub repository
   - Select the `admin-portal` folder as root directory

2. **Configure Environment Variables**
   - Add all variables listed above
   - **CRITICAL**: Set `NEXT_PUBLIC_API_URL` to your AWS ALB endpoint

3. **Build Settings**
   - Framework: Next.js
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm install`

4. **Deploy**
   - Click "Deploy"
   - Monitor build logs for any issues

### 🔍 Post-Deployment Testing

Test these endpoints after deployment:

```bash
# Health check
curl https://your-vercel-app.vercel.app/

# Login page
curl https://your-vercel-app.vercel.app/login

# API connectivity (should connect to AWS backend)
curl https://your-vercel-app.vercel.app/api/health
```

### 🚨 Common Issues & Solutions

#### Issue 1: API Connection Failed
**Problem**: Frontend can't connect to AWS backend
**Solution**: 
- Verify `NEXT_PUBLIC_API_URL` is set correctly
- Check AWS ALB security groups allow traffic from Vercel
- Ensure CORS is configured on backend

#### Issue 2: Build Failures
**Problem**: Build process fails
**Solution**:
- Check Node.js version (should be 18.x)
- Verify all dependencies are installed
- Check for TypeScript errors

#### Issue 3: Authentication Issues
**Problem**: Login doesn't work
**Solution**:
- Verify JWT secret is consistent between frontend and backend
- Check cookie settings for production domain
- Ensure HTTPS is enabled

### 🔐 Security Considerations

1. **CORS Configuration**
   - Update backend CORS to allow your Vercel domain
   - Remove wildcard (*) origins in production

2. **Cookie Security**
   - Enable secure cookies in production
   - Set proper SameSite attributes

3. **Environment Variables**
   - Never commit sensitive data to repository
   - Use Vercel's environment variable system

### 📊 Performance Optimizations

Your admin portal includes these optimizations:
- ✅ Code splitting and lazy loading
- ✅ Image optimization
- ✅ Bundle compression
- ✅ Tree shaking
- ✅ SWC minification
- ✅ CSS optimization

### 🔄 Continuous Deployment

Set up automatic deployments:
1. Connect GitHub repository
2. Enable automatic deployments on push
3. Configure branch protection rules
4. Set up preview deployments for pull requests

### 📞 Support

If you encounter issues:
1. Check Vercel build logs
2. Verify environment variables
3. Test API connectivity
4. Check browser console for errors

## 🎉 Ready for Production!

Your admin portal is fully configured and ready for Vercel deployment. The main requirement is updating the `NEXT_PUBLIC_API_URL` environment variable to point to your AWS ALB endpoint.
