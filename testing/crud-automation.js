#!/usr/bin/env node

/**
 * Comprehensive CRUD Testing Automation Suite
 * Tests all CRUD operations across all user roles and sections
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const API_BASE_URL = 'https://api.caf-mexico.org/api/v1';
const TEST_RESULTS_FILE = path.join(__dirname, 'crud-test-results.json');

// Test credentials for different roles
const TEST_USERS = {
  admin: {
    email: 'admin@caf.org',
    password: 'admin123',
    role: 'admin'
  },
  psychologist: {
    email: 'barmen@caf.org',
    password: '12345678',
    role: 'psychologist'
  },
  lawyer: {
    email: 'jperezsosa@caf.org',
    password: '12345678',
    role: 'lawyer'
  },
  client: {
    email: 'bpere151@my.epcc.edu',
    password: 'password123',
    role: 'client'
  }
};

// Test results storage
let testResults = {
  timestamp: new Date().toISOString(),
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0
  },
  roles: {},
  sections: {},
  errors: []
};

// HTTP client with error handling
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  validateStatus: () => true // Don't throw on HTTP error status
});

/**
 * Authentication helper
 */
async function authenticateUser(user) {
  try {
    const response = await apiClient.post('/login', {
      email: user.email,
      password: user.password
    });
    
    if (response.status === 200 && response.data.token) {
      return response.data.token;
    }
    throw new Error(`Authentication failed: ${response.data.error || 'Unknown error'}`);
  } catch (error) {
    throw new Error(`Authentication error for ${user.role}: ${error.message}`);
  }
}

/**
 * Test result tracking
 */
function recordTest(testName, status, details = {}) {
  testResults.summary.total++;
  
  if (status === 'passed') {
    testResults.summary.passed++;
  } else if (status === 'failed') {
    testResults.summary.failed++;
    testResults.errors.push({
      test: testName,
      details: details
    });
  } else {
    testResults.summary.skipped++;
  }
  
  console.log(`[${status.toUpperCase()}] ${testName}`);
  if (details.error) {
    console.log(`  Error: ${details.error}`);
  }
  if (details.response) {
    console.log(`  Response: ${JSON.stringify(details.response).substring(0, 100)}...`);
  }
}

/**
 * Generic CRUD test function
 */
async function testCRUDOperation(role, section, operation, endpoint, data = null, expectedStatus = 200) {
  const testName = `${role.role} ${section} ${operation}`;
  
  try {
    const token = await authenticateUser(role);
    const config = {
      headers: { Authorization: `Bearer ${token}` }
    };
    
    let response;
    switch (operation) {
      case 'CREATE':
        response = await apiClient.post(endpoint, data, config);
        break;
      case 'READ':
        response = await apiClient.get(endpoint, config);
        break;
      case 'UPDATE':
        response = await apiClient.put(endpoint, data, config);
        break;
      case 'PATCH':
        response = await apiClient.patch(endpoint, data, config);
        break;
      case 'DELETE':
        response = await apiClient.delete(endpoint, config);
        break;
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
    
    if (response.status === expectedStatus) {
      recordTest(testName, 'passed', { 
        status: response.status,
        data: response.data 
      });
      return response.data;
    } else {
      recordTest(testName, 'failed', { 
        expected: expectedStatus,
        actual: response.status,
        response: response.data 
      });
      return null;
    }
  } catch (error) {
    recordTest(testName, 'failed', { error: error.message });
    return null;
  }
}

/**
 * Test Cases CRUD
 */
async function testCasesCRUD(role) {
  const section = 'Cases';
  const rolePrefix = role.role === 'admin' ? 'admin' : 'staff';
  
  // Test data
  const testCase = {
    title: `Test Case - ${role.role}`,
    description: `Test case created by ${role.role}`,
    category: 'Familiar',
    clientId: 7,
    officeId: 2,
    priority: 'medium'
  };
  
  const updateData = {
    title: `Updated Test Case - ${role.role}`,
    description: `Updated by ${role.role}`
  };
  
  // CREATE
  const createResult = await testCRUDOperation(
    role, section, 'CREATE', 
    `/${rolePrefix}/cases`, 
    testCase
  );
  
  if (createResult && createResult.data && createResult.data.id) {
    const caseId = createResult.data.id;
    
    // READ
    await testCRUDOperation(
      role, section, 'READ', 
      `/${rolePrefix}/cases/${caseId}`
    );
    
    // UPDATE
    await testCRUDOperation(
      role, section, 'UPDATE', 
      `/${rolePrefix}/cases/${caseId}`, 
      updateData
    );
    
    // DELETE
    await testCRUDOperation(
      role, section, 'DELETE', 
      `/${rolePrefix}/cases/${caseId}`
    );
  }
  
  // LIST
  await testCRUDOperation(
    role, section, 'READ', 
    `/${rolePrefix}/optimized/cases`
  );
}

/**
 * Test Appointments CRUD
 */
async function testAppointmentsCRUD(role) {
  const section = 'Appointments';
  const rolePrefix = role.role === 'admin' ? 'admin' : 'staff';
  
  // Test data
  const testAppointment = {
    title: `Test Appointment - ${role.role}`,
    description: `Test appointment created by ${role.role}`,
    startTime: '2025-10-05T10:00:00Z',
    endTime: '2025-10-05T11:00:00Z',
    caseId: 1,
    staffId: role.role === 'admin' ? 1 : 6,
    officeId: 2,
    status: 'scheduled',
    category: 'Familiar',
    department: 'Familiar'
  };
  
  const updateData = {
    title: `Updated Test Appointment - ${role.role}`,
    status: 'completed'
  };
  
  // CREATE
  const createResult = await testCRUDOperation(
    role, section, 'CREATE', 
    `/${rolePrefix}/appointments`, 
    testAppointment
  );
  
  if (createResult && createResult.id) {
    const appointmentId = createResult.id;
    
    // READ
    await testCRUDOperation(
      role, section, 'READ', 
      `/${rolePrefix}/appointments/${appointmentId}`
    );
    
    // UPDATE
    await testCRUDOperation(
      role, section, 'PATCH', 
      `/${rolePrefix}/appointments/${appointmentId}`, 
      updateData
    );
    
    // DELETE
    await testCRUDOperation(
      role, section, 'DELETE', 
      `/${rolePrefix}/appointments/${appointmentId}`
    );
  }
  
  // LIST
  await testCRUDOperation(
    role, section, 'READ', 
    `/${rolePrefix}/optimized/appointments`
  );
}

/**
 * Test Tasks CRUD
 */
async function testTasksCRUD(role) {
  const section = 'Tasks';
  const rolePrefix = role.role === 'admin' ? 'admin' : 'staff';
  
  // Test data
  const testTask = {
    title: `Test Task - ${role.role}`,
    description: `Test task created by ${role.role}`,
    caseId: 1,
    assignedToId: role.role === 'admin' ? 1 : 6,
    priority: 'medium',
    dueDate: '2025-10-20T00:00:00Z'
  };
  
  const updateData = {
    title: `Updated Test Task - ${role.role}`,
    status: 'completed'
  };
  
  // CREATE
  const createResult = await testCRUDOperation(
    role, section, 'CREATE', 
    `/${rolePrefix}/cases/1/tasks`, 
    testTask
  );
  
  if (createResult && createResult.id) {
    const taskId = createResult.id;
    
    // READ
    await testCRUDOperation(
      role, section, 'READ', 
      `/${rolePrefix}/tasks/${taskId}`
    );
    
    // UPDATE
    await testCRUDOperation(
      role, section, 'PATCH', 
      `/${rolePrefix}/tasks/${taskId}`, 
      updateData
    );
    
    // DELETE
    await testCRUDOperation(
      role, section, 'DELETE', 
      `/${rolePrefix}/tasks/${taskId}`
    );
  }
  
  // LIST
  await testCRUDOperation(
    role, section, 'READ', 
    `/${rolePrefix}/tasks`
  );
  
  // MY TASKS
  await testCRUDOperation(
    role, section, 'READ', 
    `/${rolePrefix}/tasks/my`
  );
}

/**
 * Test Users CRUD (Admin only)
 */
async function testUsersCRUD(role) {
  if (role.role !== 'admin') {
    recordTest(`${role.role} Users CRUD`, 'skipped', { reason: 'Admin only' });
    return;
  }
  
  const section = 'Users';
  
  // Test data
  const testUser = {
    firstName: 'Test',
    lastName: `User - ${role.role}`,
    email: `testuser-${Date.now()}@example.com`,
    role: 'lawyer',
    officeId: 2,
    password: 'password123'
  };
  
  const updateData = {
    firstName: 'Updated',
    lastName: `Test User - ${role.role}`,
    email: testUser.email,
    role: 'lawyer',
    officeId: 2
  };
  
  // CREATE
  const createResult = await testCRUDOperation(
    role, section, 'CREATE', 
    '/admin/users', 
    testUser
  );
  
  if (createResult && createResult.id) {
    const userId = createResult.id;
    
    // READ
    await testCRUDOperation(
      role, section, 'READ', 
      `/admin/users/${userId}`
    );
    
    // UPDATE
    await testCRUDOperation(
      role, section, 'PATCH', 
      `/admin/users/${userId}`, 
      updateData
    );
    
    // DELETE
    await testCRUDOperation(
      role, section, 'DELETE', 
      `/admin/users/${userId}`
    );
  }
  
  // LIST
  await testCRUDOperation(
    role, section, 'READ', 
    '/admin/optimized/users'
  );
}

/**
 * Test Offices CRUD (Admin only)
 */
async function testOfficesCRUD(role) {
  if (role.role !== 'admin') {
    recordTest(`${role.role} Offices CRUD`, 'skipped', { reason: 'Admin only' });
    return;
  }
  
  const section = 'Offices';
  
  // Test data
  const testOffice = {
    name: `Test Office - ${role.role}`,
    address: `123 Test Street - ${role.role}`
  };
  
  const updateData = {
    name: `Updated Test Office - ${role.role}`,
    address: `456 Updated Street - ${role.role}`
  };
  
  // CREATE
  const createResult = await testCRUDOperation(
    role, section, 'CREATE', 
    '/admin/offices', 
    testOffice
  );
  
  if (createResult && createResult.id) {
    const officeId = createResult.id;
    
    // READ
    await testCRUDOperation(
      role, section, 'READ', 
      `/admin/offices/${officeId}`
    );
    
    // UPDATE
    await testCRUDOperation(
      role, section, 'PATCH', 
      `/admin/offices/${officeId}`, 
      updateData
    );
    
    // DELETE
    await testCRUDOperation(
      role, section, 'DELETE', 
      `/admin/offices/${officeId}`
    );
  }
  
  // LIST
  await testCRUDOperation(
    role, section, 'READ', 
    '/admin/offices'
  );
}

/**
 * Test Archive functionality
 */
async function testArchiveFunctionality(role) {
  if (role.role !== 'admin') {
    recordTest(`${role.role} Archive`, 'skipped', { reason: 'Admin only' });
    return;
  }
  
  const section = 'Archive';
  
  // Test archived cases
  await testCRUDOperation(
    role, section, 'READ', 
    '/admin/records/cases'
  );
  
  // Test archived appointments
  await testCRUDOperation(
    role, section, 'READ', 
    '/admin/records/appointments'
  );
  
  // Test archive stats
  await testCRUDOperation(
    role, section, 'READ', 
    '/admin/records/stats'
  );
}

/**
 * Test role-specific endpoints
 */
async function testRoleSpecificEndpoints(role) {
  const section = 'Role Specific';
  
  if (role.role === 'staff' || role.role === 'psychologist' || role.role === 'lawyer') {
    // Test staff-specific endpoints
    await testCRUDOperation(
      role, section, 'READ', 
      '/staff/users'
    );
    
    await testCRUDOperation(
      role, section, 'READ', 
      '/staff/appointments/my'
    );
    
    await testCRUDOperation(
      role, section, 'READ', 
      '/staff/tasks/my'
    );
  }
  
  if (role.role === 'client') {
    // Test client-specific endpoints
    await testCRUDOperation(
      role, section, 'READ', 
      '/appointments'
    );
    
    await testCRUDOperation(
      role, section, 'READ', 
      '/offices'
    );
  }
}

/**
 * Main test execution
 */
async function runCRUDTests() {
  console.log('🚀 Starting Comprehensive CRUD Testing Suite');
  console.log('=' .repeat(60));
  
  for (const [roleName, role] of Object.entries(TEST_USERS)) {
    console.log(`\n📋 Testing ${roleName.toUpperCase()} role (${role.email})`);
    console.log('-'.repeat(40));
    
    testResults.roles[roleName] = {
      email: role.email,
      tests: []
    };
    
    try {
      // Test all sections
      await testCasesCRUD(role);
      await testAppointmentsCRUD(role);
      await testTasksCRUD(role);
      await testUsersCRUD(role);
      await testOfficesCRUD(role);
      await testArchiveFunctionality(role);
      await testRoleSpecificEndpoints(role);
      
    } catch (error) {
      console.error(`❌ Error testing ${roleName}:`, error.message);
      testResults.errors.push({
        role: roleName,
        error: error.message
      });
    }
  }
  
  // Generate report
  generateTestReport();
}

/**
 * Generate detailed test report
 */
function generateTestReport() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  
  const { total, passed, failed, skipped } = testResults.summary;
  const successRate = total > 0 ? ((passed / total) * 100).toFixed(1) : 0;
  
  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`📈 Success Rate: ${successRate}%`);
  
  if (testResults.errors.length > 0) {
    console.log('\n❌ ERRORS:');
    testResults.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error.test || error.role}: ${error.error || error.details?.error}`);
    });
  }
  
  // Save results to file
  fs.writeFileSync(TEST_RESULTS_FILE, JSON.stringify(testResults, null, 2));
  console.log(`\n📄 Detailed results saved to: ${TEST_RESULTS_FILE}`);
  
  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run the tests
if (require.main === module) {
  runCRUDTests().catch(error => {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = {
  runCRUDTests,
  testCRUDOperation,
  TEST_USERS
};
