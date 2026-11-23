# CAF Testing Suite

This directory contains the comprehensive automated testing suite for the Centro de Apoyo para la Familia (CAF) system, providing multiple types of testing to ensure system reliability and functionality.

## Mobile validation

Flutter unit/widget tests live in `client-app/test`, and native integration tests
in `client-app/integration_test`. Run `flutter analyze` and `flutter test` from
`client-app`. Native tests require the isolated loopback fixture; see the
[mobile testing instructions](../docs/FLUTTER_MOBILE_APP_DESIGN.md#validation-and-local-native-tests).

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
	password: process.env.ADMIN_PASSWORD
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
export API_BASE_URL="https://api.caf-mexico.com/api/v1"
export FRONTEND_URL="https://admin.caf-mexico.com"

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


## Role isolation regression checks

The current permission matrix and deployment steps are documented in
[ACCESS_CONTROL.md](../docs/ACCESS_CONTROL.md). Older credential-driven scripts
are separate from the isolated role regression suite.

```bash
cd api
go test ./...
go test -race ./...
cd ../testing
npm ci
npm run test:roles
```

For the live E2E checks, start the **synthetic in-memory API** in one terminal:

```bash
cd api
CAF_RBAC_PREVIEW=1 go test ./handlers -run '^TestOfficeAuthorizationPreview$' -count=1 -timeout=0 -v
```

Start the portal in another terminal, using the dedicated loopback port:

```bash
cd admin-portal
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1 npm exec next dev -- --hostname 127.0.0.1 --port 3100
```

Then run:

```bash
cd testing
npx playwright install chromium
npm run test:e2e:roles
```

The preview binds only `127.0.0.1:8080`. It uses generated in-memory records and
synthetic test credentials; it never reads production environment files or data.
Keep these tests on loopback. The browser checks sign-in, role labels, dashboard
office filters, sidebar entries, direct CMS denial, API case scope, and user-role
choices for Soporte Tecnico, Director Ejecutivo and Administrador. It also checks protected
CEO rows with legacy office assignments, blank executive office cells, hidden
executive office fields, denied direct edit links, and stale rows after promotion.
It also verifies the protected support row and role, support-only password fields,
saving user details/passwords, rejection of old credentials and invalidation of old JWTs.
Screenshots are written
to `/tmp/caf-rbac-e2e` (override with `CAF_E2E_ARTIFACT_DIR`). Stop both preview
processes with Ctrl-C when finished.

SQLite tests require CGO and a C compiler (for example, Xcode command-line tools on macOS).
SQLite validates authorization and handler behavior; it does not replace the
PostgreSQL/Docker migration and deployment checks. Use the production compose
stack and two test offices for that final verification when Docker is available.


### Technical support: production Docker/PostgreSQL verification

Run from the repository root with Docker available:

```bash
docker build --platform linux/amd64 -t caf-api:support-review ./api
python3 testing/technical-support-docker.py
```

Override the image with `CAF_TEST_API_IMAGE`. The script creates a uniquely named
Docker network, PostgreSQL 15 container with temporary storage and a production
API container exposed on a random loopback port. It uses synthetic credentials,
never reads production environment files, and removes its containers/network on
completion or failure. It checks migration `0062` twice against a legacy system
account (including preserved disabled state), singleton support protection, all
fresh-install migrations and secure support bootstrap, all-office access, password
reset/login, old-token rejection, support delete/demotion denial and restart
persistence. This complements the Go role/handler/race tests and browser suite.

### Profile regression checks

The same local role preview now includes every staff role and a client. With the
preview API and portal running on the loopback ports above, run:

```bash
cd testing
npm run test:e2e:profiles
```

The profile suite covers all eight roles, office visibility, optional fields,
account dates, existing edit permissions, narrow-screen layout, load failure/retry,
photo URL validation/persistence and removal from profile and shared auth state.
Screenshots are saved to `/tmp/caf-profile-e2e` or `CAF_E2E_ARTIFACT_DIR`.
The Docker script also checks the shared staff/client profile contract against
PostgreSQL, verifies reads preserve the last-login timestamp, and uploads,
retrieves and removes a real image through the production API.

### Maquilas and Constructoras

Use the same loopback API preview and portal above. Run role/profile regressions
before the organization suite, since this suite creates additional synthetic
clients/cases that change the fixture totals:

```bash
cd testing
npm run test:roles
npm run test:e2e:roles
npm run test:e2e:profiles
npm run test:e2e:organizations
npm run test:e2e:case-form
```

The organization browser suite registers a factory, links an individual with a
leading-zero employee number and overnight shift, opens a case through the
shared form, confirms historical data survives unlinking, registers a company
with all five legal fields and no email, links a contact, schedules a direct
company appointment through live availability and creates a related-client
event without inviting that client. It checks the normal Usuarios/Citas views,
management-only directory access (including direct URLs/API calls) and narrow-screen layout. Screenshots go to
`/tmp/caf-organizations-e2e` or `CAF_E2E_ARTIFACT_DIR`.

The case-form suite exercises the redesigned form at 320, 390, 768 and 1440
pixels, including stacked employment fields, horizontal overflow and visible
save actions. It covers inline client creation, required employment fields,
paired optional hours, overnight shifts, leading-zero employee numbers, case
snapshots without changing existing client employment, stale selection clearing,
load failure/retry, persistent save errors and reopening reset. Screenshots go
to `/tmp/caf-case-form-e2e` or `CAF_CASE_FORM_ARTIFACT_DIR`. These checks use only
synthetic records on loopback; do not expose the fixture API through a tunnel.

Production database/image verification includes these workflows:

```bash
docker build --platform linux/amd64 -t caf-api:organizations-review ./api
CAF_TEST_API_IMAGE=caf-api:organizations-review python3 testing/technical-support-docker.py
```

In addition to the existing support/profile checks, it replays migration `0063`
twice, tests PostgreSQL uniqueness for named organizations/nonblank emails while
allowing multiple blank company emails, checks office isolation, case snapshots,
factory changes, linked individual contacts, SQL NULL case IDs for company
appointments, no fabricated cases, conflicts and event relationships. Containers
and temporary storage are removed after the run. `go test -race ./...` inside
`api` covers further case/contact scope, atomic failures, calendar link privacy,
hidden-link preservation and direct appointment editing.


### Profile metadata and responsive redesign

The profile browser suite now reproduces the legacy `legal`/`general_practice`
values, checks readable labels and correct IT support information, and verifies
that only practitioner roles display a specialty. It exercises both self-profile
and user-detail screens at 360, 768 and 1440 pixels, checks horizontal overflow,
maintains a specialty through Usuarios and keeps the existing photo regressions.
Screenshots include `support-360.png`, `support-768.png`, `support-1440.png` and
matching practitioner user-detail views in `/tmp/caf-profile-e2e`.

For production API/database checks, build the current image and run:

```bash
docker build --platform linux/amd64 -t caf-api:profile-organization-review ./api
CAF_TEST_API_IMAGE=caf-api:profile-organization-review python3 testing/technical-support-docker.py
```

The isolated PostgreSQL script also verifies IT bootstrap, the shared localized
profile metadata, migration `0064` replay against legacy support values and
preservation of other users and credentials. Go tests cover known role/specialty
compatibility, custom labels, placeholders, atomic validation failures and
clearing unrelated professional data when roles change.


### Single office role and shared maquilas

The role suite rejects the retired role in selectors and API endpoint resolution,
and verifies that a browser with a cached retired role must sign in again. The
backend rejects retired-role login, requests and user assignment. The organization
suite now registers a factory without an office and uses it from two offices,
checking local client/case isolation and the CEO's combined view with office
labels. All selectors include factory record IDs to distinguish legacy names.

Run the production image and upgrade checks with:

```bash
docker build --platform linux/amd64 -t caf-api:shared-maquilas-review ./api
CAF_TEST_API_IMAGE=caf-api:shared-maquilas-review python3 testing/technical-support-docker.py
```

The PostgreSQL script replays `0065`/`0066` against legacy-shaped synthetic tables.
It verifies role conversion without office/credential/status changes, one-time
session invalidation, preservation of duplicate factory IDs, memberships, case
references and snapshots, and retained prior-office audit values. Live API checks
also cover the removed route, invalid role assignment, globally readable factory
metadata and office-scoped clients/cases. Test containers use temporary storage
and are removed after completion.


### Shared Constructoras and management-only directories

Migration 0067 replay checks preserve duplicate companies, canonical account IDs,
credentials/status, contacts and office-specific appointment/event history.
The Go suite tests both management directories against all excluded roles,
minimal employee workflow selectors, shared company identities in Usuarios,
per-office contact and appointment visibility, duplicate names and guarded edits.
The browser suite checks both direct pages and navigation for excluded roles,
a shared company used by two offices, and the global appointment office picker.

```bash
docker build --platform linux/amd64 -t caf-api:shared-constructoras-review ./api
CAF_TEST_API_IMAGE=caf-api:shared-constructoras-review python3 testing/technical-support-docker.py
```
