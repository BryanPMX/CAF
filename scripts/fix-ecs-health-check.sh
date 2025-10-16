#!/bin/bash

# Fix ECS Task Definition Health Check
# Updates health check to use wget instead of curl (which is not installed in the container)

set -e

AWS_REGION="us-east-2"
ECS_CLUSTER="caf-cluster"
ECS_SERVICE="caf-backend-service"
TASK_FAMILY="caf-backend"

echo "🔧 Fixing ECS Task Definition Health Check..."
echo ""

# Get current task definition
echo "📥 Downloading current task definition..."
aws ecs describe-task-definition \
    --task-definition $TASK_FAMILY \
    --region $AWS_REGION \
    --query 'taskDefinition' > current-task-def.json

# Extract key fields
TASK_ROLE_ARN=$(jq -r '.taskRoleArn' current-task-def.json)
EXECUTION_ROLE_ARN=$(jq -r '.executionRoleArn' current-task-def.json)
CPU=$(jq -r '.cpu' current-task-def.json)
MEMORY=$(jq -r '.memory' current-task-def.json)
IMAGE=$(jq -r '.containerDefinitions[0].image' current-task-def.json)

echo "Current configuration:"
echo "   CPU: $CPU"
echo "   Memory: $MEMORY"
echo "   Image: $IMAGE"
echo ""

# Create updated task definition with wget-based health check
cat > updated-task-def.json <<EOF
{
  "family": "$TASK_FAMILY",
  "taskRoleArn": "$TASK_ROLE_ARN",
  "executionRoleArn": "$EXECUTION_ROLE_ARN",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "$CPU",
  "memory": "$MEMORY",
  "containerDefinitions": [
    {
      "name": "caf-backend",
      "image": "$IMAGE",
      "cpu": 0,
      "portMappings": [
        {
          "containerPort": 8080,
          "hostPort": 8080,
          "protocol": "tcp",
          "name": "caf-backend-8080-tcp",
          "appProtocol": "http"
        }
      ],
      "essential": true,
      "environment": $(jq '.containerDefinitions[0].environment' current-task-def.json),
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/caf-backend",
          "awslogs-create-group": "true",
          "awslogs-region": "$AWS_REGION",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:8080/health/live || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
EOF

# Register new task definition
echo "📝 Registering updated task definition with wget-based health check..."
NEW_TASK_DEF_ARN=$(aws ecs register-task-definition \
    --cli-input-json file://updated-task-def.json \
    --region $AWS_REGION \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text)

echo "✅ New task definition registered: $NEW_TASK_DEF_ARN"
echo ""

# Update service to use new task definition
echo "🚀 Updating ECS service with new task definition..."
aws ecs update-service \
    --cluster $ECS_CLUSTER \
    --service $ECS_SERVICE \
    --task-definition $NEW_TASK_DEF_ARN \
    --force-new-deployment \
    --region $AWS_REGION \
    --query 'service.{ServiceName:serviceName,TaskDefinition:taskDefinition,DesiredCount:desiredCount}' \
    --output table

echo ""
echo "✅ Service updated successfully!"
echo ""

# Clean up
rm -f current-task-def.json updated-task-def.json

echo "🎉 Health check fix complete!"
echo ""
echo "ℹ️  The new task will use 'wget' for health checks (installed in container)"
echo "ℹ️  Health checks should pass once new tasks start"
echo ""
echo "Monitor deployment:"
echo "   aws ecs describe-services --cluster $ECS_CLUSTER --services $ECS_SERVICE --region $AWS_REGION"

