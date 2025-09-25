#!/bin/bash
# Vercel-specific build script with Docker authentication
set -e

echo "🔐 Authenticating with Docker Hub..."
echo "$DOCKERHUB_TOKEN" | docker login --username "$DOCKERHUB_USERNAME" --password-stdin

echo "📦 Building Next.js application..."
npm run build

echo "✅ Build completed successfully!"
