# 🧪 CAF System - Production Testing Suite

A comprehensive testing framework for the CAF (Centro de Apoyo Familiar) system designed for safe production testing, monitoring, and validation.

## 📋 Overview

This testing suite provides multiple layers of testing to ensure system reliability and performance in production environments:

- **Health Monitoring**: Continuous system health checks
- **Smoke Tests**: Daily critical path validation
- **Load Testing**: Performance validation under stress
- **Integration Tests**: End-to-end workflow verification
- **Monitoring Dashboard**: Real-time system metrics

## 🎯 Testing Philosophy

### Safe Production Testing
- **Non-destructive by default**: Most tests are read-only
- **Test data isolation**: All test data is clearly marked and automatically cleaned up
- **Gradual impact**: Tests start with low impact and scale up
- **Immediate rollback**: Ability to stop tests instantly if issues arise

### Comprehensive Coverage
- **Health checks**: System component status
- **User journeys**: Critical workflows from end-user perspective  
- **Performance**: Response times and throughput under load
- **Data integrity**: Complete CRUD operations with cleanup

## 🚀 Quick Start

### Prerequisites

```bash
# Install Node.js dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Edit .env with your production URLs and credentials
nano .env
```

### Essential Setup

1. **Create Test Users**: Set up dedicated test accounts in your production system
   - Regular user: `test@caf-mexico.org`
   - Admin user: `admin@caf-mexico.org`
   - Use strong passwords and limit permissions to test data only

2. **Configure Alerts**: Set up Slack/email notifications for test failures
   ```bash
   export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"
   export EMAIL_ALERT="alerts@caf-mexico.org"
   ```

3. **Verify Health Endpoints**: Ensure all health endpoints are accessible
   ```bash
   ./health-monitor.sh quick
   ```

## 🏥 Health Monitoring

### Continuous Health Checks

Monitor all system components every 30 seconds:

```bash
# Single health check
./health-monitor.sh

# Continuous monitoring
./health-monitor.sh monitor

# Quick check (basic endpoints only)
./health-monitor.sh quick

# Test specific endpoint
./health-monitor.sh test /health/ready
```

### Health Endpoints Monitored

| Endpoint | Purpose | Expected Response Time |
|----------|---------|----------------------|
| `/health` | Basic service health | < 100ms |
| `/health/ready` | Database connectivity | < 200ms |
| `/health/live` | AWS ALB health check | < 100ms |
| `/health/migrations` | Database migrations | < 300ms |
| `/health/s3` | S3 storage connectivity | < 500ms |
| `/health/cache` | Cache system status | < 100ms |

### Alert Configuration

Health monitoring automatically sends alerts when:
- Any health endpoint fails
- Response times exceed thresholds
- Error rates spike above 1%

## 🔥 Smoke Tests

### Daily Smoke Testing

Run comprehensive smoke tests to verify critical user journeys:

```bash
# Run all smoke tests
npm run smoke-tests

# Run with custom configuration
API_BASE_URL=https://api.caf-mexico.org/api/v1 npm run smoke-tests
```

### Test Coverage

- ✅ **Authentication Flow**: Login, profile access, token validation
- ✅ **Dashboard Access**: Summary data, announcements, navigation
- ✅ **Cases Management**: List, search, detail views (read-only)
- ✅ **Appointments**: Calendar access, list views (read-only)
- ✅ **Notifications**: Message retrieval and marking as read
- ✅ **Frontend Availability**: Admin portal accessibility

### Sample Output

```
🧪 Running: User Login
✅ User Login - PASSED (245ms)

🧪 Running: Dashboard Summary  
✅ Dashboard Summary - PASSED (156ms)

🧪 Running: Cases List
✅ Cases List - PASSED (423ms)

📊 Test Results
================
Total Duration: 2847ms
Tests Run: 12
Passed: 12
Failed: 0
Skipped: 0

🎉 All smoke tests passed!
```

## ⚡ Load Testing

### Performance Validation

Test system performance under realistic load conditions:

```bash
# Run load test
npm run load-test

# Custom load test with Artillery
artillery run load-test.yml --output report.json
artillery report report.json
```

### Load Test Scenarios

| Scenario | Weight | Description |
|----------|--------|-------------|
| Health Checks | 30% | Basic system health verification |
| Authentication | 25% | User login and profile access |
| Dashboard Access | 20% | Dashboard data retrieval |
| Cases Browsing | 15% | Case list and search operations |
| Appointments | 10% | Appointment calendar access |

### Performance Thresholds

- **Response Time**: 95th percentile < 1000ms
- **Error Rate**: < 1%
- **Throughput**: Handle 15 concurrent users
- **Success Rate**: > 99%

### Load Test Phases

1. **Warm-up** (30s): 2 users/second
2. **Ramp-up** (60s): 5-10 users/second
3. **Sustained** (120s): 10 users/second
4. **Peak** (60s): 15 users/second
5. **Cool-down** (30s): 5 users/second

## 🔧 Integration Tests

### End-to-End Workflow Testing

⚠️ **Warning**: Integration tests create and modify production data. Only run during maintenance windows with proper backups.

```bash
# Dry run (safe - no data changes)
DRY_RUN=true npm run integration-tests

# Live run (creates test data)
npm run integration-tests

# With custom admin credentials
ADMIN_TEST_EMAIL=admin@caf-mexico.org npm run integration-tests
```

### Test Workflows

1. **Complete Case Lifecycle**
   - Create case with client information
   - Add comments and documents
   - Update case status and priority
   - Verify data integrity
   - Clean up test data

2. **Appointment Booking Flow**
   - Create appointment with case linkage
   - Modify appointment details
   - Verify calendar integration
   - Clean up test data

3. **Task Management**
   - Create tasks linked to cases
   - Update task status and assignments
   - Add task comments
   - Clean up test data

4. **Search and Filtering**
   - Test case search functionality
   - Verify filter operations
   - Validate result accuracy

### Data Safety

- All test data uses `INTEGRATION_TEST_` prefix
- Automatic cleanup after test completion
- Dry-run mode for safe testing
- Failed test recovery with cleanup

## 📊 Monitoring & Alerting

### Real-Time Monitoring

```bash
# Start continuous monitoring
npm run monitor

# Monitor with custom interval (seconds)
./health-monitor.sh monitor 60
```

### Key Metrics

| Metric | Threshold | Alert Level |
|--------|-----------|-------------|
| Response Time | > 1000ms | Warning |
| Error Rate | > 1% | Warning |
| Health Check Failure | Any failure | Critical |
| Database Connection | Failure | Critical |
| S3 Storage | Failure | Warning |

### Alert Channels

- **Slack**: Real-time notifications to team channel
- **Email**: Critical alerts to operations team
- **Console**: Immediate feedback during testing

## 📈 Automated Scheduling

### Cron Job Setup

Add to your crontab for automated testing:

```bash
# Health checks every 5 minutes
*/5 * * * * /path/to/testing/health-monitor.sh quick >> /var/log/caf-health.log 2>&1

# Smoke tests daily at 3 AM
0 3 * * * cd /path/to/testing && npm run smoke-tests >> /var/log/caf-smoke.log 2>&1

# Load tests weekly on Sundays at 2 AM
0 2 * * 0 cd /path/to/testing && npm run load-test >> /var/log/caf-load.log 2>&1
```

### GitHub Actions Integration

```yaml
name: Production Health Check
on:
  schedule:
    - cron: '*/30 * * * *'  # Every 30 minutes
  
jobs:
  health-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Health Check
        run: |
          cd testing
          ./health-monitor.sh
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

## 🔍 Troubleshooting

### Common Issues

#### Health Check Failures
```bash
# Check specific endpoint
curl -v https://api.caf-mexico.org/health

# Verify DNS resolution
nslookup api.caf-mexico.org

# Test connectivity
ping api.caf-mexico.org
```

#### Authentication Failures
```bash
# Verify test user credentials
curl -X POST https://api.caf-mexico.org/api/v1/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@caf-mexico.org","password":"TestPassword123"}'

# Check user account status in admin panel
```

#### Load Test Issues
```bash
# Check system resources during load test
top -p $(pgrep node)

# Monitor database connections
# (Connect to your database and check active connections)

# Verify rate limiting isn't blocking tests
curl -I https://api.caf-mexico.org/health
```

### Debug Mode

Enable verbose logging:

```bash
# Debug smoke tests
DEBUG=true npm run smoke-tests

# Verbose health monitoring
VERBOSE=true ./health-monitor.sh

# Artillery debug mode
DEBUG=* npm run load-test
```

## 🔐 Security Considerations

### Test User Security

- Use dedicated test accounts with minimal permissions
- Rotate test passwords regularly
- Limit test user access to test data only
- Monitor test user activity logs

### Data Protection

- All test data is clearly marked and isolated
- Automatic cleanup prevents data accumulation
- No production user data is modified
- Test operations are logged and auditable

### Network Security

- Tests run over HTTPS only
- API keys and tokens are properly secured
- Rate limiting protects against runaway tests
- Monitoring alerts detect unusual patterns

## 📞 Emergency Procedures

### Stop All Tests Immediately

```bash
# Kill all running tests
pkill -f "smoke-tests\|load-test\|integration-tests"

# Stop health monitoring
pkill -f "health-monitor"

# Check for any remaining test processes
ps aux | grep -E "(smoke|load|integration|health)"
```

### Test-Induced System Issues

1. **Immediate Response**
   - Stop all active tests
   - Check system health endpoints
   - Verify user impact scope

2. **Assessment**
   - Review test logs for errors
   - Check system metrics and alerts
   - Identify root cause

3. **Recovery**
   - Clean up any remaining test data
   - Restart affected services if needed
   - Verify system restoration

4. **Communication**
   - Notify stakeholders of issue and resolution
   - Document incident for future prevention

### Escalation Contacts

- **Technical Issues**: Development Team
- **Infrastructure**: DevOps/AWS Support  
- **Business Impact**: Management Team
- **Security Concerns**: Security Team

## 📚 Best Practices

### Before Running Tests

- [ ] Verify system is healthy
- [ ] Check current system load
- [ ] Ensure maintenance window if running destructive tests
- [ ] Have rollback plan ready
- [ ] Notify team of testing activity

### During Tests

- [ ] Monitor test progress and system metrics
- [ ] Watch for error rates or performance degradation
- [ ] Be ready to stop tests if issues arise
- [ ] Document any anomalies observed

### After Tests

- [ ] Verify all test data was cleaned up
- [ ] Check system returned to normal operation
- [ ] Review test results and metrics
- [ ] Update test procedures based on learnings
- [ ] Archive test logs for future reference

## 🔄 Continuous Improvement

### Weekly Reviews
- Analyze test results and performance trends
- Update test scenarios based on user feedback
- Review and optimize slow-running tests
- Adjust monitoring thresholds as needed

### Monthly Assessments
- Comprehensive load testing results analysis
- Security vulnerability assessment
- Infrastructure cost optimization
- Test coverage gap analysis

### Quarterly Updates
- Update test credentials and rotate keys
- Review and update emergency procedures
- Assess new testing tools and techniques
- Training updates for team members

---

## 🎯 Quick Reference Commands

```bash
# Daily Operations
./health-monitor.sh quick              # Quick health check
npm run smoke-tests                    # Run smoke tests
./health-monitor.sh monitor           # Start monitoring

# Weekly Operations  
npm run load-test                     # Performance testing
DRY_RUN=true npm run integration-tests # Safe integration test

# Emergency
pkill -f "health-monitor"             # Stop monitoring
pkill -f "smoke-tests"                # Stop smoke tests
./health-monitor.sh test /health      # Test specific endpoint

# Monitoring
tail -f /var/log/caf-health.log       # Watch health logs
artillery report report.json          # View load test report
DEBUG=true npm run smoke-tests        # Debug mode
```

This comprehensive testing suite ensures your CAF system remains reliable, performant, and secure in production while providing the confidence to deploy and maintain the system effectively.
