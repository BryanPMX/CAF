#!/usr/bin/env node

/**
 * Demo CRUD Test Suite
 * Demonstrates the automated testing capabilities
 */

const axios = require('axios');
const config = require('./config');

const API_BASE_URL = config.API_BASE_URL;

// Demo with working credentials from config
const DEMO_USERS = {
  admin: {
    email: config.ADMIN_TEST_EMAIL,
    password: config.ADMIN_TEST_PASSWORD,
    token: null // Token will be obtained via login
  },
  test: {
    email: config.TEST_USER_EMAIL,
    password: config.TEST_USER_PASSWORD,
    token: null // Token will be obtained via login
  }
};

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  validateStatus: () => true
});

// Login function to obtain JWT tokens
async function loginUser(user) {
  try {
    const response = await apiClient.post('/login', {
      email: user.email,
      password: user.password
    });

    if (response.status === 200 && response.data.token) {
      user.token = response.data.token;
      console.log(`✅ Logged in ${user.email} successfully`);
      return true;
    } else {
      console.log(`❌ Failed to login ${user.email}: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Login error for ${user.email}: ${error.message}`);
    return false;
  }
}

async function demoTest(role, endpoint, method = 'GET', data = null) {
  try {
    const user = DEMO_USERS[role];

    // Login if not already authenticated
    if (!user.token) {
      const loggedIn = await loginUser(user);
      if (!loggedIn) {
        return {
          success: false,
          status: 401,
          data: { error: 'Authentication failed' },
          error: 'Failed to authenticate user'
        };
      }
    }

    const config = {
      headers: {
        Authorization: `Bearer ${user.token}`,
        'User-Agent': 'CAF-Demo-Test/1.0'
      }
    };
    
    let response;
    switch (method) {
      case 'POST': response = await apiClient.post(endpoint, data, config); break;
      case 'PUT': response = await apiClient.put(endpoint, data, config); break;
      case 'PATCH': response = await apiClient.patch(endpoint, data, config); break;
      case 'DELETE': response = await apiClient.delete(endpoint, config); break;
      default: response = await apiClient.get(endpoint, config);
    }
    
    const status = response.status >= 200 && response.status < 300 ? '✅' : '❌';
    const dataPreview = response.data ? JSON.stringify(response.data).substring(0, 100) : 'No data';
    console.log(`${status} ${role.toUpperCase()} ${method} ${endpoint}`);
    console.log(`   Status: ${response.status} | Data: ${dataPreview}...`);
    
    return {
      success: response.status >= 200 && response.status < 300,
      status: response.status,
      data: response.data
    };
  } catch (error) {
    console.log(`❌ ${role.toUpperCase()} ${method} ${endpoint}`);
    console.log(`   ERROR: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runDemoTests() {
  console.log('🎯 CAF CRUD Testing Automation Demo');
  console.log('=' .repeat(50));
  console.log('This demo shows automated testing across different roles and sections.\n');
  
  let passed = 0;
  let total = 0;
  
  // Admin Tests
  console.log('👑 ADMIN ROLE TESTS');
  console.log('-'.repeat(30));
  
  total += 4;
  if ((await demoTest('admin', '/admin/optimized/cases')).success) passed++;
  if ((await demoTest('admin', '/admin/optimized/appointments')).success) passed++;
  if ((await demoTest('admin', '/admin/optimized/users')).success) passed++;
  if ((await demoTest('admin', '/admin/offices')).success) passed++;
  
  // Staff Tests
  console.log('\n👥 STAFF ROLE TESTS');
  console.log('-'.repeat(30));
  
  total += 4;
  if ((await demoTest('staff', '/staff/cases')).success) passed++;
  if ((await demoTest('staff', '/staff/appointments')).success) passed++;
  if ((await demoTest('staff', '/staff/tasks')).success) passed++;
  if ((await demoTest('staff', '/staff/users')).success) passed++;
  
  // CRUD Operations Demo
  console.log('\n🔄 CRUD OPERATIONS DEMO');
  console.log('-'.repeat(30));
  
  // Test case creation
  total += 1;
  const createResult = await demoTest('admin', '/admin/cases', 'POST', {
    title: 'Automated Test Case',
    description: 'Created by automated testing suite',
    category: 'Familiar',
    clientId: 7,
    officeId: 2,
    priority: 'medium'
  });
  
  if (createResult.success) {
    passed++;
    const caseId = createResult.data.id;
    
    // Test case update
    total += 1;
    if ((await demoTest('admin', `/admin/cases/${caseId}`, 'PUT', {
      title: 'Updated Automated Test Case',
      description: 'Updated by automated testing suite'
    })).success) passed++;
    
    // Test case deletion
    total += 1;
    if ((await demoTest('admin', `/admin/cases/${caseId}`, 'DELETE')).success) passed++;
  } else {
    total += 2; // Count the update and delete tests as failed
  }
  
  // Permission Testing
  console.log('\n🔒 PERMISSION TESTING');
  console.log('-'.repeat(30));
  
  // Test staff trying to access admin-only endpoint
  total += 1;
  const staffAdminTest = await demoTest('staff', '/admin/optimized/users');
  if (!staffAdminTest.success && staffAdminTest.status === 403) {
    passed++; // Expected to fail with 403
    console.log('   ✅ Staff correctly denied access to admin endpoint');
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 DEMO RESULTS SUMMARY');
  console.log('='.repeat(50));
  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${total - passed}`);
  console.log(`📈 Success Rate: ${((passed/total)*100).toFixed(1)}%`);
  
  console.log('\n🎯 KEY FEATURES DEMONSTRATED:');
  console.log('• Role-based access control testing');
  console.log('• Full CRUD operation validation');
  console.log('• Permission boundary testing');
  console.log('• Automated error handling');
  console.log('• Real-time test reporting');
  
  console.log('\n🚀 NEXT STEPS:');
  console.log('• Run full test suite: npm run test:crud');
  console.log('• Performance testing: npm run test:performance');
  console.log('• CI/CD integration ready');
  console.log('• Customizable for any API endpoint');
  
  process.exit(passed === total ? 0 : 1);
}

if (require.main === module) {
  runDemoTests().catch(console.error);
}
