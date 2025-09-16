# DNS Configuration - Domain Provider Specific Instructions

## 🏢 Namecheap (Most Common)

### Step 1: Access DNS Management
1. Log into Namecheap account
2. Go to **Domain List**
3. Click **Manage** next to `caf-mexico.org`
4. Go to **Advanced DNS** tab

### Step 2: Add CNAME Records
1. Click **Add New Record**
2. Select **CNAME Record**

#### Record 1: Admin Portal
```
Type: CNAME Record
Host: admin
Value: cname.vercel-dns.com
TTL: 5 min
```

#### Record 2: Marketing Site
```
Type: CNAME Record
Host: www
Value: cname.vercel-dns.com
TTL: 5 min
```

3. Click **Save All Changes**

---

## 🌐 GoDaddy

### Step 1: Access DNS Management
1. Log into GoDaddy account
2. Go to **My Products**
3. Find `caf-mexico.org` and click **DNS**

### Step 2: Add CNAME Records
1. Scroll down to **Records** section
2. Click **Add** button

#### Record 1: Admin Portal
```
Type: CNAME
Name: admin
Value: cname.vercel-dns.com
TTL: 1 Hour
```

#### Record 2: Marketing Site
```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
TTL: 1 Hour
```

3. Click **Save**

---

## ☁️ Cloudflare

### Step 1: Add Domain to Cloudflare
1. Log into Cloudflare
2. Click **Add a Site**
3. Enter `caf-mexico.org`
4. Select **Free** plan
5. Update nameservers at your registrar

### Step 2: Add CNAME Records
1. Go to **DNS** tab
2. Click **Add record**

#### Record 1: Admin Portal
```
Type: CNAME
Name: admin
Target: cname.vercel-dns.com
TTL: Auto
```

#### Record 2: Marketing Site
```
Type: CNAME
Name: www
Target: cname.vercel-dns.com
TTL: Auto
```

---

## 🔍 Google Domains

### Step 1: Access DNS Management
1. Log into Google Domains
2. Click on `caf-mexico.org`
3. Go to **DNS** section

### Step 2: Add CNAME Records
1. Scroll to **Custom records**
2. Click **Manage custom records**

#### Record 1: Admin Portal
```
Name: admin
Type: CNAME
Data: cname.vercel-dns.com
TTL: 1h
```

#### Record 2: Marketing Site
```
Name: www
Type: CNAME
Data: cname.vercel-dns.com
TTL: 1h
```

---

## 🏪 Other Providers

### Generic Instructions
Most domain providers follow this pattern:

1. **Find DNS Management** section
2. **Look for "Add Record"** or "Add DNS Record"
3. **Select CNAME** as record type
4. **Enter the values** as shown above
5. **Save changes**

### Common Field Names
- **Name/Host**: `admin` or `www`
- **Type**: `CNAME`
- **Value/Target/Destination**: `cname.vercel-dns.com`
- **TTL**: `300` or `5 minutes`

---

## ⏱️ What Happens Next?

### Immediate (5-15 minutes)
- DNS records are saved
- Changes start propagating

### Short Term (1-2 hours)
- Most users can access the domains
- Vercel will start serving your sites

### Full Propagation (24-48 hours)
- All DNS servers worldwide updated
- Maximum compatibility achieved

---

## 🧪 Testing Your DNS Setup

### Test DNS Resolution
```bash
# Test admin subdomain
nslookup admin.caf-mexico.org

# Test www subdomain  
nslookup www.caf-mexico.org

# Test with different DNS server
nslookup admin.caf-mexico.org 8.8.8.8
```

### Expected Results
```
admin.caf-mexico.org
    canonical name = cname.vercel-dns.com

www.caf-mexico.org
    canonical name = cname.vercel-dns.com
```

---

## ⚠️ Common Issues & Solutions

### Issue: "CNAME record already exists"
**Solution**: Delete the existing record first, then add the new one

### Issue: "Invalid CNAME value"
**Solution**: Make sure you're using `cname.vercel-dns.com` (not `cname.vercel.com`)

### Issue: "Cannot add CNAME for root domain"
**Solution**: Use A record for root domain, CNAME for subdomains only

### Issue: "DNS not propagating"
**Solution**: 
- Wait 24-48 hours
- Clear your browser cache
- Try different DNS servers

---

## 🎯 Success Indicators

### ✅ DNS Setup Complete When:
- [ ] Both CNAME records added successfully
- [ ] No error messages in DNS management
- [ ] Records show correct values
- [ ] TTL is set to reasonable value (300-3600 seconds)

### ✅ Ready for Next Step When:
- [ ] DNS records are saved
- [ ] You can see the records in DNS management
- [ ] No immediate errors

---

## 📞 Need Help?

### If You Can't Find DNS Management:
1. **Check your registrar's help documentation**
2. **Look for "DNS", "Nameservers", or "Zone"**
3. **Contact your domain provider support**

### If Records Won't Save:
1. **Check for typos** in the values
2. **Ensure TTL is numeric** (not text)
3. **Try different browser** or clear cache
4. **Contact support** if issues persist

---

**Next Step**: After DNS is configured, we'll set up Vercel custom domains
