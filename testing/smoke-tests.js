#!/usr/bin/env node

/**
 * CAF System Smoke Tests
 * 
 * Comprehensive smoke testing suite for production environment.
 * Tests critical user journeys without creating permanent data.
 */

const axios = require('axios');
const chalk = require('chalk');
const config = require('./config');

// Use centralized configuration
const CONFIG = {
    API_BASE: config.API_BASE_URL,
    FRONTEND_BASE: config.FRONTEND_BASE_URL,
    TEST_CREDENTIALS: {
        email: config.TEST_USER_EMAIL,
        password: config.TEST_USER_PASSWORD
    },
    TIMEOUT: config.TIMEOUT,
    MAX_RETRIES: config.MAX_RETRIES
};

// Test results tracking
const results = {
    passed: 0,
    failed: 0,
    skipped: 0,
    tests: []
};

// Utility functions
const log = {
    info: (msg) => console.log(chalk.blue('ℹ️ '), msg),
    success: (msg) => console.log(chalk.green('✅'), msg),
    error: (msg) => console.log(chalk.red('❌'), msg),
    warn: (msg) => console.log(chalk.yellow('⚠️ '), msg),
    test: (msg) => console.log(chalk.cyan('🧪'), msg)
};

// HTTP client with timeout and retry logic
const httpClient = axios.create({
    timeout: CONFIG.TIMEOUT,
    validateStatus: (status) => status < 500 // Don't throw on 4xx errors
});

// Retry function for flaky tests
async function retryOperation(operation, maxRetries = CONFIG.MAX_RETRIES) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            if (attempt < maxRetries) {
                log.warn(`Attempt ${attempt} failed, retrying... (${error.message})`);
                await sleep(1000 * attempt); // Exponential backoff
            }
        }
    }
    
    throw lastError;
}

// Sleep utility
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Test framework
class SmokeTest {
    constructor(name, description) {
        this.name = name;
        this.description = description;
        this.startTime = null;
        this.endTime = null;
    }
    
    async run(testFunction) {
        log.test(`Running: ${this.name}`);
        this.startTime = Date.now();
        
        try {
            await testFunction();
            this.endTime = Date.now();
            const duration = this.endTime - this.startTime;
            
            log.success(`${this.name} - PASSED (${duration}ms)`);
            results.passed++;
            results.tests.push({
                name: this.name,
                status: 'PASSED',
                duration,
                description: this.description
            });
        } catch (error) {
            this.endTime = Date.now();
            const duration = this.endTime - this.startTime;
            
            log.error(`${this.name} - FAILED: ${error.message}`);
            results.failed++;
            results.tests.push({
                name: this.name,
                status: 'FAILED',
                duration,
                description: this.description,
                error: error.message
            });
        }
    }
}

// Authentication helper
class AuthHelper {
    constructor() {
        this.token = null;
        this.userProfile = null;
    }
    
    async login() {
        const response = await httpClient.post(`${CONFIG.API_BASE}/login`, CONFIG.TEST_CREDENTIALS);
        
        if (response.status !== 200) {
            throw new Error(`Login failed with status ${response.status}`);
        }
        
        if (!response.data.token) {
            throw new Error('No token received from login');
        }
        
        this.token = response.data.token;
        return this.token;
    }
    
    async getProfile() {
        if (!this.token) {
            throw new Error('Not authenticated - call login() first');
        }
        
        const response = await httpClient.get(`${CONFIG.API_BASE}/profile`, {
            headers: { Authorization: `Bearer ${this.token}` }
        });
        
        if (response.status !== 200) {
            throw new Error(`Profile fetch failed with status ${response.status}`);
        }
        
        this.userProfile = response.data;
        return this.userProfile;
    }
    
    getAuthHeaders() {
        if (!this.token) {
            throw new Error('Not authenticated');
        }
        return { Authorization: `Bearer ${this.token}` };
    }
}

// Test suites
const testSuites = {
    // Health Check Tests
    async healthChecks() {
        const healthEndpoints = [
            { path: '/health', name: 'Basic Health' },
            { path: '/health/ready', name: 'Database Ready' },
            { path: '/health/live', name: 'AWS ALB Health' },
            { path: '/health/migrations', name: 'Migration Status' },
            { path: '/health/s3', name: 'S3 Storage' },
            { path: '/health/cache', name: 'Cache System' }
        ];
        
        for (const endpoint of healthEndpoints) {
            const test = new SmokeTest(
                `Health Check: ${endpoint.name}`,
                `Verify ${endpoint.path} endpoint is healthy`
            );
            
            await test.run(async () => {
                const url = `${CONFIG.API_BASE.replace('/api/v1', '')}${endpoint.path}`;
                const response = await retryOperation(async () => {
                    return await httpClient.get(url);
                });
                
                if (response.status !== 200) {
                    throw new Error(`Expected 200, got ${response.status}`);
                }
                
                if (!response.data || !response.data.status) {
                    throw new Error('Invalid health check response format');
                }
            });
        }
    },
    
    // Authentication Flow Tests
    async authenticationFlow() {
        const auth = new AuthHelper();
        
        // Test login
        const loginTest = new SmokeTest(
            'User Login',
            'Test user authentication with valid credentials'
        );
        
        await loginTest.run(async () => {
            await retryOperation(async () => {
                await auth.login();
            });
        });
        
        // Test profile retrieval
        const profileTest = new SmokeTest(
            'User Profile',
            'Test authenticated user profile retrieval'
        );
        
        await profileTest.run(async () => {
            const profile = await retryOperation(async () => {
                return await auth.getProfile();
            });
            
            if (!profile.userID || !profile.role) {
                throw new Error('Invalid profile response - missing required fields');
            }
        });
        
        return auth; // Return for use in other tests
    },
    
    // Dashboard Tests
    async dashboardTests(auth) {
        if (!auth || !auth.token) {
            results.skipped++;
            log.warn('Skipping dashboard tests - authentication failed');
            return;
        }
        
        const dashboardTest = new SmokeTest(
            'Dashboard Summary',
            'Test dashboard summary data retrieval'
        );
        
        await dashboardTest.run(async () => {
            const response = await retryOperation(async () => {
                return await httpClient.get(`${CONFIG.API_BASE}/dashboard-summary`, {
                    headers: auth.getAuthHeaders()
                });
            });
            
            if (response.status !== 200) {
                throw new Error(`Expected 200, got ${response.status}`);
            }
            
            // Verify dashboard has expected structure
            const data = response.data;
            if (!data || typeof data !== 'object') {
                throw new Error('Invalid dashboard response format');
            }
        });
        
        const announcementsTest = new SmokeTest(
            'Dashboard Announcements',
            'Test announcements retrieval'
        );
        
        await announcementsTest.run(async () => {
            const response = await retryOperation(async () => {
                return await httpClient.get(`${CONFIG.API_BASE}/dashboard/announcements`, {
                    headers: auth.getAuthHeaders()
                });
            });
            
            if (response.status !== 200) {
                throw new Error(`Expected 200, got ${response.status}`);
            }
            
            // Verify response is an array
            if (!Array.isArray(response.data)) {
                throw new Error('Announcements should be an array');
            }
        });
    },
    
    // Cases Management Tests (Read-only)
    async casesTests(auth) {
        if (!auth || !auth.token) {
            results.skipped++;
            log.warn('Skipping cases tests - authentication failed');
            return;
        }
        
        const casesListTest = new SmokeTest(
            'Cases List',
            'Test cases list retrieval'
        );
        
        await casesListTest.run(async () => {
            const response = await retryOperation(async () => {
                return await httpClient.get(`${CONFIG.API_BASE}/cases?limit=10`, {
                    headers: auth.getAuthHeaders()
                });
            });
            
            if (response.status !== 200) {
                throw new Error(`Expected 200, got ${response.status}`);
            }
            
            const data = response.data;
            if (!data || !Array.isArray(data.cases)) {
                throw new Error('Invalid cases response format');
            }
        });
        
        const myCasesTest = new SmokeTest(
            'My Cases',
            'Test user-specific cases retrieval'
        );
        
        await myCasesTest.run(async () => {
            const response = await retryOperation(async () => {
                return await httpClient.get(`${CONFIG.API_BASE}/cases/my`, {
                    headers: auth.getAuthHeaders()
                });
            });
            
            if (response.status !== 200) {
                throw new Error(`Expected 200, got ${response.status}`);
            }
            
            // Should return array even if empty
            if (!Array.isArray(response.data)) {
                throw new Error('My cases should be an array');
            }
        });
    },
    
    // Appointments Tests (Read-only)
    async appointmentsTests(auth) {
        if (!auth || !auth.token) {
            results.skipped++;
            log.warn('Skipping appointments tests - authentication failed');
            return;
        }
        
        const appointmentsListTest = new SmokeTest(
            'Appointments List',
            'Test appointments list retrieval'
        );
        
        await appointmentsListTest.run(async () => {
            const response = await retryOperation(async () => {
                return await httpClient.get(`${CONFIG.API_BASE}/appointments?limit=10`, {
                    headers: auth.getAuthHeaders()
                });
            });
            
            if (response.status !== 200) {
                throw new Error(`Expected 200, got ${response.status}`);
            }
            
            const data = response.data;
            if (!data || !Array.isArray(data.appointments)) {
                throw new Error('Invalid appointments response format');
            }
        });
    },
    
    // Frontend Tests
    async frontendTests() {
        const frontendTest = new SmokeTest(
            'Frontend Availability',
            'Test frontend application accessibility'
        );
        
        await frontendTest.run(async () => {
            const response = await retryOperation(async () => {
                return await httpClient.get(CONFIG.FRONTEND_BASE);
            });
            
            if (response.status !== 200) {
                throw new Error(`Expected 200, got ${response.status}`);
            }
            
            // Check if it's actually HTML content
            const contentType = response.headers['content-type'];
            if (!contentType || !contentType.includes('text/html')) {
                throw new Error('Frontend should return HTML content');
            }
        });
    },
    
    // Notifications Tests
    async notificationsTests(auth) {
        if (!auth || !auth.token) {
            results.skipped++;
            log.warn('Skipping notifications tests - authentication failed');
            return;
        }
        
        const notificationsTest = new SmokeTest(
            'Notifications',
            'Test notifications retrieval'
        );
        
        await notificationsTest.run(async () => {
            const response = await retryOperation(async () => {
                return await httpClient.get(`${CONFIG.API_BASE}/notifications`, {
                    headers: auth.getAuthHeaders()
                });
            });
            
            if (response.status !== 200) {
                throw new Error(`Expected 200, got ${response.status}`);
            }
            
            // Should return array even if empty
            if (!Array.isArray(response.data)) {
                throw new Error('Notifications should be an array');
            }
        });
    }
};

// Main execution
async function runSmokeTests() {
    console.log(chalk.bold.blue('\n🚀 CAF System Smoke Tests'));
    console.log(chalk.blue('====================================='));
    console.log(`API Base: ${CONFIG.API_BASE}`);
    console.log(`Frontend: ${CONFIG.FRONTEND_BASE}`);
    console.log(`Test User: ${CONFIG.TEST_CREDENTIALS.email}`);
    console.log(`Timeout: ${CONFIG.TIMEOUT}ms`);
    console.log('');
    
    const startTime = Date.now();
    let auth = null;
    
    try {
        // Run test suites in order
        log.info('Running health checks...');
        await testSuites.healthChecks();
        
        log.info('Testing authentication flow...');
        auth = await testSuites.authenticationFlow();
        
        log.info('Testing dashboard...');
        await testSuites.dashboardTests(auth);
        
        log.info('Testing cases management...');
        await testSuites.casesTests(auth);
        
        log.info('Testing appointments...');
        await testSuites.appointmentsTests(auth);
        
        log.info('Testing notifications...');
        await testSuites.notificationsTests(auth);
        
        log.info('Testing frontend...');
        await testSuites.frontendTests();
        
    } catch (error) {
        log.error(`Test suite execution failed: ${error.message}`);
    }
    
    const endTime = Date.now();
    const totalDuration = endTime - startTime;
    
    // Print results
    console.log('\n' + chalk.bold.blue('📊 Test Results'));
    console.log(chalk.blue('================'));
    console.log(`Total Duration: ${totalDuration}ms`);
    console.log(`Tests Run: ${results.passed + results.failed}`);
    console.log(chalk.green(`Passed: ${results.passed}`));
    console.log(chalk.red(`Failed: ${results.failed}`));
    console.log(chalk.yellow(`Skipped: ${results.skipped}`));
    
    if (results.failed > 0) {
        console.log('\n' + chalk.bold.red('❌ Failed Tests:'));
        results.tests
            .filter(test => test.status === 'FAILED')
            .forEach(test => {
                console.log(chalk.red(`  • ${test.name}: ${test.error}`));
            });
    }
    
    // Exit with appropriate code
    const exitCode = results.failed > 0 ? 1 : 0;
    
    if (exitCode === 0) {
        console.log('\n' + chalk.bold.green('🎉 All smoke tests passed!'));
    } else {
        console.log('\n' + chalk.bold.red('💥 Some tests failed!'));
    }
    
    process.exit(exitCode);
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
    log.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    log.error(`Uncaught Exception: ${error.message}`);
    process.exit(1);
});

// Run if called directly
if (require.main === module) {
    runSmokeTests();
}

module.exports = { runSmokeTests, SmokeTest, AuthHelper };
