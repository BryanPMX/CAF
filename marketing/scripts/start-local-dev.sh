#!/bin/bash
# CAF Local Development Startup Script
# Starts all services locally with no cloud dependencies

set -e

echo "🏠 CAF Local Development Environment"
echo "===================================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

echo "🐳 Starting local services..."
echo "   - PostgreSQL database"
echo "   - LocalStack (AWS S3 simulator)"
echo "   - Go API server"
echo ""

# Start all services
docker-compose up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to start..."

# Check LocalStack health
max_attempts=30
attempt=1
while [ $attempt -le $max_attempts ]; do
    if docker-compose exec -T localstack curl -f http://localhost:4566/_localstack/health > /dev/null 2>&1; then
        echo "✅ LocalStack is healthy"
        break
    fi
    echo "   Waiting for LocalStack... ($attempt/$max_attempts)"
    sleep 2
    ((attempt++))
done

# Check API health
attempt=1
while [ $attempt -le $max_attempts ]; do
    if curl -f http://localhost:8080/health > /dev/null 2>&1; then
        echo "✅ API is healthy"
        break
    fi
    echo "   Waiting for API... ($attempt/$max_attempts)"
    sleep 2
    ((attempt++))
done

if [ $attempt -gt $max_attempts ]; then
    echo "❌ Services failed to start properly"
    echo "   Check logs with: docker-compose logs"
    exit 1
fi

echo ""
echo "🎉 All services are running!"
echo ""
echo "🌐 Access your applications:"
echo "   📊 Admin Portal: http://localhost:3000"
echo "   🏠 Marketing Site: http://localhost:5173 (if running)"
echo "   🔗 API: http://localhost:8080"
echo "   🗃️  Database: localhost:5432"
echo "   ☁️  LocalStack S3: http://localhost:4566"
echo ""
echo "📝 Default login:"
echo "   Email: admin@caf.org"
echo "   Password: admin123"
echo ""
echo "🛑 To stop: docker-compose down"
echo "🗑️  To stop and remove data: docker-compose down -v"
