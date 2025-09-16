# DNS Configuration for caf-mexico.org

## 🌐 DNS Records Setup

### Step 1: Access Your Domain Provider's DNS Management
1. Log into your domain registrar account
2. Navigate to DNS Management or DNS Settings
3. Look for "DNS Records", "DNS Zone", or "Name Servers"

### Step 2: Add DNS Records

#### A Records (Point to AWS Load Balancer)
```
Type: A
Name: api
Value: [ALB-IP-ADDRESS] (will be provided after AWS setup)
TTL: 300 (5 minutes)

Type: A  
Name: mobile
Value: [ALB-IP-ADDRESS] (same as above)
TTL: 300
```

#### CNAME Records (Point to Vercel)
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

#### Root Domain Redirect (Optional)
```
Type: A
Name: @ (or leave blank)
Value: [ALB-IP-ADDRESS] (same as api)
TTL: 300
```

### Step 3: Verify DNS Propagation
After adding records, verify they're working:

```bash
# Check DNS resolution
nslookup api.caf-mexico.org
nslookup admin.caf-mexico.org
nslookup www.caf-mexico.org

# Test with dig (if available)
dig api.caf-mexico.org
dig admin.caf-mexico.org
```

## ⏱️ DNS Propagation Timeline
- **Initial**: 5-15 minutes
- **Full propagation**: 24-48 hours
- **Global**: Up to 72 hours

## 🔍 Testing Your DNS Setup

### Before AWS Setup
```bash
# These should fail initially (expected)
curl -I http://api.caf-mexico.org
curl -I https://api.caf-mexico.org
```

### After AWS Setup
```bash
# These should work
curl -I https://api.caf-mexico.org/api/v1/health
curl -I https://admin.caf-mexico.org
```

## 📋 DNS Provider Specific Instructions

### Namecheap
1. Go to Domain List → Manage → Advanced DNS
2. Add records in "Host Records" section
3. Use "@" for root domain, subdomain name for others

### GoDaddy
1. Go to My Products → DNS
2. Add records in "DNS Management" section
3. Use "@" for root domain

### Cloudflare
1. Add domain to Cloudflare
2. Update nameservers at registrar
3. Add DNS records in Cloudflare dashboard

### Google Domains
1. Go to DNS → Custom Records
2. Add records with appropriate types
3. Use "@" for root domain

## ⚠️ Important Notes

1. **Don't add A records yet** - Wait for AWS Load Balancer IP
2. **CNAME records can be added now** - They point to Vercel
3. **TTL should be low initially** - For faster updates during setup
4. **Keep backup of current DNS** - In case you need to revert

## 🚨 Common Issues

### DNS Not Propagating
- Wait 24-48 hours for full propagation
- Check with different DNS servers: `nslookup domain.com 8.8.8.8`
- Clear your local DNS cache

### CNAME Conflicts
- Don't use CNAME for root domain (@)
- Use A record for root domain instead

### Wrong IP Address
- Double-check AWS Load Balancer IP
- Verify security groups allow traffic

## 📞 Next Steps After DNS Setup

1. **Run AWS Setup Script**: `./aws-https-setup.sh`
2. **Get Load Balancer IP**: From AWS console
3. **Update A Records**: With actual IP address
4. **Configure Vercel**: Add custom domains
5. **Test Everything**: Verify all endpoints work
