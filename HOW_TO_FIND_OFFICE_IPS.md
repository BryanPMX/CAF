# How to Find Office IP Addresses for Admin Portal Whitelist

## 🌐 Methods to Find Office IP Addresses

### Method 1: Check Current IP Address
**Easiest method - Check what IP you're currently using**

#### From Any Computer in Your Office
1. **Open a web browser**
2. **Go to**: https://whatismyipaddress.com/
3. **Note the IP address** displayed
4. **Repeat from different computers** in your office

#### From Command Line (Windows)
```cmd
# Check your current IP
ipconfig

# Or check external IP
curl ifconfig.me
```

#### From Command Line (Mac/Linux)
```bash
# Check your current IP
ifconfig

# Or check external IP
curl ifconfig.me
```

### Method 2: Contact Your Internet Service Provider (ISP)
**Most accurate method - Get official IP range**

1. **Call your ISP** (Internet Service Provider)
2. **Ask for**: "What is our office's public IP address or IP range?"
3. **Request**: "Do we have a static IP or dynamic IP?"
4. **Get**: The complete IP range assigned to your office

### Method 3: Check Router/Network Equipment
**Technical method - Check your network setup**

#### Check Router Admin Panel
1. **Access router**: Usually `192.168.1.1` or `192.168.0.1`
2. **Login** with admin credentials
3. **Look for**: "WAN IP" or "External IP"
4. **Note**: The public IP address

#### Check Network Documentation
- **Look for network diagrams**
- **Check IT documentation**
- **Review ISP contracts**
- **Find network configuration files**

### Method 4: Use Network Tools
**Advanced method - Network discovery tools**

#### Online IP Checkers
- **https://whatismyipaddress.com/**
- **https://ipinfo.io/**
- **https://www.whatismyip.com/**
- **https://ifconfig.me/**

#### Network Scanning Tools
```bash
# Check external IP
curl ifconfig.me
curl ipinfo.io/ip
curl icanhazip.com
```

## 📋 Information You Need

### Essential Information
1. **Public IP Address** - Your office's external IP
2. **IP Range** - If you have multiple IPs
3. **Static vs Dynamic** - Does your IP change?
4. **ISP Information** - Who provides your internet?

### Additional Information
1. **Office Locations** - Multiple offices?
2. **VPN Setup** - Do you use VPN?
3. **Remote Workers** - Staff working from home?
4. **Network Equipment** - Router/firewall models

## 🔧 Common IP Address Types

### Static IP Address
- **Same IP always** - Never changes
- **Easier to whitelist** - One IP to add
- **More expensive** - Usually costs extra
- **Example**: `203.0.113.45`

### Dynamic IP Address
- **Changes periodically** - IP can change
- **Harder to whitelist** - Need IP range
- **Less expensive** - Standard service
- **Example**: `203.0.113.0/24` (range)

### IP Range (CIDR)
- **Multiple IPs** - Block of addresses
- **Most flexible** - Covers all office IPs
- **Best for whitelist** - Future-proof
- **Example**: `203.0.113.0/24`

## 📞 Who to Contact

### Internet Service Provider (ISP)
- **AT&T**: 1-800-288-2020
- **Verizon**: 1-800-922-0204
- **Comcast**: 1-800-934-6489
- **Spectrum**: 1-855-707-7328

### IT Support
- **Internal IT team** (if you have one)
- **Managed IT service provider**
- **Network administrator**
- **Office manager** (may have network info)

### Office Management
- **Office manager**
- **Building management**
- **Facilities coordinator**
- **Administrative staff**

## 🚀 Quick Steps to Get Started

### Step 1: Check Current IP (5 minutes)
1. **Go to**: https://whatismyipaddress.com/
2. **Note the IP** displayed
3. **Test from different computers** in office
4. **Check if IP is the same** on all computers

### Step 2: Contact ISP (15 minutes)
1. **Call your ISP**
2. **Ask**: "What is our office's public IP address?"
3. **Ask**: "Is it static or dynamic?"
4. **Get**: Complete IP information

### Step 3: Update Whitelist (5 minutes)
1. **Add IP to middleware**
2. **Test admin portal access**
3. **Verify security works**
4. **Document IP information**

## 📝 Example IP Whitelist Configuration

### Single Static IP
```javascript
const ALLOWED_IPS = [
  '203.0.113.45',        // Your office IP
  '127.0.0.1',           // Localhost (development)
  '::1'                  // IPv6 localhost
];
```

### IP Range (CIDR)
```javascript
const ALLOWED_IPS = [
  '203.0.113.0/24',      // Your office IP range
  '198.51.100.0/24',    // Additional office location
  '127.0.0.1',           // Localhost (development)
  '::1'                  // IPv6 localhost
];
```

### Multiple Locations
```javascript
const ALLOWED_IPS = [
  '203.0.113.0/24',      // Main office
  '198.51.100.0/24',     // Branch office
  '192.0.2.0/24',        // Remote office
  '127.0.0.1',           // Localhost (development)
  '::1'                  // IPv6 localhost
];
```

## ⚠️ Important Considerations

### Security
- **Don't share IP addresses** publicly
- **Keep IP information** confidential
- **Monitor access logs** regularly
- **Update whitelist** when IPs change

### Network Changes
- **IP addresses can change** (dynamic IPs)
- **ISP may change** your IP range
- **Office moves** require new IPs
- **Network upgrades** may affect IPs

### Remote Workers
- **Home IPs change** frequently
- **Consider VPN** for remote access
- **Alternative access methods** needed
- **Mobile hotspots** have different IPs

## 🎯 Next Steps

### Immediate Action
1. **Check current IP** using online tools
2. **Contact ISP** for official IP information
3. **Document IP details** for future reference
4. **Test IP whitelist** implementation

### Long-term Planning
1. **Consider static IP** if you have dynamic
2. **Set up VPN** for remote workers
3. **Monitor IP changes** regularly
4. **Update documentation** when IPs change

---

**Quick Start**: Go to https://whatismyipaddress.com/ right now to see your current IP!
**Next Step**: Contact your ISP to get official IP information
**Timeline**: 30 minutes to get all IP information needed
