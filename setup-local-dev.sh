#!/bin/bash

# CAF Local Development Setup Script
# This script sets up the local development environment with LocalStack

echo "🚀 Setting up CAF Local Development Environment"
echo "=============================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose and try again."
    exit 1
fi

echo "📋 Copying environment files..."

# Copy API environment file
if [ -f "api/env.development" ]; then
    cp api/env.development api/.env
    echo "✅ API environment file copied"
else
    echo "❌ api/env.development not found"
    exit 1
fi

# Copy admin portal environment file
if [ -f "admin-portal/env.development" ]; then
    cp admin-portal/env.development admin-portal/.env.local
    echo "✅ Admin portal environment file copied"
else
    echo "❌ admin-portal/env.development not found"
    exit 1
fi

echo ""
echo "🐳 Starting services with Docker Compose..."
echo "This may take a few minutes on first run..."

# Start services
docker-compose up -d

# Wait for services to be healthy
echo ""
echo "⏳ Waiting for services to start..."

# Check if LocalStack is healthy
max_attempts=30
attempt=1
while [ $attempt -le $max_attempts ]; do
    if docker-compose exec -T localstack curl -f http://localhost:4566/_localstack/health > /dev/null 2>&1; then
        echo "✅ LocalStack is healthy"
        break
    fi
    echo "Waiting for LocalStack... (attempt $attempt/$max_attempts)"
    sleep 2
    ((attempt++))
done

if [ $attempt -gt $max_attempts ]; then
    echo "⚠️  LocalStack health check failed, but services are starting..."
fi

# Check API health
attempt=1
while [ $attempt -le $max_attempts ]; do
    if curl -f http://localhost:8080/health > /dev/null 2>&1; then
        echo "✅ API is healthy"
        break
    fi
    echo "Waiting for API... (attempt $attempt/$max_attempts)"
    sleep 2
    ((attempt++))
done

echo ""
echo "📊 Service Status:"
docker-compose ps

echo ""
echo "🎉 Local development environment is ready!"
echo ""
echo "🌐 Access your application:"
echo "   Admin Portal: http://localhost:3000"
echo "   API: http://localhost:8080"
echo "   LocalStack (AWS simulation): http://localhost:4566"
echo "   Database: localhost:5432"
echo ""
echo "🔑 Default login credentials:"
echo "   Email: admin@caf.org"
echo "   Password: admin123"
echo ""
echo "📚 Next steps:"
echo "   1. cd admin-portal && npm install && npm run dev"
echo "   2. Open http://localhost:3000 in your browser"
echo "   3. Login with the credentials above"
echo ""
echo "📖 For production deployment with AWS, see AWS_MIGRATION_GUIDE.md"
echo ""
echo "🛑 To stop services: docker-compose down"
echo "🗑️  To stop and remove data: docker-compose down -v"
