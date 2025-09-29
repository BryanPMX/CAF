#!/usr/bin/env node

/**
 * Performance Testing Suite
 * Tests API response times and load handling
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

const API_BASE_URL = 'https://api.caf-mexico.org/api/v1';

const TEST_USERS = {
  admin: { email: 'admin@caf.org', password: 'admin123' },
  staff: { email: 'barmen@caf.org', password: '12345678' }
};

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  validateStatus: () => true
});

async function authenticateUser(user) {
  const response = await apiClient.post('/login', user);
  return response.data.token;
}

async function measurePerformance(role, endpoint, iterations = 5) {
  const token = await authenticateUser(TEST_USERS[role]);
  const config = { headers: { Authorization: `Bearer ${token}` } };
  
  const times = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await apiClient.get(endpoint, config);
    const end = performance.now();
    times.push(end - start);
  }
  
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  
  return { avg, min, max, times };
}

async function runPerformanceTests() {
  console.log('⚡ Performance Testing Suite');
  console.log('=' .repeat(50));
  
  const endpoints = [
    { role: 'admin', endpoint: '/admin/optimized/cases', name: 'Admin Cases' },
    { role: 'admin', endpoint: '/admin/optimized/appointments', name: 'Admin Appointments' },
    { role: 'admin', endpoint: '/admin/optimized/users', name: 'Admin Users' },
    { role: 'staff', endpoint: '/staff/cases', name: 'Staff Cases' },
    { role: 'staff', endpoint: '/staff/appointments', name: 'Staff Appointments' },
    { role: 'staff', endpoint: '/staff/tasks', name: 'Staff Tasks' }
  ];
  
  const results = [];
  
  for (const test of endpoints) {
    console.log(`\n📊 Testing ${test.name}...`);
    const perf = await measurePerformance(test.role, test.endpoint);
    
    results.push({
      ...test,
      ...perf
    });
    
    console.log(`  Average: ${perf.avg.toFixed(2)}ms`);
    console.log(`  Min: ${perf.min.toFixed(2)}ms`);
    console.log(`  Max: ${perf.max.toFixed(2)}ms`);
    
    // Performance thresholds
    if (perf.avg > 5000) {
      console.log(`  ⚠️  SLOW: Average response time > 5s`);
    } else if (perf.avg > 2000) {
      console.log(`  ⚠️  MODERATE: Average response time > 2s`);
    } else {
      console.log(`  ✅ FAST: Average response time < 2s`);
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📈 PERFORMANCE SUMMARY');
  console.log('='.repeat(50));
  
  const slowEndpoints = results.filter(r => r.avg > 2000);
  const fastEndpoints = results.filter(r => r.avg <= 2000);
  
  console.log(`✅ Fast endpoints (< 2s): ${fastEndpoints.length}`);
  console.log(`⚠️  Slow endpoints (> 2s): ${slowEndpoints.length}`);
  
  if (slowEndpoints.length > 0) {
    console.log('\n🐌 Slow Endpoints:');
    slowEndpoints.forEach(endpoint => {
      console.log(`  - ${endpoint.name}: ${endpoint.avg.toFixed(2)}ms`);
    });
  }
  
  const overallAvg = results.reduce((sum, r) => sum + r.avg, 0) / results.length;
  console.log(`\n📊 Overall Average: ${overallAvg.toFixed(2)}ms`);
  
  // Save results
  const fs = require('fs');
  fs.writeFileSync('performance-results.json', JSON.stringify(results, null, 2));
  console.log('\n📄 Results saved to performance-results.json');
}

if (require.main === module) {
  runPerformanceTests().catch(console.error);
}
