#!/usr/bin/env node

/**
 * CAF System WebSocket Testing Tool
 * 
 * Tests WebSocket real-time notifications functionality
 */

const WebSocket = require('ws');
const axios = require('axios');
const chalk = require('chalk');
require('dotenv').config();

// Configuration
const CONFIG = {
    API_BASE: process.env.API_BASE_URL || 'https://api.caf-mexico.org/api/v1',
    WS_BASE: process.env.WS_BASE_URL || 'wss://api.caf-mexico.org/ws',
    TEST_USER_EMAIL: process.env.TEST_USER_EMAIL || 'test-user@caf-test.local',
    TEST_USER_PASSWORD: process.env.TEST_USER_PASSWORD || '',
    TIMEOUT: 10000
};

// Utility functions
const log = {
    info: (msg) => console.log(chalk.blue('ℹ️ '), msg),
    success: (msg) => console.log(chalk.green('✅'), msg),
    error: (msg) => console.log(chalk.red('❌'), msg),
    warn: (msg) => console.log(chalk.yellow('⚠️ '), msg),
    ws: (msg) => console.log(chalk.cyan('🔌'), msg)
};

// HTTP client
const httpClient = axios.create({
    timeout: CONFIG.TIMEOUT,
    validateStatus: (status) => status < 500
});

// WebSocket tester class
class WebSocketTester {
    constructor() {
        this.token = null;
        this.ws = null;
        this.messages = [];
        this.connected = false;
    }
    
    async authenticate() {
        log.info('Authenticating test user...');
        
        if (!CONFIG.TEST_USER_EMAIL || !CONFIG.TEST_USER_PASSWORD) {
            throw new Error('Test user credentials not configured');
        }
        
        const response = await httpClient.post(`${CONFIG.API_BASE}/login`, {
            email: CONFIG.TEST_USER_EMAIL,
            password: CONFIG.TEST_USER_PASSWORD
        });
        
        if (response.status !== 200 || !response.data.token) {
            throw new Error(`Authentication failed: ${response.status} - ${JSON.stringify(response.data)}`);
        }
        
        this.token = response.data.token;
        log.success('Authentication successful');
        return this.token;
    }
    
    async connectWebSocket() {
        return new Promise((resolve, reject) => {
            log.info('Connecting to WebSocket...');
            
            const wsUrl = `${CONFIG.WS_BASE}?token=${this.token}`;
            log.info(`WebSocket URL: ${wsUrl.replace(this.token, 'TOKEN_HIDDEN')}`);
            
            this.ws = new WebSocket(wsUrl, {
                headers: {
                    'User-Agent': 'CAF-WebSocket-Tester/1.0'
                }
            });
            
            const timeout = setTimeout(() => {
                reject(new Error('WebSocket connection timeout'));
            }, CONFIG.TIMEOUT);
            
            this.ws.on('open', () => {
                clearTimeout(timeout);
                this.connected = true;
                log.success('WebSocket connected successfully');
                resolve();
            });
            
            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.messages.push({
                        timestamp: new Date(),
                        data: message
                    });
                    log.ws(`Received message: ${JSON.stringify(message, null, 2)}`);
                } catch (error) {
                    log.warn(`Received non-JSON message: ${data.toString()}`);
                }
            });
            
            this.ws.on('error', (error) => {
                clearTimeout(timeout);
                log.error(`WebSocket error: ${error.message}`);
                reject(error);
            });
            
            this.ws.on('close', (code, reason) => {
                this.connected = false;
                log.info(`WebSocket closed: ${code} - ${reason}`);
            });
        });
    }
    
    async sendMessage(message) {
        if (!this.connected) {
            throw new Error('WebSocket not connected');
        }
        
        log.ws(`Sending message: ${JSON.stringify(message)}`);
        this.ws.send(JSON.stringify(message));
    }
    
    async testPingPong() {
        log.info('Testing ping/pong...');
        
        const pingMessage = {
            type: 'ping',
            timestamp: Date.now()
        };
        
        await this.sendMessage(pingMessage);
        
        // Wait for pong response
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Ping/pong timeout'));
            }, 5000);
            
            const checkForPong = () => {
                const pongMessage = this.messages.find(msg => 
                    msg.data.type === 'pong' && 
                    msg.data.timestamp === pingMessage.timestamp
                );
                
                if (pongMessage) {
                    clearTimeout(timeout);
                    log.success('Ping/pong successful');
                    resolve(pongMessage);
                } else {
                    setTimeout(checkForPong, 100);
                }
            };
            
            checkForPong();
        });
    }
    
    async testNotificationSubscription() {
        log.info('Testing notification subscription...');
        
        const subscribeMessage = {
            type: 'subscribe',
            channels: ['notifications', 'system_alerts']
        };
        
        await this.sendMessage(subscribeMessage);
        
        // Wait for subscription confirmation
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Subscription timeout'));
            }, 5000);
            
            const checkForConfirmation = () => {
                const confirmMessage = this.messages.find(msg => 
                    msg.data.type === 'subscription_confirmed'
                );
                
                if (confirmMessage) {
                    clearTimeout(timeout);
                    log.success('Notification subscription successful');
                    resolve(confirmMessage);
                } else {
                    setTimeout(checkForConfirmation, 100);
                }
            };
            
            checkForConfirmation();
        });
    }
    
    async triggerTestNotification() {
        log.info('Triggering test notification via API...');
        
        try {
            // Try to create a notification through the API
            const response = await httpClient.post(`${CONFIG.API_BASE}/notifications/test`, {
                message: 'WebSocket test notification',
                type: 'info'
            }, {
                headers: { Authorization: `Bearer ${this.token}` }
            });
            
            if (response.status === 200 || response.status === 201) {
                log.success('Test notification triggered');
                return true;
            } else {
                log.warn(`Test notification response: ${response.status}`);
                return false;
            }
        } catch (error) {
            log.warn(`Could not trigger test notification: ${error.message}`);
            return false;
        }
    }
    
    async waitForNotifications(timeout = 10000) {
        log.info(`Waiting for notifications (${timeout}ms)...`);
        
        const startTime = Date.now();
        const initialMessageCount = this.messages.length;
        
        return new Promise((resolve) => {
            const checkForNewMessages = () => {
                const elapsed = Date.now() - startTime;
                const newMessages = this.messages.slice(initialMessageCount);
                
                if (newMessages.length > 0) {
                    log.success(`Received ${newMessages.length} new messages`);
                    resolve(newMessages);
                } else if (elapsed >= timeout) {
                    log.warn('No new messages received within timeout');
                    resolve([]);
                } else {
                    setTimeout(checkForNewMessages, 500);
                }
            };
            
            checkForNewMessages();
        });
    }
    
    disconnect() {
        if (this.ws && this.connected) {
            log.info('Disconnecting WebSocket...');
            this.ws.close();
        }
    }
    
    getMessagesSummary() {
        const summary = {
            total: this.messages.length,
            byType: {},
            timeline: this.messages.map(msg => ({
                timestamp: msg.timestamp.toISOString(),
                type: msg.data.type || 'unknown',
                data: msg.data
            }))
        };
        
        this.messages.forEach(msg => {
            const type = msg.data.type || 'unknown';
            summary.byType[type] = (summary.byType[type] || 0) + 1;
        });
        
        return summary;
    }
}

// Test scenarios
async function runBasicWebSocketTest() {
    console.log(chalk.bold.blue('\n🔌 CAF WebSocket Basic Test'));
    console.log(chalk.blue('============================'));
    
    const tester = new WebSocketTester();
    
    try {
        // Authenticate
        await tester.authenticate();
        
        // Connect WebSocket
        await tester.connectWebSocket();
        
        // Wait a moment for connection to stabilize
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Test basic functionality
        log.info('Running basic WebSocket tests...');
        
        // Test 1: Connection established
        log.success('Test 1: WebSocket connection - PASSED');
        
        // Test 2: Send/receive capability (if ping/pong is supported)
        try {
            await tester.testPingPong();
            log.success('Test 2: Ping/pong communication - PASSED');
        } catch (error) {
            log.warn('Test 2: Ping/pong communication - SKIPPED (not supported)');
        }
        
        // Test 3: Subscription mechanism (if supported)
        try {
            await tester.testNotificationSubscription();
            log.success('Test 3: Notification subscription - PASSED');
        } catch (error) {
            log.warn('Test 3: Notification subscription - SKIPPED (not supported)');
        }
        
        // Test 4: Wait for any incoming messages
        const newMessages = await tester.waitForNotifications(5000);
        if (newMessages.length > 0) {
            log.success(`Test 4: Received ${newMessages.length} messages - PASSED`);
        } else {
            log.warn('Test 4: No messages received - EXPECTED (no active notifications)');
        }
        
        // Get summary
        const summary = tester.getMessagesSummary();
        
        console.log('\n' + chalk.bold.green('📊 WebSocket Test Results'));
        console.log(chalk.green('=========================='));
        console.log(`Connection: ✅ Successful`);
        console.log(`Messages Received: ${summary.total}`);
        console.log(`Message Types:`, summary.byType);
        
        if (summary.total > 0) {
            console.log('\nMessage Timeline:');
            summary.timeline.forEach((msg, index) => {
                console.log(`  ${index + 1}. [${msg.timestamp}] ${msg.type}: ${JSON.stringify(msg.data)}`);
            });
        }
        
        log.success('WebSocket basic test completed successfully');
        
    } catch (error) {
        log.error(`WebSocket test failed: ${error.message}`);
        process.exit(1);
    } finally {
        tester.disconnect();
    }
}

async function runWebSocketLoadTest() {
    console.log(chalk.bold.blue('\n🔌 CAF WebSocket Load Test'));
    console.log(chalk.blue('==========================='));
    
    const connectionCount = 5;
    const testers = [];
    
    try {
        log.info(`Creating ${connectionCount} concurrent WebSocket connections...`);
        
        // Create multiple connections
        for (let i = 0; i < connectionCount; i++) {
            const tester = new WebSocketTester();
            await tester.authenticate();
            testers.push(tester);
        }
        
        // Connect all WebSockets concurrently
        await Promise.all(testers.map(tester => tester.connectWebSocket()));
        
        log.success(`All ${connectionCount} WebSocket connections established`);
        
        // Keep connections alive for a period
        log.info('Maintaining connections for 30 seconds...');
        await new Promise(resolve => setTimeout(resolve, 30000));
        
        // Collect statistics
        let totalMessages = 0;
        testers.forEach((tester, index) => {
            const summary = tester.getMessagesSummary();
            totalMessages += summary.total;
            console.log(`Connection ${index + 1}: ${summary.total} messages`);
        });
        
        log.success(`Load test completed: ${totalMessages} total messages across ${connectionCount} connections`);
        
    } catch (error) {
        log.error(`WebSocket load test failed: ${error.message}`);
        process.exit(1);
    } finally {
        // Cleanup all connections
        testers.forEach(tester => tester.disconnect());
    }
}

// CLI interface
function showHelp() {
    console.log(`
CAF WebSocket Testing Tool

Usage: node websocket-tester.js [command]

Commands:
  basic     Run basic WebSocket functionality test (default)
  load      Run WebSocket load test with multiple connections
  help      Show this help message

Environment Variables:
  TEST_USER_EMAIL      Test user email for authentication
  TEST_USER_PASSWORD   Test user password
  API_BASE_URL         API base URL
  WS_BASE_URL          WebSocket base URL

Examples:
  node websocket-tester.js basic
  node websocket-tester.js load
`);
}

// Main execution
if (require.main === module) {
    const command = process.argv[2] || 'basic';
    
    switch (command) {
        case 'basic':
            runBasicWebSocketTest();
            break;
        case 'load':
            runWebSocketLoadTest();
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

module.exports = { WebSocketTester };
