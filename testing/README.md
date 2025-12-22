# CAF Testing Suite

This directory contains the comprehensive automated testing suite for the Centro de Apoyo para la Familia (CAF) system, providing multiple types of testing to ensure system reliability and functionality.

## Testing Architecture

The testing suite implements a layered testing approach:

- **Unit Tests**: Individual component and function testing
- **Integration Tests**: API and service interaction testing
- **End-to-End Tests**: Complete user journey validation
- **Performance Tests**: Load and response time validation
- **Health Monitoring**: System availability and metrics

## Directory Structure

```
testing/
├── config.js              # Centralized test configuration
├── smoke-tests.js         # Quick health checks (recommended)
├── crud-automation.js     # Full CRUD operation testing
├── quick-crud-test.js     # Fast validation tests
├── integration-tests.js   # End-to-end workflow testing
├── performance-test.js    # Load and performance testing
├── demo-test.js          # Interactive testing demonstrations
├── websocket-tester.js   # Real-time communication testing
├── load-test-processor.js # Advanced load testing
├── rbac-validation.js    # Access control validation
├── test-user-manager.js  # Test account management
├── validate-implementation.js # System validation checks
├── health-monitor.sh     # System health monitoring script
└── README.md             # This documentation
```

## Test Categories

### 1. Smoke Tests (`smoke-tests.js`)
**Purpose**: Daily health checks and critical functionality validation

**Coverage**:
- Authentication system health
- Dashboard accessibility
- Core API endpoints response
- Database connectivity
- Basic CRUD operations

**Usage**:
```bash
npm run test:smoke
# Expected: All core systems operational
```

### 2. CRUD Automation Tests (`crud-automation.js`)
**Purpose**: Comprehensive data operations testing across all system entities

**Coverage**:
- **Create**: New records with full validation
- **Read**: Single and bulk data retrieval
- **Update**: Field modifications and state changes
- **Delete**: Soft deletion and cleanup
- **Relationships**: Foreign key and association validation

**Tested Entities**:
- Users (admin, staff, clients)
- Cases (legal matters, assignments)
- Appointments (scheduling, conflicts)
- Tasks (case-related work items)
- Offices (location management)

### 3. Integration Tests (`integration-tests.js`)
**Purpose**: End-to-end workflow validation with realistic data scenarios

**Coverage**:
- Complete user journeys from creation to completion
- Cross-entity relationships and dependencies
- Business rule validation
- Error handling and edge cases
- Data consistency across operations

### 4. Performance Tests (`performance-test.js`)
**Purpose**: System performance and load testing

**Metrics**:
- Response times (<500ms target)
- Concurrent user handling (50+ users)
- Database query optimization
- Memory usage patterns
- API throughput rates

### 5. WebSocket Tests (`websocket-tester.js`)
**Purpose**: Real-time communication system validation

**Coverage**:
- Connection establishment
- Message sending/receiving
- Authentication over WebSocket
- Connection recovery
- Performance under load

## Configuration System

### Centralized Configuration (`config.js`)

All tests use a unified configuration system for consistency:

```javascript
// Test environment configuration
const CONFIG = {
  // API endpoints
  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:8080/api/v1',

  // Test credentials
  ADMIN_USER: {
    email: process.env.ADMIN_EMAIL || 'admin@caf.org',
    password: process.env.ADMIN_PASSWORD || 'admin123'
  },

  // Test settings
  TIMEOUT: parseInt(process.env.TIMEOUT) || 15000,
  MAX_RETRIES: parseInt(process.env.MAX_RETRIES) || 5,
  VERBOSE: process.env.VERBOSE === 'true',

  // Safety settings
  DRY_RUN: process.env.DRY_RUN === 'true', // For destructive tests
  CLEANUP: process.env.CLEANUP !== 'false'  // Auto-cleanup test data
};
```

### Environment Variables

Override defaults using environment variables:

```bash
# API Configuration
export API_BASE_URL="https://api.caf-mexico.org/api/v1"
export FRONTEND_URL="https://admin.caf-mexico.org"

# Test Credentials
export ADMIN_EMAIL="admin@production.com"
export ADMIN_PASSWORD="secure_password"
export TEST_USER_EMAIL="test@caf.org"

# Test Behavior
export TIMEOUT=30000          # Extended timeout for slow networks
export MAX_RETRIES=3          # Retry failed operations
export VERBOSE=true           # Detailed logging
export DRY_RUN=true          # Safe mode for integration tests
```

## Test Execution

### Quick Start Commands

```bash
# Install dependencies (if not already done)
npm install

# Run smoke tests (fast, recommended for daily checks)
npm run test:smoke

# Run comprehensive CRUD tests
npm run test:crud

# Run integration tests (use DRY_RUN=true first)
npm run test:integration

# Run performance benchmarks
npm run test:performance

# Run all tests
npm run test:all
```

### Test Results Interpretation

**Status Indicators**:
- [PASS] **PASS**: Test completed successfully
- [FAIL] **FAIL**: Test failed with errors
- [SKIP] **SKIP**: Test skipped (expected behavior)
- [WARN] **WARN**: Test passed but with warnings

**Performance Targets**:
- **Fast**: < 2 seconds response time
- **Moderate**: 2-5 seconds response time
- **Slow**: > 5 seconds (requires optimization)

## Advanced Testing Features

### Role-Based Testing

Tests automatically run with different user roles:

```javascript
const testUsers = {
  admin: { email: 'admin@caf.org', role: 'admin' },
  lawyer: { email: 'jperezsosa@caf.org', role: 'lawyer' },
  receptionist: { email: 'reception@caf.org', role: 'receptionist' },
  client: { email: 'client@caf.org', role: 'client' }
};
```

### Data Isolation

Each test creates isolated data contexts:
- Unique identifiers for test records
- Automatic cleanup of test data
- No interference between test runs

### Error Recovery

Comprehensive error handling:
- Automatic retry for transient failures
- Detailed error logging and reporting
- Graceful degradation for non-critical failures

## Continuous Integration

### GitHub Actions Integration

```yaml
# .github/workflows/test.yml
name: Test Suite
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: cd testing && npm install

      - name: Run smoke tests
        run: npm run test:smoke

      - name: Run CRUD tests
        run: npm run test:crud
```

### Scheduled Testing

```bash
# Daily comprehensive testing
0 2 * * * cd /path/to/caf/testing && npm run test:crud

# Hourly health checks
0 * * * * cd /path/to/caf/testing && npm run test:smoke
```

## Monitoring and Reporting

### Test Metrics Collection

```javascript
const metrics = {
  testCount: tests.length,
  passCount: passedTests.length,
  failCount: failedTests.length,
  averageResponseTime: calculateAverage(responseTimes),
  peakMemoryUsage: Math.max(...memoryUsage),
  errorRate: (failedTests.length / tests.length) * 100
};
```

### Automated Reporting

- **JSON Reports**: Structured test results for CI/CD integration
- **Console Output**: Real-time test progress and results
- **Performance Charts**: Response time and throughput graphs
- **Error Summaries**: Categorized failure analysis

## Troubleshooting

### Common Issues

1. **Authentication Failures**
   ```bash
   # Check API connectivity
   curl http://localhost:8080/health

   # Verify test credentials
   npm run test:smoke
   ```

2. **Timeout Errors**
   ```bash
   # Increase timeout
   export TIMEOUT=30000
   npm run test:crud
   ```

3. **Database Connection Issues**
   ```bash
   # Check database status
   docker-compose logs db
   ```

4. **Permission Errors**
   ```bash
   # Run with admin credentials
   export ADMIN_EMAIL="admin@caf.org"
   npm run test:rbac
   ```

### Debug Mode

Enable verbose logging for detailed troubleshooting:

```bash
export VERBOSE=true
export DEBUG=true
npm run test:crud
```

## Best Practices

### Test Organization
1. **One Test Per File**: Clear separation of concerns
2. **Descriptive Names**: Self-documenting test functions
3. **Independent Tests**: No test dependencies
4. **Fast Execution**: Optimized for quick feedback

### Data Management
1. **Test Data Isolation**: Unique identifiers for each test run
2. **Automatic Cleanup**: Remove test data after completion
3. **Realistic Data**: Use production-like test scenarios
4. **Edge Cases**: Include boundary conditions and error scenarios

### Maintenance
1. **Regular Updates**: Keep tests current with API changes
2. **Performance Monitoring**: Track test execution times
3. **Coverage Analysis**: Identify untested code paths
4. **Documentation**: Update test docs with new features

This comprehensive testing suite ensures the CAF system maintains high quality and reliability across all components and user scenarios.