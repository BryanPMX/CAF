#!/bin/bash

# Script to optimize ECS service settings for better deployment reliability
# This script improves deployment configuration, health checks, and monitoring

set -e

# Configuration
AWS_REGION="us-east-2"
ECS_CLUSTER="caf-cluster"
ECS_SERVICE="caf-backend-service"

echo "🔧 Optimizing ECS service settings for better deployment reliability..."

# Update deployment configuration for better reliability
echo "📋 Updating deployment configuration..."
aws ecs update-service \
    --cluster $ECS_CLUSTER \
    --service $ECS_SERVICE \
    --deployment-configuration '{
        "maximumPercent": 200,
        "minimumHealthyPercent": 50,
        "deploymentCircuitBreaker": {
            "enable": true,
            "rollback": true
        }
    }' \
    --region $AWS_REGION

echo "✅ Deployment configuration updated:"
echo "   - Maximum percent: 200% (allows 2x scaling during deployment)"
echo "   - Minimum healthy percent: 50% (keeps at least 1 instance running)"
echo "   - Circuit breaker: enabled with automatic rollback"

# Update health check grace period for better container startup
echo "⏱️ Updating health check grace period..."
aws ecs update-service \
    --cluster $ECS_CLUSTER \
    --service $ECS_SERVICE \
    --health-check-grace-period-seconds 90 \
    --region $AWS_REGION

echo "✅ Health check grace period updated to 90 seconds"

# Update service to use latest platform version
echo "🚀 Updating platform version..."
aws ecs update-service \
    --cluster $ECS_CLUSTER \
    --service $ECS_SERVICE \
    --platform-version LATEST \
    --region $AWS_REGION

echo "✅ Platform version updated to LATEST"

# Enable detailed monitoring
echo "📊 Enabling detailed monitoring..."
aws ecs update-service \
    --cluster $ECS_CLUSTER \
    --service $ECS_SERVICE \
    --enable-execute-command \
    --region $AWS_REGION

echo "✅ Detailed monitoring enabled"

# Verify the service configuration
echo "🔍 Verifying service configuration..."
aws ecs describe-services \
    --cluster $ECS_CLUSTER \
    --services $ECS_SERVICE \
    --region $AWS_REGION \
    --query 'services[0].{
        DeploymentConfig:deploymentConfiguration,
        HealthCheckGracePeriod:healthCheckGracePeriodSeconds,
        PlatformVersion:platformVersion,
        EnableExecuteCommand:enableExecuteCommand
    }' \
    --output json

echo ""
echo "🎉 ECS service optimization completed!"
echo ""
echo "📋 Summary of improvements:"
echo "   ✅ Better deployment configuration with circuit breaker"
echo "   ✅ Increased health check grace period (90s)"
echo "   ✅ Latest platform version"
echo "   ✅ Enhanced monitoring capabilities"
echo ""
echo "🚀 These settings will improve:"
echo "   - Deployment reliability and speed"
echo "   - Automatic rollback on failures"
echo "   - Better container startup handling"
echo "   - Enhanced debugging capabilities"
