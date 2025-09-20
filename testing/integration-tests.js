#!/usr/bin/env node

/**
 * CAF System Integration Tests
 * 
 * End-to-end integration tests that create, modify, and clean up test data.
 * These tests verify complete workflows work correctly in production.
 * 
 * ⚠️ WARNING: These tests create and modify data in the production database.
 * Only run during scheduled maintenance windows with proper backups.
 */

const axios = require('axios');
const chalk = require('chalk');
require('dotenv').config();

// Configuration
const CONFIG = {
    API_BASE: process.env.API_BASE_URL || 'https://api.caf-mexico.org/api/v1',
    TEST_CREDENTIALS: {
        email: process.env.TEST_USER_EMAIL || 'test@caf-mexico.org',
        password: process.env.TEST_USER_PASSWORD || 'TestPassword123'
    },
    ADMIN_CREDENTIALS: {
        email: process.env.ADMIN_TEST_EMAIL || 'admin@caf-mexico.org',
        password: process.env.ADMIN_TEST_PASSWORD || 'AdminPassword123'
    },
    TIMEOUT: 15000, // 15 seconds for integration tests
    TEST_DATA_PREFIX: 'INTEGRATION_TEST_',
    DRY_RUN: process.env.DRY_RUN === 'true' // Set to true to skip destructive operations
};

// Test results tracking
const results = {
    passed: 0,
    failed: 0,
    skipped: 0,
    tests: [],
    createdData: [] // Track created data for cleanup
};

// Utility functions
const log = {
    info: (msg) => console.log(chalk.blue('ℹ️ '), msg),
    success: (msg) => console.log(chalk.green('✅'), msg),
    error: (msg) => console.log(chalk.red('❌'), msg),
    warn: (msg) => console.log(chalk.yellow('⚠️ '), msg),
    test: (msg) => console.log(chalk.cyan('🧪'), msg),
    cleanup: (msg) => console.log(chalk.magenta('🧹'), msg)
};

// HTTP client
const httpClient = axios.create({
    timeout: CONFIG.TIMEOUT,
    validateStatus: (status) => status < 500
});

// Authentication helper
class IntegrationAuth {
    constructor() {
        this.userToken = null;
        this.adminToken = null;
        this.userProfile = null;
        this.adminProfile = null;
    }
    
    async loginUser() {
        const response = await httpClient.post(`${CONFIG.API_BASE}/login`, CONFIG.TEST_CREDENTIALS);
        if (response.status !== 200 || !response.data.token) {
            throw new Error(`User login failed: ${response.status}`);
        }
        this.userToken = response.data.token;
        return this.userToken;
    }
    
    async loginAdmin() {
        const response = await httpClient.post(`${CONFIG.API_BASE}/login`, CONFIG.ADMIN_CREDENTIALS);
        if (response.status !== 200 || !response.data.token) {
            throw new Error(`Admin login failed: ${response.status}`);
        }
        this.adminToken = response.data.token;
        return this.adminToken;
    }
    
    getUserHeaders() {
        if (!this.userToken) throw new Error('User not authenticated');
        return { Authorization: `Bearer ${this.userToken}` };
    }
    
    getAdminHeaders() {
        if (!this.adminToken) throw new Error('Admin not authenticated');
        return { Authorization: `Bearer ${this.adminToken}` };
    }
}

// Test framework
class IntegrationTest {
    constructor(name, description, destructive = false) {
        this.name = name;
        this.description = description;
        this.destructive = destructive;
        this.startTime = null;
        this.endTime = null;
    }
    
    async run(testFunction) {
        log.test(`Running: ${this.name}`);
        
        if (this.destructive && CONFIG.DRY_RUN) {
            log.warn(`Skipping destructive test in dry-run mode: ${this.name}`);
            results.skipped++;
            return;
        }
        
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
                description: this.description,
                destructive: this.destructive
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
                error: error.message,
                destructive: this.destructive
            });
        }
    }
}

// Data cleanup helper
class DataCleanup {
    constructor(auth) {
        this.auth = auth;
        this.createdItems = [];
    }
    
    trackCreated(type, id, data = {}) {
        this.createdItems.push({ type, id, data, timestamp: new Date() });
        results.createdData.push({ type, id, data, timestamp: new Date() });
    }
    
    async cleanup() {
        log.cleanup('Starting test data cleanup...');
        let cleanedCount = 0;
        let failedCount = 0;
        
        // Clean up in reverse order (newest first)
        for (const item of this.createdItems.reverse()) {
            try {
                await this.cleanupItem(item);
                cleanedCount++;
                log.cleanup(`Cleaned up ${item.type} ${item.id}`);
            } catch (error) {
                failedCount++;
                log.error(`Failed to cleanup ${item.type} ${item.id}: ${error.message}`);
            }
        }
        
        log.cleanup(`Cleanup complete: ${cleanedCount} cleaned, ${failedCount} failed`);
        return { cleaned: cleanedCount, failed: failedCount };
    }
    
    async cleanupItem(item) {
        const headers = this.auth.getAdminHeaders();
        
        switch (item.type) {
            case 'case':
                await httpClient.delete(`${CONFIG.API_BASE}/admin/cases/${item.id}`, { headers });
                break;
            case 'appointment':
                await httpClient.delete(`${CONFIG.API_BASE}/admin/appointments/${item.id}`, { headers });
                break;
            case 'task':
                await httpClient.delete(`${CONFIG.API_BASE}/admin/tasks/${item.id}`, { headers });
                break;
            case 'user':
                await httpClient.delete(`${CONFIG.API_BASE}/admin/users/${item.id}`, { headers });
                break;
            case 'office':
                await httpClient.delete(`${CONFIG.API_BASE}/admin/offices/${item.id}`, { headers });
                break;
            default:
                log.warn(`Unknown cleanup type: ${item.type}`);
        }
    }
}

// Test suites
const testSuites = {
    // Complete Case Lifecycle Test
    async caseLifecycleTest(auth, cleanup) {
        const caseData = {
            title: `${CONFIG.TEST_DATA_PREFIX}Case_${Date.now()}`,
            description: 'Integration test case - safe to delete',
            category: 'General',
            priority: 'Medium',
            clientFirstName: 'Test',
            clientLastName: 'Client',
            clientEmail: `test_client_${Date.now()}@example.com`,
            clientPhone: '555-0123'
        };
        
        let caseId = null;
        
        // Create case
        const createTest = new IntegrationTest(
            'Case Creation',
            'Test complete case creation workflow',
            true
        );
        
        await createTest.run(async () => {
            const response = await httpClient.post(
                `${CONFIG.API_BASE}/cases`,
                caseData,
                { headers: auth.getUserHeaders() }
            );
            
            if (response.status !== 201) {
                throw new Error(`Expected 201, got ${response.status}: ${JSON.stringify(response.data)}`);
            }
            
            caseId = response.data.id || response.data.case?.id;
            if (!caseId) {
                throw new Error('No case ID returned from creation');
            }
            
            cleanup.trackCreated('case', caseId, caseData);
        });
        
        if (!caseId) return;
        
        // Read case
        const readTest = new IntegrationTest(
            'Case Retrieval',
            'Test case retrieval by ID'
        );
        
        await readTest.run(async () => {
            const response = await httpClient.get(
                `${CONFIG.API_BASE}/cases/${caseId}`,
                { headers: auth.getUserHeaders() }
            );
            
            if (response.status !== 200) {
                throw new Error(`Expected 200, got ${response.status}`);
            }
            
            const retrievedCase = response.data;
            if (retrievedCase.title !== caseData.title) {
                throw new Error('Retrieved case title does not match created case');
            }
        });
        
        // Update case
        const updateTest = new IntegrationTest(
            'Case Update',
            'Test case modification',
            true
        );
        
        await updateTest.run(async () => {
            const updateData = {
                description: 'Updated integration test case - safe to delete',
                priority: 'High'
            };
            
            const response = await httpClient.put(
                `${CONFIG.API_BASE}/cases/${caseId}`,
                updateData,
                { headers: auth.getUserHeaders() }
            );
            
            if (response.status !== 200) {
                throw new Error(`Expected 200, got ${response.status}`);
            }
        });
        
        // Add comment to case
        const commentTest = new IntegrationTest(
            'Case Comment',
            'Test adding comment to case',
            true
        );
        
        await commentTest.run(async () => {
            const commentData = {
                content: 'Integration test comment - safe to delete',
                isInternal: false
            };
            
            const response = await httpClient.post(
                `${CONFIG.API_BASE}/cases/${caseId}/comments`,
                commentData,
                { headers: auth.getUserHeaders() }
            );
            
            if (response.status !== 201) {
                throw new Error(`Expected 201, got ${response.status}`);
            }
        });
        
        return caseId;
    },
    
    // Appointment Workflow Test
    async appointmentWorkflowTest(auth, cleanup, caseId = null) {
        const appointmentData = {
            title: `${CONFIG.TEST_DATA_PREFIX}Appointment_${Date.now()}`,
            description: 'Integration test appointment - safe to delete',
            appointmentDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
            duration: 60,
            type: 'Consultation',
            clientFirstName: 'Test',
            clientLastName: 'Client',
            clientEmail: `test_appointment_${Date.now()}@example.com`,
            clientPhone: '555-0124'
        };
        
        if (caseId) {
            appointmentData.caseId = caseId;
        }
        
        let appointmentId = null;
        
        // Create appointment
        const createTest = new IntegrationTest(
            'Appointment Creation',
            'Test appointment booking workflow',
            true
        );
        
        await createTest.run(async () => {
            const response = await httpClient.post(
                `${CONFIG.API_BASE}/appointments`,
                appointmentData,
                { headers: auth.getUserHeaders() }
            );
            
            if (response.status !== 201) {
                throw new Error(`Expected 201, got ${response.status}: ${JSON.stringify(response.data)}`);
            }
            
            appointmentId = response.data.id || response.data.appointment?.id;
            if (!appointmentId) {
                throw new Error('No appointment ID returned from creation');
            }
            
            cleanup.trackCreated('appointment', appointmentId, appointmentData);
        });
        
        if (!appointmentId) return;
        
        // Update appointment
        const updateTest = new IntegrationTest(
            'Appointment Update',
            'Test appointment modification',
            true
        );
        
        await updateTest.run(async () => {
            const updateData = {
                description: 'Updated integration test appointment - safe to delete',
                duration: 90
            };
            
            const response = await httpClient.put(
                `${CONFIG.API_BASE}/appointments/${appointmentId}`,
                updateData,
                { headers: auth.getUserHeaders() }
            );
            
            if (response.status !== 200) {
                throw new Error(`Expected 200, got ${response.status}`);
            }
        });
        
        return appointmentId;
    },
    
    // Task Management Test
    async taskManagementTest(auth, cleanup, caseId = null) {
        if (!caseId) {
            log.warn('Skipping task management test - no case ID provided');
            results.skipped++;
            return;
        }
        
        const taskData = {
            title: `${CONFIG.TEST_DATA_PREFIX}Task_${Date.now()}`,
            description: 'Integration test task - safe to delete',
            priority: 'Medium',
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Next week
            caseId: caseId
        };
        
        let taskId = null;
        
        // Create task
        const createTest = new IntegrationTest(
            'Task Creation',
            'Test task creation workflow',
            true
        );
        
        await createTest.run(async () => {
            const response = await httpClient.post(
                `${CONFIG.API_BASE}/tasks`,
                taskData,
                { headers: auth.getUserHeaders() }
            );
            
            if (response.status !== 201) {
                throw new Error(`Expected 201, got ${response.status}: ${JSON.stringify(response.data)}`);
            }
            
            taskId = response.data.id || response.data.task?.id;
            if (!taskId) {
                throw new Error('No task ID returned from creation');
            }
            
            cleanup.trackCreated('task', taskId, taskData);
        });
        
        if (!taskId) return;
        
        // Update task status
        const updateTest = new IntegrationTest(
            'Task Status Update',
            'Test task status modification',
            true
        );
        
        await updateTest.run(async () => {
            const updateData = {
                status: 'In Progress',
                description: 'Updated integration test task - safe to delete'
            };
            
            const response = await httpClient.put(
                `${CONFIG.API_BASE}/tasks/${taskId}`,
                updateData,
                { headers: auth.getUserHeaders() }
            );
            
            if (response.status !== 200) {
                throw new Error(`Expected 200, got ${response.status}`);
            }
        });
        
        return taskId;
    },
    
    // Search and Filter Test
    async searchAndFilterTest(auth) {
        const searchTest = new IntegrationTest(
            'Case Search',
            'Test case search and filtering functionality'
        );
        
        await searchTest.run(async () => {
            // Test basic search
            const searchResponse = await httpClient.get(
                `${CONFIG.API_BASE}/cases?search=${CONFIG.TEST_DATA_PREFIX}&limit=10`,
                { headers: auth.getUserHeaders() }
            );
            
            if (searchResponse.status !== 200) {
                throw new Error(`Expected 200, got ${searchResponse.status}`);
            }
            
            // Test filter by priority
            const filterResponse = await httpClient.get(
                `${CONFIG.API_BASE}/cases?priority=Medium&limit=10`,
                { headers: auth.getUserHeaders() }
            );
            
            if (filterResponse.status !== 200) {
                throw new Error(`Expected 200, got ${filterResponse.status}`);
            }
        });
        
        const appointmentSearchTest = new IntegrationTest(
            'Appointment Search',
            'Test appointment search and filtering'
        );
        
        await appointmentSearchTest.run(async () => {
            const response = await httpClient.get(
                `${CONFIG.API_BASE}/appointments?search=${CONFIG.TEST_DATA_PREFIX}&limit=10`,
                { headers: auth.getUserHeaders() }
            );
            
            if (response.status !== 200) {
                throw new Error(`Expected 200, got ${response.status}`);
            }
        });
    }
};

// Main execution
async function runIntegrationTests() {
    console.log(chalk.bold.blue('\n🔧 CAF System Integration Tests'));
    console.log(chalk.blue('=========================================='));
    console.log(`API Base: ${CONFIG.API_BASE}`);
    console.log(`Test User: ${CONFIG.TEST_CREDENTIALS.email}`);
    console.log(`Admin User: ${CONFIG.ADMIN_CREDENTIALS.email}`);
    console.log(`Dry Run: ${CONFIG.DRY_RUN ? 'YES' : 'NO'}`);
    console.log(`Test Prefix: ${CONFIG.TEST_DATA_PREFIX}`);
    
    if (CONFIG.DRY_RUN) {
        log.warn('Running in DRY RUN mode - destructive operations will be skipped');
    } else {
        log.warn('Running in LIVE mode - test data will be created and cleaned up');
    }
    
    console.log('');
    
    const startTime = Date.now();
    const auth = new IntegrationAuth();
    const cleanup = new DataCleanup(auth);
    
    try {
        // Authenticate
        log.info('Authenticating users...');
        await auth.loginUser();
        await auth.loginAdmin();
        
        log.info('Starting integration tests...');
        
        // Run case lifecycle test
        log.info('Testing case lifecycle...');
        const caseId = await testSuites.caseLifecycleTest(auth, cleanup);
        
        // Run appointment workflow test
        log.info('Testing appointment workflow...');
        const appointmentId = await testSuites.appointmentWorkflowTest(auth, cleanup, caseId);
        
        // Run task management test
        log.info('Testing task management...');
        await testSuites.taskManagementTest(auth, cleanup, caseId);
        
        // Run search and filter test
        log.info('Testing search and filters...');
        await testSuites.searchAndFilterTest(auth);
        
        // Cleanup test data
        if (!CONFIG.DRY_RUN) {
            log.info('Cleaning up test data...');
            await cleanup.cleanup();
        }
        
    } catch (error) {
        log.error(`Integration test execution failed: ${error.message}`);
        
        // Attempt cleanup even if tests failed
        if (!CONFIG.DRY_RUN) {
            log.info('Attempting cleanup after failure...');
            try {
                await cleanup.cleanup();
            } catch (cleanupError) {
                log.error(`Cleanup failed: ${cleanupError.message}`);
            }
        }
    }
    
    const endTime = Date.now();
    const totalDuration = endTime - startTime;
    
    // Print results
    console.log('\n' + chalk.bold.blue('📊 Integration Test Results'));
    console.log(chalk.blue('==============================='));
    console.log(`Total Duration: ${totalDuration}ms`);
    console.log(`Tests Run: ${results.passed + results.failed}`);
    console.log(chalk.green(`Passed: ${results.passed}`));
    console.log(chalk.red(`Failed: ${results.failed}`));
    console.log(chalk.yellow(`Skipped: ${results.skipped}`));
    console.log(`Data Created: ${results.createdData.length} items`);
    
    if (results.failed > 0) {
        console.log('\n' + chalk.bold.red('❌ Failed Tests:'));
        results.tests
            .filter(test => test.status === 'FAILED')
            .forEach(test => {
                console.log(chalk.red(`  • ${test.name}: ${test.error}`));
            });
    }
    
    if (results.createdData.length > 0 && CONFIG.DRY_RUN) {
        console.log('\n' + chalk.bold.yellow('⚠️  Test Data That Would Be Created:'));
        results.createdData.forEach(item => {
            console.log(chalk.yellow(`  • ${item.type}: ${item.id}`));
        });
    }
    
    // Exit with appropriate code
    const exitCode = results.failed > 0 ? 1 : 0;
    
    if (exitCode === 0) {
        console.log('\n' + chalk.bold.green('🎉 All integration tests passed!'));
    } else {
        console.log('\n' + chalk.bold.red('💥 Some integration tests failed!'));
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
    runIntegrationTests();
}

module.exports = { runIntegrationTests, IntegrationTest, IntegrationAuth };
