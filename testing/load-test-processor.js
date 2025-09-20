/**
 * Artillery.js processor for CAF load testing
 * Handles authentication and test data generation
 */

const axios = require('axios');

// Global variables
let authTokenCache = {};
const API_BASE = process.env.API_BASE_URL || 'https://api.caf-mexico.org/api/v1';

/**
 * Authenticate user and cache token
 */
async function authenticate(context, events, done) {
    const userId = context.vars.testEmail || 'test@caf-mexico.org';
    
    // Use cached token if available and not expired
    if (authTokenCache[userId] && authTokenCache[userId].expires > Date.now()) {
        context.vars.authToken = authTokenCache[userId].token;
        return done();
    }
    
    try {
        const response = await axios.post(`${API_BASE}/login`, {
            email: userId,
            password: context.vars.testPassword || 'TestPassword123'
        }, {
            timeout: 5000
        });
        
        if (response.status === 200 && response.data.token) {
            const token = response.data.token;
            
            // Cache token for 20 minutes
            authTokenCache[userId] = {
                token: token,
                expires: Date.now() + (20 * 60 * 1000)
            };
            
            context.vars.authToken = token;
        } else {
            console.error('Authentication failed:', response.status, response.data);
        }
    } catch (error) {
        console.error('Authentication error:', error.message);
    }
    
    done();
}

/**
 * Generate random test data
 */
function generateTestData(context, events, done) {
    const randomId = Math.floor(Math.random() * 1000000);
    
    context.vars.randomCaseId = randomId;
    context.vars.randomUserId = `test_user_${randomId}`;
    context.vars.randomEmail = `test_${randomId}@example.com`;
    context.vars.timestamp = new Date().toISOString();
    
    done();
}

/**
 * Log response times for analysis
 */
function logResponseTime(requestParams, response, context, events, done) {
    const responseTime = response.timings?.phases?.total || 0;
    const endpoint = requestParams.url || 'unknown';
    
    // Log slow responses
    if (responseTime > 1000) {
        console.warn(`Slow response: ${endpoint} - ${responseTime}ms`);
    }
    
    // Emit custom metrics
    events.emit('customStat', 'response_time', responseTime);
    events.emit('customStat', 'endpoint_' + endpoint.replace(/[^a-zA-Z0-9]/g, '_'), responseTime);
    
    done();
}

/**
 * Validate response structure
 */
function validateResponse(requestParams, response, context, events, done) {
    const endpoint = requestParams.url || 'unknown';
    
    // Check for expected response structure based on endpoint
    if (endpoint.includes('/health')) {
        if (!response.body || !response.body.includes('status')) {
            events.emit('customStat', 'validation_error', 1);
            console.error(`Health check validation failed for ${endpoint}`);
        }
    } else if (endpoint.includes('/cases')) {
        try {
            const data = JSON.parse(response.body);
            if (!data.cases && !Array.isArray(data)) {
                events.emit('customStat', 'validation_error', 1);
                console.error(`Cases validation failed for ${endpoint}`);
            }
        } catch (e) {
            events.emit('customStat', 'validation_error', 1);
            console.error(`JSON parsing failed for ${endpoint}`);
        }
    }
    
    done();
}

/**
 * Handle authentication errors
 */
function handleAuthError(requestParams, response, context, events, done) {
    if (response.statusCode === 401) {
        console.warn('Authentication error detected, clearing token cache');
        authTokenCache = {}; // Clear all cached tokens
        events.emit('customStat', 'auth_error', 1);
    }
    
    done();
}

/**
 * Setup function called before test starts
 */
function setup(context, events, done) {
    console.log('🚀 Starting CAF load test...');
    console.log(`Target: ${context.vars.$target}`);
    console.log(`Test user: ${context.vars.testEmail}`);
    
    // Clear any existing token cache
    authTokenCache = {};
    
    done();
}

/**
 * Cleanup function called after test completes
 */
function cleanup(context, events, done) {
    console.log('🏁 CAF load test completed');
    console.log(`Cached tokens: ${Object.keys(authTokenCache).length}`);
    
    // Clear token cache
    authTokenCache = {};
    
    done();
}

module.exports = {
    authenticate,
    generateTestData,
    logResponseTime,
    validateResponse,
    handleAuthError,
    setup,
    cleanup
};
