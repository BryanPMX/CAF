# CAF CRUD Testing Automation Suite

This comprehensive testing suite automates CRUD operations across all user roles and sections in the CAF system.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run comprehensive CRUD tests
npm run test:crud

# Run quick validation tests
npm run test:quick

# Run performance tests
npm run test:performance

# Run all tests
npm run test:all
```

## 📋 Test Coverage

### User Roles Tested
- **Admin** (`admin@caf.org`) - Full system access
- **Staff** (`barmen@caf.org`) - Office-scoped access
- **Lawyer** (`jperezsosa@caf.org`) - Legal department access
- **Client** (`bpere151@my.epcc.edu`) - Limited client access

### Sections Tested
- **Cases** - CRUD operations, office scoping, permissions
- **Appointments** - Scheduling, updates, cancellations
- **Tasks** - Assignment, completion, comments
- **Users** - Management (admin only), office scoping
- **Offices** - CRUD operations (admin only)
- **Archive** - Soft delete, restoration, permanent deletion
- **Reports** - Generation, export, filtering

### CRUD Operations
- **CREATE** - New records with validation
- **READ** - List, detail, search, filtering
- **UPDATE** - Field updates, status changes
- **DELETE** - Soft delete, permanent deletion
- **PATCH** - Partial updates

## 🧪 Test Suites

### 1. Comprehensive CRUD Tests (`crud-automation.js`)
- Full CRUD cycle for each role and section
- Permission validation
- Error handling
- Detailed reporting

### 2. Quick Validation Tests (`quick-crud-test.js`)
- Fast endpoint validation
- Core functionality check
- Basic permission testing
- Quick feedback

### 3. Performance Tests (`performance-test.js`)
- Response time measurement
- Load testing
- Performance thresholds
- Bottleneck identification

## 📊 Test Results

### Output Files
- `crud-test-results.json` - Detailed test results
- `performance-results.json` - Performance metrics
- Console output with real-time status

### Success Criteria
- **Green (✅)** - Test passed
- **Red (❌)** - Test failed
- **Yellow (⏭️)** - Test skipped (expected)

### Performance Thresholds
- **Fast** - < 2 seconds
- **Moderate** - 2-5 seconds
- **Slow** - > 5 seconds

## 🔧 Configuration

### Test Credentials
Update `TEST_USERS` in each test file with valid credentials:

```javascript
const TEST_USERS = {
  admin: {
    email: 'admin@caf.org',
    password: 'admin123',
    role: 'admin'
  },
  // ... other roles
};
```

### API Endpoints
Modify `API_BASE_URL` for different environments:

```javascript
const API_BASE_URL = 'https://api.caf-mexico.org/api/v1';
```

## 🚨 Troubleshooting

### Common Issues
1. **Authentication Failures** - Check credentials and user status
2. **Permission Errors** - Verify role assignments and office scoping
3. **Timeout Errors** - Increase timeout values for slow endpoints
4. **Validation Errors** - Check required fields and data formats

### Debug Mode
Add verbose logging to any test:

```javascript
console.log('Response:', JSON.stringify(response.data, null, 2));
```

## 📈 Continuous Integration

### GitHub Actions Integration
```yaml
- name: Run CRUD Tests
  run: |
    cd testing
    npm install
    npm run test:crud
```

### Scheduled Testing
Set up cron jobs for regular testing:

```bash
# Daily comprehensive tests
0 2 * * * cd /path/to/testing && npm run test:crud

# Hourly quick tests
0 * * * * cd /path/to/testing && npm run test:quick
```

## 🎯 Best Practices

1. **Run tests before deployments** - Ensure all CRUD operations work
2. **Monitor performance** - Track response times over time
3. **Test with real data** - Use production-like test data
4. **Validate permissions** - Ensure role-based access works correctly
5. **Check error handling** - Verify graceful failure modes

## 📝 Adding New Tests

### New Role Testing
1. Add credentials to `TEST_USERS`
2. Create role-specific test function
3. Add to main test execution

### New Section Testing
1. Create CRUD test function
2. Add to all relevant roles
3. Update test coverage documentation

### New Operation Testing
1. Add operation to `testCRUDOperation`
2. Update existing test functions
3. Add validation and error cases

## 🔍 Monitoring

### Key Metrics
- **Test Pass Rate** - Percentage of successful tests
- **Response Times** - API performance metrics
- **Error Rates** - Failed operations by type
- **Coverage** - Percentage of endpoints tested

### Alerts
Set up alerts for:
- Test failure rates > 10%
- Response times > 5 seconds
- Authentication failures
- Permission errors

## 📚 Documentation

- [API Documentation](../docs/API.md)
- [Role Permissions](../docs/RolePermissions.md)
- [Testing Strategy](../PRODUCTION_TESTING_STRATEGY.md)

## 🤝 Contributing

1. Add new test cases for new features
2. Update existing tests when APIs change
3. Maintain test coverage documentation
4. Follow testing best practices
5. Document any new test requirements