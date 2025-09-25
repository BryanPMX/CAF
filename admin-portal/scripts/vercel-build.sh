#!/bin/bash
# Vercel-specific build script for Next.js application
set -e

echo "📦 Building Next.js application..."
npm run build

echo "✅ Build completed successfully!"
