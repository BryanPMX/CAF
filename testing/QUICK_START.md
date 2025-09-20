# 🚀 CAF Testing Suite - Quick Start Guide

## 30-Second Setup

```bash
cd /path/to/CAF/testing
./setup.sh
```

## Essential Commands

### Daily Operations
```bash
# Health check
./health-monitor.sh

# Run smoke tests  
npm run smoke-tests

# Start monitoring
./health-monitor.sh monitor
```

### Weekly Operations
```bash
# Load testing
npm run load-test

# Integration tests (dry run)
DRY_RUN=true npm run integration-tests
```

### Emergency
```bash
# Stop all tests
pkill -f "health-monitor\|smoke-tests\|load-test"

# Quick health check
./health-monitor.sh quick
```

## First Time Setup Checklist

- [ ] Run `./setup.sh`
- [ ] Edit `.env` with your production URLs
- [ ] Create test users in production system
- [ ] Test basic connectivity: `./health-monitor.sh quick`
- [ ] Run first smoke test: `npm run smoke-tests`

## Test User Requirements

Create these accounts in your production system:

1. **Regular Test User**
   - Email: `test@caf-mexico.org`
   - Role: `staff` or `client`
   - Permissions: Read access to test data only

2. **Admin Test User** (for integration tests)
   - Email: `admin@caf-mexico.org` 
   - Role: `admin`
   - Permissions: Full access (for data cleanup)

## Safety Features

✅ **Read-only by default** - Most tests don't modify data
✅ **Test data isolation** - All test data clearly marked
✅ **Automatic cleanup** - Integration tests clean up after themselves
✅ **Dry run mode** - Test workflows without making changes
✅ **Immediate stop** - Kill switch for all running tests

## Monitoring Dashboard

Open `monitoring-dashboard.html` in your browser for real-time system monitoring.

## Need Help?

- 📖 **Full Documentation**: See `README.md`
- 🏥 **Health Issues**: Check `./health-monitor.sh test /health`
- 🔧 **Test Failures**: Run with `DEBUG=true`
- 📞 **Emergency**: Use kill commands above

## Production Safety

⚠️ **Before running tests:**
- Verify system is healthy
- Check current load
- Have rollback plan ready
- Notify team of testing

⚠️ **Integration tests only:**
- Run during maintenance windows
- Always backup database first
- Use dry run mode initially

---

**Remember**: These tests run against your live production system. Start with health checks and smoke tests before moving to load or integration testing.
