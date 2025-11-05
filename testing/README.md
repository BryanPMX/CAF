# CAF Testing Suite

This comprehensive testing suite provides multiple types of automated testing for the CAF system, including CRUD operations, smoke tests, integration tests, and performance validation.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run smoke tests (recommended for daily checks)
npm run test:smoke

# Run comprehensive CRUD tests
npm run test:crud

# Run quick validation tests
npm run test:quick

# Run performance tests
npm run test:performance

# Run integration tests (creates/modifies data - use carefully)
npm run test:integration

# Run demo tests
npm run test:demo

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

### 1. Smoke Tests (`test:smoke`) - **Recommended for Daily Use**
- Critical user journey validation
- Authentication and profile access
- Dashboard and announcements
- Frontend availability
- **Fast, safe, non-destructive**

### 2. Comprehensive CRUD Tests (`test:crud`)
- Full CRUD cycle for each role and section
- Permission validation across all endpoints
- Error handling and edge cases
- Detailed reporting with role-based testing

### 3. Quick Validation Tests (`test:quick`)
- Fast endpoint validation
- Core functionality check
- Basic permission testing
- Quick feedback for development

### 4. Integration Tests (`test:integration`) - **⚠️ Destructive**
- End-to-end workflows with data creation
- Full user journeys including data modification
- Automatic cleanup of test data
- Use `DRY_RUN=true` for safe testing

### 5. Performance Tests (`test:performance`)
- Response time measurement
- Load testing simulation
- Performance thresholds validation
- Bottleneck identification

### 6. Demo Tests (`test:demo`)
- Interactive demonstration of testing capabilities
- Real-time authentication and API calls
- Educational tool for understanding the system

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

### Centralized Configuration (`config.js`)
All test files now use a centralized configuration system for consistency:

- **Development**: `http://localhost:8080/api/v1` (default)
- **Production**: `https://api.caf-mexico.org/api/v1` (when `NODE_ENV=production`)

### Environment Variables
Override defaults using environment variables:

```bash
# API Configuration
export API_BASE_URL="https://your-api.example.com/api/v1"
export FRONTEND_BASE_URL="https://your-app.example.com"
export WS_BASE_URL="wss://your-api.example.com/ws"

# Test Credentials
export TEST_USER_EMAIL="test@example.com"
export TEST_USER_PASSWORD="securepassword"
export ADMIN_TEST_EMAIL="admin@example.com"
export ADMIN_TEST_PASSWORD="adminpassword"

# Test Settings
export TIMEOUT=15000
export MAX_RETRIES=5
export DRY_RUN=true  # For integration tests
export VERBOSE=true
```

### Test Credentials
The system includes secure test credentials:

- **Admin User**: `admin@caf.org` / `admin123` (development default)
- **Test User**: Configurable via environment variables
- **Production**: Uses environment variables for security

### Configuration Priority
1. Environment variables (highest priority)
2. Production defaults (when `NODE_ENV=production`)
3. Development defaults (fallback)

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

### Specialized Test Files
- **`websocket-tester.js`** - WebSocket connection testing
- **`load-test-processor.js`** - Load testing with configurable scenarios
- **`rbac-validation.js`** - Role-based access control validation
- **`test-user-manager.js`** - Test user account management
- **`validate-implementation.js`** - Implementation validation and compliance
- **`health-monitor.sh`** - System health monitoring script

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

## 🧹 Testing Suite Organization

### Recent Improvements
- **Centralized Configuration**: All tests now use `config.js` for consistent settings
- **Security Hardening**: Removed hardcoded JWT tokens and credentials
- **Environment Flexibility**: Automatic switching between development and production
- **Comprehensive Test Coverage**: Multiple test types for different use cases
- **Clean Dependencies**: Properly managed npm packages with proper versions

### File Organization
```
testing/
├── config.js              # Centralized configuration
├── smoke-tests.js         # Daily health checks (recommended)
├── crud-automation.js     # Comprehensive CRUD testing
├── quick-crud-test.js     # Fast validation tests
├── integration-tests.js   # End-to-end with data creation
├── performance-test.js    # Performance benchmarking
├── demo-test.js          # Interactive demonstrations
├── websocket-tester.js   # WebSocket testing
├── load-test-processor.js # Load testing
├── rbac-validation.js    # Access control validation
├── test-user-manager.js  # User account management
├── validate-implementation.js # Implementation checks
├── health-monitor.sh     # System monitoring script
└── README.md             # This documentation
```

### Test Safety Levels
- 🟢 **Safe**: Smoke, CRUD, Quick, Performance, Demo tests
- 🟡 **Caution**: Integration tests (use `DRY_RUN=true`)
- 🔴 **Danger**: Production integration tests without dry run

## 🤝 Contributing

1. Add new test cases for new features
2. Update existing tests when APIs change
3. Maintain test coverage documentation
4. Follow testing best practices
5. Document any new test requirements