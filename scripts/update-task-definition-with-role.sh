#!/bin/bash

# Script to update ECS task definition with task role
set -e

AWS_REGION="us-east-2"
ECS_CLUSTER="caf-cluster"
ECS_SERVICE="caf-backend-service"
TASK_DEFINITION_FAMILY="caf-backend"
TASK_ROLE_ARN="arn:aws:iam::441130535898:role/ecsTaskRole"

echo "🔧 Updating task definition with task role..."

# Get the current task definition
echo "📋 Downloading current task definition..."
aws ecs describe-task-definition --task-definition $TASK_DEFINITION_FAMILY --region $AWS_REGION --query 'taskDefinition' > current-task-definition.json

# Update the task definition to include the task role
echo "📋 Adding task role to task definition..."
jq --arg TASK_ROLE_ARN "$TASK_ROLE_ARN" '. + {taskRoleArn: $TASK_ROLE_ARN}' current-task-definition.json > updated-task-definition.json

# Remove fields that shouldn't be in the new task definition
echo "📋 Cleaning up task definition..."
jq 'del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .placementConstraints, .compatibilities, .registeredAt, .registeredBy)' updated-task-definition.json > final-task-definition.json

# Register the new task definition
echo "📋 Registering new task definition..."
NEW_TASK_DEF_ARN=$(aws ecs register-task-definition --cli-input-json file://final-task-definition.json --query 'taskDefinition.taskDefinitionArn' --output text --region $AWS_REGION)

echo "✅ New task definition registered: $NEW_TASK_DEF_ARN"

# Update the ECS service to use the new task definition
echo "📋 Updating ECS service with new task definition..."
aws ecs update-service \
    --cluster $ECS_CLUSTER \
    --service $ECS_SERVICE \
    --task-definition $NEW_TASK_DEF_ARN \
    --region $AWS_REGION

echo "✅ ECS service updated successfully!"

# Clean up temporary files
rm -f current-task-definition.json updated-task-definition.json final-task-definition.json

echo ""
echo "🎉 Task definition update completed!"
echo "   New task definition includes task role: $TASK_ROLE_ARN"
echo "   Service is now using the updated task definition"
echo ""
echo "📋 Next step: Re-run the ECS service optimization script"
