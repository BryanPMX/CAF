#!/bin/bash

# Script to create ECS task role for enhanced monitoring and debugging
set -e

AWS_REGION="us-east-2"
ROLE_NAME="ecsTaskRole"
POLICY_NAME="ecsTaskPolicy"

echo "🔧 Creating ECS task role for enhanced monitoring..."

# Create the trust policy for ECS tasks
cat > trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ecs-tasks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create the task role
echo "📋 Creating task role: $ROLE_NAME"
aws iam create-role \
    --role-name $ROLE_NAME \
    --assume-role-policy-document file://trust-policy.json \
    --region $AWS_REGION || {
    echo "⚠️ Role may already exist, checking..."
    aws iam get-role --role-name $ROLE_NAME --region $AWS_REGION
}

# Create a minimal policy for the task role (for debugging and monitoring)
cat > task-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogStreams"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage"
      ],
      "Resource": "*"
    }
  ]
}
EOF

# Create the policy
echo "📋 Creating task policy: $POLICY_NAME"
aws iam put-role-policy \
    --role-name $ROLE_NAME \
    --policy-name $POLICY_NAME \
    --policy-document file://task-policy.json \
    --region $AWS_REGION

# Get the role ARN
ROLE_ARN=$(aws iam get-role --role-name $ROLE_NAME --query 'Role.Arn' --output text --region $AWS_REGION)

echo "✅ Task role created successfully!"
echo "   Role Name: $ROLE_NAME"
echo "   Role ARN: $ROLE_ARN"

# Clean up temporary files
rm -f trust-policy.json task-policy.json

echo ""
echo "🎉 ECS task role setup completed!"
echo "   This role can now be used in task definitions for enhanced monitoring."
echo ""
echo "📋 Next steps:"
echo "   1. Update task definition to include this task role"
echo "   2. Re-run the ECS service optimization script"
