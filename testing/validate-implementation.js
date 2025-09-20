#!/usr/bin/env node

/**
 * CAF System - Implementation Validation Script
 * 
 * Validates that all minor issues have been fixed and test accounts are working
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

// Validation results
const results = {
    passed: 0,
    failed: 0,
    issues: []
};

const log = {
    info: (msg) => console.log(chalk.blue('ℹ️ '), msg),
    success: (msg) => console.log(chalk.green('✅'), msg),
    error: (msg) => console.log(chalk.red('❌'), msg),
    warn: (msg) => console.log(chalk.yellow('⚠️ '), msg),
    test: (msg) => console.log(chalk.cyan('🧪'), msg)
};

function addResult(testName, passed, message = '') {
    if (passed) {
        results.passed++;
        log.success(`${testName} - PASSED ${message}`);
    } else {
        results.failed++;
        results.issues.push(`${testName}: ${message}`);
        log.error(`${testName} - FAILED ${message}`);
    }
}

function runCommand(command, description) {
    try {
        log.info(`Testing: ${description}`);
        const output = execSync(command, { encoding: 'utf8', timeout: 30000 });
        return { success: true, output };
    } catch (error) {
        return { success: false, error: error.message, output: error.stdout || '' };
    }
}

async function validateImplementation() {
    console.log(chalk.bold.blue('\n🔍 CAF System Implementation Validation'));
    console.log(chalk.blue('========================================='));
    console.log('Validating that all minor issues have been fixed...\n');
    
    // Test 1: Health Monitor Script Fix
    log.test('Test 1: Health Monitor Script Syntax');
    const healthTest = runCommand('./health-monitor.sh quick', 'Health monitor quick check');
    addResult('Health Monitor Script', healthTest.success, 
        healthTest.success ? '(Fixed bash syntax)' : healthTest.error);
    
    // Test 2: WebSocket Endpoint Investigation
    log.test('Test 2: WebSocket Endpoint Functionality');
    const wsTest = runCommand('curl -s -H "Upgrade: websocket" https://api.caf-mexico.org/ws', 'WebSocket endpoint check');
    const wsWorking = wsTest.success && wsTest.output.includes('missing token');
    addResult('WebSocket Endpoint', wsWorking, 
        wsWorking ? '(Returns proper auth error)' : 'Unexpected response');
    
    // Test 3: Test User Manager Validation
    log.test('Test 3: Test User Manager Security');
    const userMgrTest = runCommand('DRY_RUN=true node test-user-manager.js create', 'Test user manager dry run');
    const userMgrSecure = userMgrTest.success === false && userMgrTest.output.includes('Admin credentials not configured');
    addResult('Test User Manager Security', userMgrSecure, 
        userMgrSecure ? '(Properly validates admin credentials)' : 'Security validation failed');
    
    // Test 4: File Structure Validation
    log.test('Test 4: Required Files Present');
    const requiredFiles = [
        'health-monitor.sh',
        'test-user-manager.js',
        'websocket-tester.js',
        'smoke-tests.js',
        'integration-tests.js',
        'package.json',
        'SECURE_TESTING_GUIDE.md'
    ];
    
    let filesPresent = 0;
    requiredFiles.forEach(file => {
        if (fs.existsSync(file)) {
            filesPresent++;
        } else {
            results.issues.push(`Missing file: ${file}`);
        }
    });
    
    addResult('Required Files', filesPresent === requiredFiles.length, 
        `(${filesPresent}/${requiredFiles.length} files present)`);
    
    // Test 5: Script Permissions
    log.test('Test 5: Script Executable Permissions');
    const executableFiles = ['health-monitor.sh', 'test-user-manager.js', 'websocket-tester.js'];
    let executableCount = 0;
    
    executableFiles.forEach(file => {
        try {
            const stats = fs.statSync(file);
            if (stats.mode & parseInt('111', 8)) { // Check if executable
                executableCount++;
            }
        } catch (error) {
            // File doesn't exist or can't check permissions
        }
    });
    
    addResult('Script Permissions', executableCount === executableFiles.length,
        `(${executableCount}/${executableFiles.length} scripts executable)`);
    
    // Test 6: Package Dependencies
    log.test('Test 6: NPM Dependencies');
    const depsTest = runCommand('npm list --depth=0', 'NPM dependency check');
    const hasWS = depsTest.output.includes('ws@');
    const hasAxios = depsTest.output.includes('axios@');
    const hasChalk = depsTest.output.includes('chalk@');
    
    addResult('NPM Dependencies', hasWS && hasAxios && hasChalk,
        hasWS && hasAxios && hasChalk ? '(All required deps installed)' : 'Missing dependencies');
    
    // Test 7: Environment Configuration
    log.test('Test 7: Environment Configuration');
    const envExists = fs.existsSync('.env');
    let envValid = false;
    
    if (envExists) {
        const envContent = fs.readFileSync('.env', 'utf8');
        envValid = envContent.includes('API_BASE_URL') && envContent.includes('TEST_USER_EMAIL');
    }
    
    addResult('Environment Config', envValid,
        envValid ? '(Environment file properly configured)' : 'Environment file missing or incomplete');
    
    // Test 8: WebSocket Tester Functionality
    log.test('Test 8: WebSocket Tester Help');
    const wsHelpTest = runCommand('node websocket-tester.js help', 'WebSocket tester help');
    addResult('WebSocket Tester', wsHelpTest.success && wsHelpTest.output.includes('CAF WebSocket'),
        wsHelpTest.success ? '(Help system working)' : 'WebSocket tester not functional');
    
    // Test 9: Integration Test Structure
    log.test('Test 9: Integration Test Dry Run');
    const integrationTest = runCommand('DRY_RUN=true node integration-tests.js', 'Integration test dry run');
    const integrationWorking = integrationTest.output.includes('DRY RUN mode');
    addResult('Integration Tests', integrationWorking,
        integrationWorking ? '(Dry run mode working)' : 'Integration test structure issue');
    
    // Test 10: Security Features
    log.test('Test 10: Security Features');
    let securityScore = 0;
    
    // Check for secure credential handling
    if (fs.existsSync('test-user-manager.js')) {
        const userMgrContent = fs.readFileSync('test-user-manager.js', 'utf8');
        if (userMgrContent.includes('generateSecurePassword')) securityScore++;
        if (userMgrContent.includes('SecurityAuditor')) securityScore++;
        if (userMgrContent.includes('@caf-test.local')) securityScore++;
    }
    
    addResult('Security Features', securityScore >= 3,
        `(${securityScore}/3 security features implemented)`);
    
    // Summary
    console.log('\n' + chalk.bold.blue('📊 Validation Summary'));
    console.log(chalk.blue('====================='));
    console.log(`Tests Run: ${results.passed + results.failed}`);
    console.log(chalk.green(`Passed: ${results.passed}`));
    console.log(chalk.red(`Failed: ${results.failed}`));
    
    if (results.issues.length > 0) {
        console.log('\n' + chalk.bold.red('Issues Found:'));
        results.issues.forEach(issue => {
            console.log(chalk.red(`  • ${issue}`));
        });
    }
    
    // Overall status
    const successRate = (results.passed / (results.passed + results.failed)) * 100;
    console.log(`\nSuccess Rate: ${successRate.toFixed(1)}%`);
    
    if (successRate >= 90) {
        console.log('\n' + chalk.bold.green('🎉 Implementation validation PASSED!'));
        console.log(chalk.green('All minor issues have been successfully addressed.'));
    } else if (successRate >= 70) {
        console.log('\n' + chalk.bold.yellow('⚠️  Implementation validation PARTIAL'));
        console.log(chalk.yellow('Most issues addressed, some minor items remain.'));
    } else {
        console.log('\n' + chalk.bold.red('❌ Implementation validation FAILED'));
        console.log(chalk.red('Significant issues remain to be addressed.'));
    }
    
    // Next steps
    console.log('\n' + chalk.bold.blue('📋 Next Steps'));
    console.log(chalk.blue('=============='));
    
    if (successRate >= 90) {
        console.log('✅ Ready for test user creation with admin credentials');
        console.log('✅ Ready for full integration testing');
        console.log('✅ Ready for WebSocket functionality testing');
        console.log('\nTo proceed with test user creation:');
        console.log(chalk.cyan('export ADMIN_EMAIL="your-admin@caf-mexico.org"'));
        console.log(chalk.cyan('export ADMIN_PASSWORD="your-secure-password"'));
        console.log(chalk.cyan('node test-user-manager.js create'));
    } else {
        console.log('⚠️  Address the issues listed above before proceeding');
        console.log('⚠️  Re-run this validation script after fixes');
    }
    
    process.exit(results.failed > 0 ? 1 : 0);
}

// Run validation
validateImplementation().catch(error => {
    log.error(`Validation script error: ${error.message}`);
    process.exit(1);
});
