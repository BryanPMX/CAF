#!/bin/bash
# Check Docker status and provide helpful feedback

echo "🐳 Checking Docker Status"
echo "========================"

# Check if Docker Desktop is installed
if [ ! -d "/Applications/Docker.app" ]; then
    echo "❌ Docker Desktop not found in /Applications/"
    echo ""
    echo "📦 Install Docker Desktop:"
    echo "   1. Visit: https://www.docker.com/products/docker-desktop/"
    echo "   2. Download for Mac (Intel/Apple Silicon)"
    echo "   3. Install and run Docker Desktop"
    exit 1
fi

echo "✅ Docker Desktop is installed"

# Check if Docker processes are running
if pgrep -f "Docker" > /dev/null; then
    echo "✅ Docker Desktop processes are running"
else
    echo "❌ Docker Desktop is not running"
    echo ""
    echo "🚀 Start Docker Desktop:"
    echo "   1. Open Spotlight (Cmd + Space)"
    echo "   2. Search for 'Docker' and open Docker Desktop"
    echo "   3. Wait for the green indicator to appear"
    exit 1
fi

# Check if Docker daemon is accessible
if docker info > /dev/null 2>&1; then
    echo "✅ Docker daemon is accessible"
    echo ""
    echo "🎉 Docker is ready! You can now run:"
    echo "   ./scripts/start-local-dev.sh"
else
    echo "⚠️  Docker Desktop is running but daemon not ready yet"
    echo ""
    echo "⏳ Please wait a few more moments for Docker to fully start"
    echo "   The whale icon in menu bar should show green when ready"
    echo ""
    echo "🔄 Then run: ./scripts/start-local-dev.sh"
    exit 1
fi
