#!/bin/bash

# Comprehensive AWS Infrastructure Health Check Script
# Verifies all critical services are running and healthy

set -e

AWS_REGION="us-east-2"
ECS_CLUSTER="caf-cluster"
ECS_SERVICE="caf-backend-service"
TARGET_GROUP_ARN="arn:aws:elasticloadbalancing:us-east-2:441130535898:targetgroup/caf-targets/3731b3b58db46b0b"
RDS_INSTANCE="caf-postgres"
ALB_DNS="caf-alb-1265516716.us-east-2.elb.amazonaws.com"

echo "🏥 CAF AWS INFRASTRUCTURE HEALTH CHECK"
echo "======================================="
echo ""

# Function to print status with emoji
print_status() {
    if [ "$1" = "success" ]; then
        echo "✅ $2"
    elif [ "$1" = "warning" ]; then
        echo "⚠️  $2"
    else
        echo "❌ $2"
    fi
}

# 1. Check ECS Service
echo "1️⃣  ECS SERVICE STATUS"
echo "-------------------"
SERVICE_INFO=$(aws ecs describe-services \
    --cluster $ECS_CLUSTER \
    --services $ECS_SERVICE \
    --region $AWS_REGION \
    --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount,TaskDef:taskDefinition}' \
    --output json)

STATUS=$(echo $SERVICE_INFO | jq -r '.Status')
RUNNING=$(echo $SERVICE_INFO | jq -r '.Running')
DESIRED=$(echo $SERVICE_INFO | jq -r '.Desired')
TASK_DEF=$(echo $SERVICE_INFO | jq -r '.TaskDef')

if [ "$STATUS" = "ACTIVE" ] && [ "$RUNNING" = "$DESIRED" ]; then
    print_status "success" "ECS Service: $STATUS"
    print_status "success" "Tasks: $RUNNING/$DESIRED running"
    echo "   Task Definition: $TASK_DEF"
else
    print_status "error" "ECS Service: $STATUS"
    print_status "error" "Tasks: $RUNNING/$DESIRED running (mismatch)"
fi
echo ""

# 2. Check Task Health
echo "2️⃣  ECS TASK HEALTH"
echo "-----------------"
TASK_ARNS=$(aws ecs list-tasks \
    --cluster $ECS_CLUSTER \
    --service-name $ECS_SERVICE \
    --region $AWS_REGION \
    --query 'taskArns' \
    --output text)

if [ -n "$TASK_ARNS" ]; then
    TASK_HEALTH=$(aws ecs describe-tasks \
        --cluster $ECS_CLUSTER \
        --tasks $TASK_ARNS \
        --region $AWS_REGION \
        --query 'tasks[*].{TaskId:taskArn,Status:lastStatus,Health:healthStatus}' \
        --output json)
    
    echo "$TASK_HEALTH" | jq -r '.[] | "   Task: \(.TaskId | split("/") | .[-1])\n   Status: \(.Status)\n   Health: \(.Health)\n"'
    
    HEALTHY_TASKS=$(echo "$TASK_HEALTH" | jq '[.[] | select(.Health=="HEALTHY")] | length')
    TOTAL_TASKS=$(echo "$TASK_HEALTH" | jq 'length')
    
    if [ "$HEALTHY_TASKS" -gt 0 ]; then
        print_status "success" "Healthy Tasks: $HEALTHY_TASKS/$TOTAL_TASKS"
    else
        print_status "warning" "Healthy Tasks: $HEALTHY_TASKS/$TOTAL_TASKS (tasks may still be starting)"
    fi
else
    print_status "error" "No tasks found"
fi
echo ""

# 3. Check Target Group Health
echo "3️⃣  LOAD BALANCER TARGET HEALTH"
echo "------------------------------"
TARGET_HEALTH=$(aws elbv2 describe-target-health \
    --target-group-arn $TARGET_GROUP_ARN \
    --region $AWS_REGION \
    --query 'TargetHealthDescriptions' \
    --output json)

HEALTHY_TARGETS=$(echo "$TARGET_HEALTH" | jq '[.[] | select(.TargetHealth.State=="healthy")] | length')
TOTAL_TARGETS=$(echo "$TARGET_HEALTH" | jq 'length')

if [ "$HEALTHY_TARGETS" -gt 0 ]; then
    print_status "success" "Healthy Targets: $HEALTHY_TARGETS/$TOTAL_TARGETS"
    echo "$TARGET_HEALTH" | jq -r '.[] | "   Target: \(.Target.Id) - \(.TargetHealth.State)"'
else
    print_status "error" "Healthy Targets: $HEALTHY_TARGETS/$TOTAL_TARGETS"
    echo "$TARGET_HEALTH" | jq -r '.[] | "   Target: \(.Target.Id) - \(.TargetHealth.State) (\(.TargetHealth.Reason // "No reason"))"'
fi
echo ""

# 4. Check RDS Database
echo "4️⃣  RDS DATABASE STATUS"
echo "---------------------"
RDS_INFO=$(aws rds describe-db-instances \
    --db-instance-identifier $RDS_INSTANCE \
    --region $AWS_REGION \
    --query 'DBInstances[0].{Status:DBInstanceStatus,Class:DBInstanceClass,Engine:Engine,Version:EngineVersion}' \
    --output json)

RDS_STATUS=$(echo $RDS_INFO | jq -r '.Status')

if [ "$RDS_STATUS" = "available" ]; then
    print_status "success" "RDS Status: $RDS_STATUS"
    echo "   Instance: $(echo $RDS_INFO | jq -r '.Class')"
    echo "   Engine: $(echo $RDS_INFO | jq -r '.Engine') $(echo $RDS_INFO | jq -r '.Version')"
else
    print_status "error" "RDS Status: $RDS_STATUS"
fi
echo ""

# 5. Check Application Load Balancer
echo "5️⃣  APPLICATION LOAD BALANCER"
echo "---------------------------"
ALB_STATE=$(aws elbv2 describe-load-balancers \
    --region $AWS_REGION \
    --query 'LoadBalancers[0].State.Code' \
    --output text)

if [ "$ALB_STATE" = "active" ]; then
    print_status "success" "ALB State: $ALB_STATE"
else
    print_status "error" "ALB State: $ALB_STATE"
fi
echo ""

# 6. Test API Endpoints
echo "6️⃣  API ENDPOINT TESTS"
echo "--------------------"

# Test health endpoint via ALB
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://$ALB_DNS/health/live || echo "000")

if [ "$HEALTH_RESPONSE" = "200" ]; then
    print_status "success" "Health endpoint: HTTP $HEALTH_RESPONSE"
else
    print_status "warning" "Health endpoint: HTTP $HEALTH_RESPONSE (may be expected for internal ALB)"
fi
echo ""

# 7. Check Auto-scaling Configuration
echo "7️⃣  AUTO-SCALING CONFIGURATION"
echo "----------------------------"
SCALING_INFO=$(aws application-autoscaling describe-scalable-targets \
    --service-namespace ecs \
    --resource-ids service/$ECS_CLUSTER/$ECS_SERVICE \
    --region $AWS_REGION \
    --query 'ScalableTargets[0].{Min:MinCapacity,Max:MaxCapacity}' \
    --output json 2>/dev/null || echo "{}")

if [ "$SCALING_INFO" != "{}" ] && [ -n "$SCALING_INFO" ]; then
    MIN_CAPACITY=$(echo $SCALING_INFO | jq -r '.Min // "N/A"')
    MAX_CAPACITY=$(echo $SCALING_INFO | jq -r '.Max // "N/A"')
    print_status "success" "Auto-scaling configured: $MIN_CAPACITY-$MAX_CAPACITY tasks"
else
    print_status "warning" "Auto-scaling not configured"
fi
echo ""

# Final Summary
echo "═══════════════════════════════════════════"
echo "           🎯 HEALTH CHECK SUMMARY"
echo "═══════════════════════════════════════════"

# Count checks
TOTAL_CHECKS=7
PASSED_CHECKS=0

[ "$STATUS" = "ACTIVE" ] && [ "$RUNNING" = "$DESIRED" ] && ((PASSED_CHECKS++))
[ "$HEALTHY_TARGETS" -gt 0 ] && ((PASSED_CHECKS++))
[ "$RDS_STATUS" = "available" ] && ((PASSED_CHECKS++))
[ "$ALB_STATE" = "active" ] && ((PASSED_CHECKS++))
[ "$HEALTH_RESPONSE" = "200" ] && ((PASSED_CHECKS++))
[ "$HEALTHY_TASKS" -gt 0 ] && ((PASSED_CHECKS++))
[ "$SCALING_INFO" != "{}" ] && ((PASSED_CHECKS++))

echo "Passed: $PASSED_CHECKS/$TOTAL_CHECKS checks"
echo ""

if [ "$PASSED_CHECKS" -ge 6 ]; then
    echo "🎉 System Status: HEALTHY"
    exit 0
elif [ "$PASSED_CHECKS" -ge 4 ]; then
    echo "⚠️  System Status: DEGRADED (some issues detected)"
    exit 0
else
    echo "❌ System Status: UNHEALTHY (multiple failures)"
    exit 1
fi

