# CAF Domain Setup Checklist - caf-mexico.org

## ✅ Domain Registration Complete
- [x] `caf-mexico.org` registered ($9/year)
- [x] `caf-mexico.com` registered ($14/year) - backup

## 🌐 DNS Configuration Required

### Immediate Actions (Can do now)
- [ ] **Add CNAME records** to your domain provider:
  ```
  admin.caf-mexico.org → cname.vercel-dns.com
  www.caf-mexico.org → cname.vercel-dns.com
  ```

### After AWS Setup (Need Load Balancer IP)
- [ ] **Add A records** to your domain provider:
  ```
  api.caf-mexico.org → [LOAD_BALANCER_IP]
  mobile.caf-mexico.org → [LOAD_BALANCER_IP]
  ```

## 🚀 AWS Setup Required

### Step 1: SSL Certificate
- [ ] Request SSL certificate for `api.caf-mexico.org`
- [ ] Validate certificate via DNS
- [ ] Wait for "Issued" status

### Step 2: Load Balancer Setup
- [ ] Create Target Group
- [ ] Register EC2 instances
- [ ] Create Application Load Balancer
- [ ] Configure HTTPS listener (port 443)
- [ ] Configure HTTP listener (redirect to HTTPS)
- [ ] Update security groups

### Step 3: Get Load Balancer IP
- [ ] Note Load Balancer DNS name
- [ ] Update DNS A records

## 🔧 Vercel Configuration

### Admin Portal Setup
- [ ] Go to Vercel dashboard
- [ ] Select `admin-portal` project
- [ ] Go to Settings → Domains
- [ ] Add `admin.caf-mexico.org`
- [ ] Verify SSL certificate

### Marketing Site Setup
- [ ] Deploy marketing site to Vercel
- [ ] Add `www.caf-mexico.org` domain
- [ ] Configure redirects

## 🧪 Testing Checklist

### DNS Resolution
- [ ] `nslookup api.caf-mexico.org`
- [ ] `nslookup admin.caf-mexico.org`
- [ ] `nslookup www.caf-mexico.org`

### SSL Certificates
- [ ] Test SSL Labs: https://www.ssllabs.com/ssltest/
- [ ] Verify certificate validity
- [ ] Check certificate chain

### Application Testing
- [ ] Admin portal loads: https://admin.caf-mexico.org
- [ ] API health check: https://api.caf-mexico.org/api/v1/health
- [ ] Marketing site loads: https://www.caf-mexico.org
- [ ] Login functionality works
- [ ] No mixed content errors

## 📱 Mobile App Configuration

### Flutter App Updates
- [ ] Update API base URL in `auth_service.dart`
- [ ] Update admin portal URL
- [ ] Test mobile app connectivity

## 🔒 Security Configuration

### CORS Updates
- [ ] Update Go API CORS origins:
  ```go
  allowedOrigins := []string{
      "https://admin.caf-mexico.org",
      "https://www.caf-mexico.org",
      "http://localhost:3000", // development
  }
  ```

### Security Headers
- [ ] Verify security headers in Next.js
- [ ] Check Content Security Policy
- [ ] Validate HTTPS redirects

## 📊 Monitoring Setup

### AWS CloudWatch
- [ ] Set up Load Balancer monitoring
- [ ] Configure health check alarms
- [ ] Set up API error monitoring

### Vercel Analytics
- [ ] Enable Vercel Analytics
- [ ] Set up performance monitoring
- [ ] Configure error tracking

## 💰 Cost Monitoring

### AWS Costs
- [ ] Monitor Load Balancer costs (~$16/month)
- [ ] Track data transfer costs
- [ ] Set up billing alerts

### Domain Costs
- [ ] Annual renewal reminder
- [ ] DNS hosting costs (if applicable)

## 🎯 Success Criteria

### Technical Requirements
- [ ] All domains resolve correctly
- [ ] SSL certificates valid
- [ ] HTTPS redirects working
- [ ] No mixed content errors
- [ ] API calls successful

### User Experience
- [ ] Admin portal accessible
- [ ] Marketing site loads
- [ ] Mobile app connects
- [ ] Login/logout works
- [ ] All features functional

## 📞 Support Contacts

### Domain Provider
- **Provider**: [Your registrar]
- **Support**: [Support contact]
- **DNS Management**: [DNS panel URL]

### AWS Support
- **Console**: https://console.aws.amazon.com
- **Documentation**: https://docs.aws.amazon.com
- **Support**: AWS Support Center

### Vercel Support
- **Dashboard**: https://vercel.com/dashboard
- **Documentation**: https://vercel.com/docs
- **Support**: Vercel Support

## ⚠️ Important Notes

1. **DNS Propagation**: Allow 24-48 hours for full propagation
2. **SSL Validation**: Can take up to 30 minutes
3. **Testing**: Test from different networks/locations
4. **Backup**: Keep current configuration as backup
5. **Monitoring**: Set up alerts for downtime

## 🚨 Emergency Rollback

If issues occur:
1. **DNS**: Revert DNS records to original
2. **Vercel**: Use default Vercel domain temporarily
3. **AWS**: Disable Load Balancer, use direct EC2
4. **Contact**: Reach out to support teams

---

**Next Action**: Start with DNS CNAME records (can be done immediately)
**Timeline**: Complete setup within 24-48 hours
**Priority**: High - Required for production deployment
