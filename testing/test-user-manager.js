#!/usr/bin/env node

/**
 * CAF System - Test User Account Manager
 * 
 * Securely creates and manages dedicated test user accounts for production testing.
 * This script ensures test accounts are properly isolated and secure.
 */

const axios = require('axios');
const crypto = require('crypto');
const chalk = require('chalk');
require('dotenv').config();

// Configuration
const CONFIG = {
    API_BASE: process.env.API_BASE_URL || 'https://api.caf-mexico.org/api/v1',
    ADMIN_EMAIL: process.env.ADMIN_EMAIL || '',
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '',
    TEST_USER_PREFIX: 'TEST_',
    TEST_DOMAIN: '@caf-test.local',
    DRY_RUN: process.env.DRY_RUN === 'true'
};

// Test user configurations
const TEST_USERS = {
    regular: {
        email: 'test-user@caf-test.local',
        firstName: 'Test',
        lastName: 'User',
        role: 'client',
        department: 'General',
        description: 'Regular test user for smoke tests'
    },
    staff: {
        email: 'test-staff@caf-test.local',
        firstName: 'Test',
        lastName: 'Staff',
        role: 'staff',
        department: 'Legal',
        specialty: 'Immigration',
        description: 'Staff test user for staff workflow testing'
    },
    admin: {
        email: 'test-admin@caf-test.local',
        firstName: 'Test',
        lastName: 'Admin',
        role: 'admin',
        department: 'Administration',
        description: 'Admin test user for integration tests'
    },
    manager: {
        email: 'test-manager@caf-test.local',
        firstName: 'Test',
        lastName: 'Manager',
        role: 'office_manager',
        department: 'Management',
        description: 'Office manager test user for manager workflow testing'
    }
};

// Utility functions
const log = {
    info: (msg) => console.log(chalk.blue('ℹ️ '), msg),
    success: (msg) => console.log(chalk.green('✅'), msg),
    error: (msg) => console.log(chalk.red('❌'), msg),
    warn: (msg) => console.log(chalk.yellow('⚠️ '), msg),
    security: (msg) => console.log(chalk.magenta('🔐'), msg)
};

// HTTP client
const httpClient = axios.create({
    timeout: 10000,
    validateStatus: (status) => status < 500
});

// Admin authentication helper
class AdminAuth {
    constructor() {
        this.token = null;
        this.profile = null;
    }
    
    async login() {
        if (!CONFIG.ADMIN_EMAIL || !CONFIG.ADMIN_PASSWORD) {
            throw new Error('Admin credentials not configured. Set ADMIN_EMAIL and ADMIN_PASSWORD environment variables.');
        }
        
        log.info('Authenticating admin user...');
        
        const response = await httpClient.post(`${CONFIG.API_BASE}/login`, {
            email: CONFIG.ADMIN_EMAIL,
            password: CONFIG.ADMIN_PASSWORD
        });
        
        if (response.status !== 200 || !response.data.token) {
            throw new Error(`Admin login failed: ${response.status} - ${JSON.stringify(response.data)}`);
        }
        
        this.token = response.data.token;
        log.success('Admin authentication successful');
        return this.token;
    }
    
    getHeaders() {
        if (!this.token) throw new Error('Admin not authenticated');
        return { Authorization: `Bearer ${this.token}` };
    }
    
    async getProfile() {
        const response = await httpClient.get(`${CONFIG.API_BASE}/profile`, {
            headers: this.getHeaders()
        });
        
        if (response.status !== 200) {
            throw new Error(`Failed to get admin profile: ${response.status}`);
        }
        
        this.profile = response.data;
        return this.profile;
    }
}

// Test user manager
class TestUserManager {
    constructor(adminAuth) {
        this.adminAuth = adminAuth;
        this.createdUsers = [];
    }
    
    generateSecurePassword() {
        // Generate a secure password with mixed case, numbers, and symbols
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        
        // Ensure at least one of each type
        password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // Uppercase
        password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // Lowercase
        password += '0123456789'[Math.floor(Math.random() * 10)]; // Number
        password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // Symbol
        
        // Fill the rest randomly
        for (let i = 4; i < 16; i++) {
            password += charset[Math.floor(Math.random() * charset.length)];
        }
        
        // Shuffle the password
        return password.split('').sort(() => Math.random() - 0.5).join('');
    }
    
    async checkUserExists(email) {
        try {
            const response = await httpClient.get(`${CONFIG.API_BASE}/admin/users?search=${encodeURIComponent(email)}`, {
                headers: this.adminAuth.getHeaders()
            });
            
            if (response.status === 200 && response.data && response.data.users) {
                return response.data.users.some(user => user.email === email);
            }
        } catch (error) {
            log.warn(`Could not check if user exists: ${error.message}`);
        }
        return false;
    }
    
    async createTestUser(userType, userData) {
        log.info(`Creating ${userType} test user...`);
        
        if (CONFIG.DRY_RUN) {
            log.warn('DRY RUN: Would create user but skipping actual creation');
            return { email: userData.email, password: 'DRY_RUN_PASSWORD', created: false };
        }
        
        // Check if user already exists
        const exists = await this.checkUserExists(userData.email);
        if (exists) {
            log.warn(`Test user ${userData.email} already exists - skipping creation`);
            return { email: userData.email, password: null, created: false, existed: true };
        }
        
        // Generate secure password
        const password = this.generateSecurePassword();
        
        // Prepare user data
        const createData = {
            email: userData.email,
            password: password,
            firstName: userData.firstName,
            lastName: userData.lastName,
            role: userData.role,
            department: userData.department,
            specialty: userData.specialty || '',
            phone: '+1-555-TEST-' + Math.floor(Math.random() * 1000).toString().padStart(3, '0'),
            isActive: true,
            notes: `${userData.description} - Created by test user manager on ${new Date().toISOString()}`
        };
        
        // Create the user
        const response = await httpClient.post(`${CONFIG.API_BASE}/admin/users`, createData, {
            headers: this.adminAuth.getHeaders()
        });
        
        if (response.status !== 201 && response.status !== 200) {
            throw new Error(`Failed to create ${userType} user: ${response.status} - ${JSON.stringify(response.data)}`);
        }
        
        log.success(`Created ${userType} test user: ${userData.email}`);
        
        const createdUser = {
            type: userType,
            email: userData.email,
            password: password,
            role: userData.role,
            id: response.data.id || response.data.user?.id,
            created: true
        };
        
        this.createdUsers.push(createdUser);
        return createdUser;
    }
    
    async createAllTestUsers() {
        log.info('Creating all test user accounts...');
        const results = {};
        
        for (const [userType, userData] of Object.entries(TEST_USERS)) {
            try {
                results[userType] = await this.createTestUser(userType, userData);
                
                // Small delay between user creations
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                log.error(`Failed to create ${userType} user: ${error.message}`);
                results[userType] = { error: error.message, created: false };
            }
        }
        
        return results;
    }
    
    async validateTestUser(userType, credentials) {
        log.info(`Validating ${userType} test user login...`);
        
        try {
            const response = await httpClient.post(`${CONFIG.API_BASE}/login`, {
                email: credentials.email,
                password: credentials.password
            });
            
            if (response.status === 200 && response.data.token) {
                log.success(`${userType} user login validation successful`);
                
                // Validate profile access
                const profileResponse = await httpClient.get(`${CONFIG.API_BASE}/profile`, {
                    headers: { Authorization: `Bearer ${response.data.token}` }
                });
                
                if (profileResponse.status === 200) {
                    log.success(`${userType} user profile access validated`);
                    return {
                        loginSuccess: true,
                        profileAccess: true,
                        token: response.data.token,
                        profile: profileResponse.data
                    };
                } else {
                    log.warn(`${userType} user profile access failed`);
                    return { loginSuccess: true, profileAccess: false };
                }
            } else {
                log.error(`${userType} user login validation failed: ${response.status}`);
                return { loginSuccess: false, error: response.data };
            }
        } catch (error) {
            log.error(`${userType} user validation error: ${error.message}`);
            return { loginSuccess: false, error: error.message };
        }
    }
    
    async cleanupTestUsers() {
        if (this.createdUsers.length === 0) {
            log.info('No test users to clean up');
            return;
        }
        
        log.info('Cleaning up created test users...');
        
        for (const user of this.createdUsers) {
            if (!user.created || !user.id) continue;
            
            try {
                if (CONFIG.DRY_RUN) {
                    log.warn(`DRY RUN: Would delete user ${user.email}`);
                    continue;
                }
                
                const response = await httpClient.delete(`${CONFIG.API_BASE}/admin/users/${user.id}`, {
                    headers: this.adminAuth.getHeaders()
                });
                
                if (response.status === 200) {
                    log.success(`Cleaned up test user: ${user.email}`);
                } else {
                    log.warn(`Failed to cleanup user ${user.email}: ${response.status}`);
                }
            } catch (error) {
                log.error(`Error cleaning up user ${user.email}: ${error.message}`);
            }
        }
    }
    
    generateCredentialsFile(results) {
        const credentialsData = {
            generated: new Date().toISOString(),
            api_base: CONFIG.API_BASE,
            test_users: {}
        };
        
        for (const [userType, result] of Object.entries(results)) {
            if (result.created && result.password) {
                credentialsData.test_users[userType] = {
                    email: result.email,
                    password: result.password,
                    role: result.role
                };
            }
        }
        
        // Write to secure credentials file
        const fs = require('fs');
        const credentialsFile = '.test-credentials.json';
        
        if (!CONFIG.DRY_RUN) {
            fs.writeFileSync(credentialsFile, JSON.stringify(credentialsData, null, 2), { mode: 0o600 });
            log.success(`Test credentials saved to ${credentialsFile} (secure permissions)`);
        } else {
            log.info('DRY RUN: Would save credentials to file');
            console.log(JSON.stringify(credentialsData, null, 2));
        }
        
        return credentialsFile;
    }
}

// Security audit functions
class SecurityAuditor {
    constructor(adminAuth) {
        this.adminAuth = adminAuth;
    }
    
    async auditTestUsers(results) {
        log.security('Performing security audit of test users...');
        
        const auditResults = {
            passed: 0,
            failed: 0,
            issues: []
        };
        
        for (const [userType, result] of Object.entries(results)) {
            if (!result.created) continue;
            
            // Check password strength
            if (result.password && result.password.length >= 12) {
                auditResults.passed++;
            } else {
                auditResults.failed++;
                auditResults.issues.push(`${userType}: Weak password`);
            }
            
            // Check email domain
            if (result.email && result.email.includes('@caf-test.local')) {
                auditResults.passed++;
            } else {
                auditResults.failed++;
                auditResults.issues.push(`${userType}: Non-test email domain`);
            }
            
            // Check role assignment
            const expectedRole = TEST_USERS[userType]?.role;
            if (result.role === expectedRole) {
                auditResults.passed++;
            } else {
                auditResults.failed++;
                auditResults.issues.push(`${userType}: Incorrect role assignment`);
            }
        }
        
        log.security(`Security audit complete: ${auditResults.passed} passed, ${auditResults.failed} failed`);
        
        if (auditResults.issues.length > 0) {
            log.error('Security issues found:');
            auditResults.issues.forEach(issue => log.error(`  - ${issue}`));
        } else {
            log.success('All security checks passed');
        }
        
        return auditResults;
    }
}

// Main execution functions
async function createTestUsers() {
    console.log(chalk.bold.blue('\n🔐 CAF Test User Account Manager'));
    console.log(chalk.blue('====================================='));
    console.log(`API Base: ${CONFIG.API_BASE}`);
    console.log(`Admin User: ${CONFIG.ADMIN_EMAIL}`);
    console.log(`Dry Run: ${CONFIG.DRY_RUN ? 'YES' : 'NO'}`);
    console.log('');
    
    const adminAuth = new AdminAuth();
    const userManager = new TestUserManager(adminAuth);
    const auditor = new SecurityAuditor(adminAuth);
    
    try {
        // Authenticate admin
        await adminAuth.login();
        
        // Verify admin permissions
        const profile = await adminAuth.getProfile();
        if (profile.role !== 'admin') {
            throw new Error('User does not have admin privileges');
        }
        
        log.security('Admin privileges verified');
        
        // Create all test users
        const results = await userManager.createAllTestUsers();
        
        // Validate created users
        const validations = {};
        for (const [userType, result] of Object.entries(results)) {
            if (result.created && result.password) {
                validations[userType] = await userManager.validateTestUser(userType, result);
            }
        }
        
        // Generate credentials file
        const credentialsFile = userManager.generateCredentialsFile(results);
        
        // Security audit
        const auditResults = await auditor.auditTestUsers(results);
        
        // Summary
        console.log('\n' + chalk.bold.green('📊 Test User Creation Summary'));
        console.log(chalk.green('=============================='));
        
        let createdCount = 0;
        let validatedCount = 0;
        
        for (const [userType, result] of Object.entries(results)) {
            const status = result.created ? '✅ Created' : 
                          result.existed ? '⚠️  Existed' : 
                          '❌ Failed';
            
            const validation = validations[userType];
            const validationStatus = validation?.loginSuccess ? '✅ Validated' : '❌ Failed';
            
            console.log(`${userType.padEnd(10)}: ${status.padEnd(12)} | Login: ${validationStatus}`);
            
            if (result.created) createdCount++;
            if (validation?.loginSuccess) validatedCount++;
        }
        
        console.log('');
        console.log(`Created: ${createdCount}/${Object.keys(TEST_USERS).length} users`);
        console.log(`Validated: ${validatedCount}/${createdCount} users`);
        console.log(`Security: ${auditResults.passed} passed, ${auditResults.failed} failed`);
        
        if (!CONFIG.DRY_RUN) {
            console.log(`Credentials: ${credentialsFile}`);
        }
        
        // Update environment file with test credentials
        if (!CONFIG.DRY_RUN && createdCount > 0) {
            updateEnvironmentFile(results);
        }
        
        const exitCode = (createdCount === Object.keys(TEST_USERS).length && auditResults.failed === 0) ? 0 : 1;
        
        if (exitCode === 0) {
            console.log('\n' + chalk.bold.green('🎉 All test users created and validated successfully!'));
        } else {
            console.log('\n' + chalk.bold.yellow('⚠️  Some issues occurred during user creation'));
        }
        
        process.exit(exitCode);
        
    } catch (error) {
        log.error(`Test user creation failed: ${error.message}`);
        
        // Attempt cleanup
        try {
            await userManager.cleanupTestUsers();
        } catch (cleanupError) {
            log.error(`Cleanup failed: ${cleanupError.message}`);
        }
        
        process.exit(1);
    }
}

function updateEnvironmentFile(results) {
    const fs = require('fs');
    const envFile = '.env';
    
    try {
        let envContent = '';
        if (fs.existsSync(envFile)) {
            envContent = fs.readFileSync(envFile, 'utf8');
        }
        
        // Update test user credentials
        const updates = {};
        for (const [userType, result] of Object.entries(results)) {
            if (result.created && result.password) {
                const emailKey = `TEST_${userType.toUpperCase()}_EMAIL`;
                const passwordKey = `TEST_${userType.toUpperCase()}_PASSWORD`;
                
                updates[emailKey] = result.email;
                updates[passwordKey] = result.password;
            }
        }
        
        // Apply updates
        for (const [key, value] of Object.entries(updates)) {
            const regex = new RegExp(`^${key}=.*$`, 'm');
            const newLine = `${key}=${value}`;
            
            if (regex.test(envContent)) {
                envContent = envContent.replace(regex, newLine);
            } else {
                envContent += `\n${newLine}`;
            }
        }
        
        fs.writeFileSync(envFile, envContent);
        log.success('Environment file updated with test credentials');
        
    } catch (error) {
        log.warn(`Could not update environment file: ${error.message}`);
    }
}

async function cleanupTestUsers() {
    console.log(chalk.bold.red('\n🧹 Test User Cleanup'));
    console.log(chalk.red('===================='));
    
    const adminAuth = new AdminAuth();
    const userManager = new TestUserManager(adminAuth);
    
    try {
        await adminAuth.login();
        
        // Find and cleanup test users
        const response = await httpClient.get(`${CONFIG.API_BASE}/admin/users?search=@caf-test.local`, {
            headers: adminAuth.getHeaders()
        });
        
        if (response.status === 200 && response.data.users) {
            const testUsers = response.data.users.filter(user => 
                user.email.includes('@caf-test.local') || 
                user.email.includes('test-')
            );
            
            console.log(`Found ${testUsers.length} test users to cleanup`);
            
            for (const user of testUsers) {
                if (CONFIG.DRY_RUN) {
                    log.warn(`DRY RUN: Would delete ${user.email}`);
                    continue;
                }
                
                const deleteResponse = await httpClient.delete(`${CONFIG.API_BASE}/admin/users/${user.id}`, {
                    headers: adminAuth.getHeaders()
                });
                
                if (deleteResponse.status === 200) {
                    log.success(`Deleted test user: ${user.email}`);
                } else {
                    log.error(`Failed to delete ${user.email}: ${deleteResponse.status}`);
                }
            }
            
            log.success('Test user cleanup completed');
        }
        
    } catch (error) {
        log.error(`Cleanup failed: ${error.message}`);
        process.exit(1);
    }
}

// CLI interface
function showHelp() {
    console.log(`
CAF Test User Account Manager

Usage: node test-user-manager.js [command] [options]

Commands:
  create    Create test user accounts (default)
  cleanup   Remove all test user accounts
  help      Show this help message

Environment Variables:
  ADMIN_EMAIL         Admin account email for user creation
  ADMIN_PASSWORD      Admin account password
  API_BASE_URL        API base URL (default: https://api.caf-mexico.org/api/v1)
  DRY_RUN            Set to 'true' for dry run mode

Examples:
  node test-user-manager.js create
  DRY_RUN=true node test-user-manager.js create
  node test-user-manager.js cleanup
`);
}

// Main execution
if (require.main === module) {
    const command = process.argv[2] || 'create';
    
    switch (command) {
        case 'create':
            createTestUsers();
            break;
        case 'cleanup':
            cleanupTestUsers();
            break;
        case 'help':
        case '--help':
        case '-h':
            showHelp();
            break;
        default:
            console.error(`Unknown command: ${command}`);
            showHelp();
            process.exit(1);
    }
}

module.exports = { TestUserManager, AdminAuth, SecurityAuditor };
