#!/usr/bin/env node

/**
 * Quick CRUD Test Suite
 * Fast validation of core CRUD operations
 */

const axios = require('axios');

const API_BASE_URL = 'https://api.caf-mexico.org/api/v1';

// Quick test credentials
const QUICK_TEST_USERS = {
  admin: { email: 'admin@caf.org', password: 'admin123' },
  staff: { email: 'barmen@caf.org', password: '12345678' }
};

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  validateStatus: () => true,
  headers: {
    'User-Agent': 'CAF-Testing-Suite/1.0'
  }
});

async function quickAuth(user) {
  try {
    const response = await apiClient.post('/login', user);
    if (response.status === 200 && response.data.token) {
      return response.data.token;
    }
    throw new Error(`Auth failed: ${response.data.error || 'Unknown error'}`);
  } catch (error) {
    if (error.response && error.response.status === 429) {
      console.log(`  ⏳ Rate limited, waiting 10 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 10000));
      return quickAuth(user); // Retry once
    }
    throw error;
  }
}

async function quickTest(role, endpoint, method = 'GET', data = null) {
  try {
    const token = await quickAuth(QUICK_TEST_USERS[role]);
    const config = { headers: { Authorization: `Bearer ${token}` } };
    
    let response;
    switch (method) {
      case 'POST': response = await apiClient.post(endpoint, data, config); break;
      case 'PUT': response = await apiClient.put(endpoint, data, config); break;
      case 'PATCH': response = await apiClient.patch(endpoint, data, config); break;
      case 'DELETE': response = await apiClient.delete(endpoint, config); break;
      default: response = await apiClient.get(endpoint, config);
    }
    
    const status = response.status >= 200 && response.status < 300 ? '✅' : '❌';
    console.log(`${status} ${role.toUpperCase()} ${method} ${endpoint} - ${response.status}`);
    
    return response.status < 300;
  } catch (error) {
    console.log(`❌ ${role.toUpperCase()} ${method} ${endpoint} - ERROR: ${error.message}`);
    return false;
  }
}

async function runQuickTests() {
  console.log('🚀 Quick CRUD Validation');
  console.log('=' .repeat(40));
  
  let passed = 0;
  let total = 0;
  
  // Admin tests
  console.log('\n📋 Admin Tests:');
  total += 6;
  if (await quickTest('admin', '/admin/optimized/cases')) passed++;
  if (await quickTest('admin', '/admin/optimized/appointments')) passed++;
  if (await quickTest('admin', '/admin/optimized/users')) passed++;
  if (await quickTest('admin', '/admin/offices')) passed++;
  if (await quickTest('admin', '/admin/records/stats')) passed++;
  if (await quickTest('admin', '/admin/reports/summary-report?startDate=2025-01-01&endDate=2025-12-31')) passed++;
  
  // Staff tests
  console.log('\n📋 Staff Tests:');
  total += 6;
  if (await quickTest('staff', '/staff/cases')) passed++;
  if (await quickTest('staff', '/staff/appointments')) passed++;
  if (await quickTest('staff', '/staff/tasks')) passed++;
  if (await quickTest('staff', '/staff/users')) passed++;
  if (await quickTest('staff', '/staff/appointments/my')) passed++;
  if (await quickTest('staff', '/staff/tasks/my')) passed++;
  
  // Test creation (expect some to fail due to permissions)
  console.log('\n📋 Creation Tests:');
  total += 4;
  if (await quickTest('admin', '/admin/cases', 'POST', {
    title: 'Quick Test Case',
    description: 'Test',
    category: 'Familiar',
    clientId: 7,
    officeId: 2
  })) passed++;
  
  if (await quickTest('admin', '/admin/appointments', 'POST', {
    title: 'Quick Test Appointment',
    startTime: '2025-10-05T10:00:00Z',
    endTime: '2025-10-05T11:00:00Z',
    caseId: 1,
    staffId: 1,
    officeId: 2,
    status: 'scheduled',
    category: 'Familiar',
    department: 'Familiar'
  })) passed++;
  
  if (await quickTest('staff', '/staff/cases/1/tasks', 'POST', {
    title: 'Quick Test Task',
    description: 'Test',
    caseId: 1,
    assignedToId: 6,
    priority: 'medium'
  })) passed++;
  
  if (await quickTest('staff', '/staff/appointments', 'POST', {
    title: 'Quick Test Appointment',
    startTime: '2025-10-05T10:00:00Z',
    endTime: '2025-10-05T11:00:00Z',
    caseId: 1,
    staffId: 6,
    officeId: 2,
    status: 'scheduled',
    category: 'Familiar',
    department: 'Familiar'
  })) passed++;
  
  console.log('\n' + '='.repeat(40));
  console.log(`📊 Results: ${passed}/${total} tests passed (${((passed/total)*100).toFixed(1)}%)`);
  
  process.exit(passed === total ? 0 : 1);
}

if (require.main === module) {
  runQuickTests().catch(console.error);
}
