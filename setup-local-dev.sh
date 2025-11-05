#!/bin/bash

# CAF Local Development Setup Script - Enhanced Version
# This script sets up the complete local development environment including frontend applications

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ADMIN_PORTAL_DIR="$PROJECT_ROOT/admin-portal"
MARKETING_DIR="$PROJECT_ROOT/marketing"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Parse command line arguments
SKIP_FRONTEND=false
QUIET=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-frontend)
            SKIP_FRONTEND=true
            shift
            ;;
        --quiet|-q)
            QUIET=true
            shift
            ;;
        --help|-h)
            echo "CAF Local Development Setup Script"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --skip-frontend    Skip starting frontend applications"
            echo "  --quiet, -q        Reduce output verbosity"
            echo "  --help, -h         Show this help message"
            echo ""
            echo "This script sets up the complete CAF development environment."
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information."
            exit 1
            ;;
    esac
done

# Logging functions
log_info() {
    if [ "$QUIET" = false ]; then
        echo -e "${BLUE}ℹ️  $1${NC}"
    fi
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_header() {
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}$(printf '%.0s=' {1..50})${NC}"
}

# Cleanup function
cleanup() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        log_error "Script failed with exit code $exit_code"
        log_info "To clean up: docker-compose down -v"
    fi
    exit $exit_code
}

trap cleanup EXIT

# Change to project root
cd "$PROJECT_ROOT"

log_header "🚀 CAF Local Development Environment Setup"
log_info "Starting enhanced setup process..."

# Check prerequisites
log_info "Checking prerequisites..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    log_error "Docker is not running. Please start Docker and try again."
    exit 1
fi
log_success "Docker is running"

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null; then
    log_error "Docker Compose is not installed. Please install Docker Compose and try again."
    exit 1
fi
log_success "Docker Compose is available"

# Check Node.js and npm if not skipping frontend
if [ "$SKIP_FRONTEND" = false ]; then
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js (version 18+) and try again."
        exit 1
    fi
    log_success "Node.js is available ($(node --version))"

    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed. Please install npm and try again."
        exit 1
    fi
    log_success "npm is available ($(npm --version))"
fi

# Copy environment files
log_info "Setting up environment files..."

# Copy API environment file
if [ -f "api/env.development" ]; then
    cp api/env.development api/.env
    log_success "API environment file copied"
else
    log_error "api/env.development not found"
    exit 1
fi

# Copy admin portal environment file
if [ -f "admin-portal/env.development" ]; then
    cp admin-portal/env.development admin-portal/.env.local
    log_success "Admin portal environment file copied"
else
    log_error "admin-portal/env.development not found"
    exit 1
fi

# Start Docker services
log_header "🐳 Starting Backend Services"
log_info "Starting Docker services... This may take a few minutes on first run."

docker-compose up -d

# Wait for services to be healthy
log_info "Waiting for services to be healthy..."

# Check LocalStack health
max_attempts=30
attempt=1
while [ $attempt -le $max_attempts ]; do
    if docker-compose exec -T localstack curl -f http://localhost:4566/_localstack/health > /dev/null 2>&1; then
        log_success "LocalStack is healthy"
        break
    fi
    log_info "Waiting for LocalStack... (attempt $attempt/$max_attempts)"
    sleep 2
    ((attempt++))
done

if [ $attempt -gt $max_attempts ]; then
    log_warning "LocalStack health check failed, but services are starting..."
fi

# Check API health
attempt=1
while [ $attempt -le $max_attempts ]; do
    if curl -f http://localhost:8080/health > /dev/null 2>&1; then
        log_success "API is healthy"
        break
    fi
    log_info "Waiting for API... (attempt $attempt/$max_attempts)"
    sleep 2
    ((attempt++))
done

if [ $attempt -gt $max_attempts ]; then
    log_error "API failed to start properly"
    log_info "Check logs with: docker-compose logs api"
    exit 1
fi

# Start frontend applications if not skipped
if [ "$SKIP_FRONTEND" = false ]; then
    log_header "🌐 Starting Frontend Applications"

    # Start Admin Portal
    log_info "Starting Admin Portal..."

    # Check if admin-portal directory exists
    if [ ! -d "$ADMIN_PORTAL_DIR" ]; then
        log_error "admin-portal directory not found"
        exit 1
    fi

    # Navigate to admin-portal and install dependencies
    cd "$ADMIN_PORTAL_DIR"
    if [ ! -d "node_modules" ]; then
        log_info "Installing Admin Portal dependencies..."
        if ! npm install; then
            log_error "Failed to install Admin Portal dependencies"
            exit 1
        fi
        log_success "Admin Portal dependencies installed"
    else
        log_success "Admin Portal dependencies already installed"
    fi

    # Start Admin Portal in background
    log_info "Starting Admin Portal development server..."
    npm run dev > /dev/null 2>&1 &
    ADMIN_PID=$!
    log_success "Admin Portal started (PID: $ADMIN_PID)"

    # Wait for Admin Portal to be ready
    attempt=1
    while [ $attempt -le 20 ]; do
        if curl -f http://localhost:3000 > /dev/null 2>&1; then
            log_success "Admin Portal is ready on http://localhost:3000"
            break
        fi
        log_info "Waiting for Admin Portal... (attempt $attempt/20)"
        sleep 3
        ((attempt++))
    done

    if [ $attempt -gt 20 ]; then
        log_warning "Admin Portal may still be starting. Check http://localhost:3000 manually."
    fi

    # Start Marketing Site
    log_info "Starting Marketing Site..."

    # Check if marketing directory exists
    if [ ! -d "$MARKETING_DIR" ]; then
        log_warning "marketing directory not found - skipping marketing site"
    else
        # Navigate to marketing and install dependencies
        cd "$MARKETING_DIR"
        if [ ! -d "node_modules" ]; then
            log_info "Installing Marketing Site dependencies..."
            if ! npm install; then
                log_warning "Failed to install Marketing Site dependencies - skipping"
            else
                log_success "Marketing Site dependencies installed"

                # Start Marketing Site in background
                log_info "Starting Marketing Site development server..."
                npm run dev -- --host > /dev/null 2>&1 &
                MARKETING_PID=$!
                log_success "Marketing Site started (PID: $MARKETING_PID)"

                # Wait for Marketing Site to be ready
                attempt=1
                while [ $attempt -le 15 ]; do
                    if curl -f http://localhost:5173 > /dev/null 2>&1; then
                        log_success "Marketing Site is ready on http://localhost:5173"
                        break
                    fi
                    log_info "Waiting for Marketing Site... (attempt $attempt/15)"
                    sleep 2
                    ((attempt++))
                done

                if [ $attempt -gt 15 ]; then
                    log_warning "Marketing Site may still be starting. Check http://localhost:5173 manually."
                fi
            fi
        else
            # Dependencies already exist, just start the server
            log_info "Starting Marketing Site development server..."
            npm run dev -- --host > /dev/null 2>&1 &
            MARKETING_PID=$!
            log_success "Marketing Site started (PID: $MARKETING_PID)"
        fi
    fi

    # Return to project root
    cd "$PROJECT_ROOT"
fi

# Display final status
log_header "🎉 Setup Complete!"

echo ""
echo "📊 Service Status:"
docker-compose ps

echo ""
log_success "Local development environment is ready!"
echo ""
echo "🌐 Access your applications:"
echo "   📊 Admin Portal:    http://localhost:3000"
echo "   🏠 Marketing Site:  http://localhost:5173"
echo "   🔗 API:            http://localhost:8080"
echo "   🗃️  Database:       localhost:5432"
echo "   ☁️  LocalStack S3:  http://localhost:4566"
echo ""
echo "🔑 Default login credentials:"
echo "   Email: admin@caf.org"
echo "   Password: admin123"
echo ""
echo "🛑 To stop all services:"
echo "   docker-compose down"
echo "   kill $ADMIN_PID 2>/dev/null || true"
if [ "$SKIP_FRONTEND" = false ] && [ -n "$MARKETING_PID" ]; then
    echo "   kill $MARKETING_PID 2>/dev/null || true"
fi
echo ""
echo "🗑️  To stop and remove all data:"
echo "   docker-compose down -v"
echo ""
echo "📖 For production deployment with AWS, see AWS_MIGRATION_GUIDE.md"
