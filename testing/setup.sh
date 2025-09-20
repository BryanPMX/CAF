#!/bin/bash

# CAF System Testing Suite Setup Script
# This script sets up the complete testing environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check Node.js version
check_node_version() {
    if command_exists node; then
        NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VERSION" -ge 14 ]; then
            print_success "Node.js version $(node --version) is compatible"
            return 0
        else
            print_error "Node.js version $(node --version) is too old. Minimum required: v14"
            return 1
        fi
    else
        print_error "Node.js is not installed"
        return 1
    fi
}

# Function to install Node.js dependencies
install_dependencies() {
    print_status "Installing Node.js dependencies..."
    
    if [ ! -f "package.json" ]; then
        print_error "package.json not found. Are you in the testing directory?"
        exit 1
    fi
    
    npm install
    print_success "Dependencies installed successfully"
}

# Function to setup environment file
setup_environment() {
    print_status "Setting up environment configuration..."
    
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_success "Created .env file from template"
            print_warning "Please edit .env file with your production URLs and credentials"
        else
            print_error ".env.example file not found"
            exit 1
        fi
    else
        print_warning ".env file already exists - skipping creation"
    fi
}

# Function to make scripts executable
make_scripts_executable() {
    print_status "Making scripts executable..."
    
    chmod +x health-monitor.sh
    chmod +x smoke-tests.js
    chmod +x integration-tests.js
    
    print_success "Scripts are now executable"
}

# Function to validate configuration
validate_configuration() {
    print_status "Validating configuration..."
    
    # Check if .env file has required variables
    if [ -f ".env" ]; then
        if grep -q "API_BASE_URL=" .env && grep -q "TEST_USER_EMAIL=" .env; then
            print_success "Environment configuration looks good"
        else
            print_warning "Environment configuration may be incomplete"
            print_warning "Please ensure API_BASE_URL and TEST_USER_EMAIL are set in .env"
        fi
    fi
}

# Function to test basic connectivity
test_connectivity() {
    print_status "Testing basic connectivity..."
    
    # Source environment variables
    if [ -f ".env" ]; then
        set -a
        source .env
        set +a
    fi
    
    API_BASE_URL=${API_BASE_URL:-"https://api.caf-mexico.org"}
    
    if curl -f -s --max-time 10 "${API_BASE_URL}/health" > /dev/null; then
        print_success "API connectivity test passed"
    else
        print_warning "API connectivity test failed - please check your API_BASE_URL"
        print_warning "You can still proceed with setup, but tests may fail"
    fi
}

# Function to create test directories
create_directories() {
    print_status "Creating necessary directories..."
    
    mkdir -p logs
    mkdir -p reports
    mkdir -p backups
    
    print_success "Directories created"
}

# Function to setup cron jobs (optional)
setup_cron_jobs() {
    read -p "Do you want to setup automated health monitoring via cron? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Setting up cron jobs..."
        
        SCRIPT_DIR=$(pwd)
        CRON_ENTRY="*/5 * * * * cd $SCRIPT_DIR && ./health-monitor.sh quick >> logs/health.log 2>&1"
        
        # Add to crontab if not already present
        (crontab -l 2>/dev/null | grep -v "$SCRIPT_DIR/health-monitor.sh"; echo "$CRON_ENTRY") | crontab -
        
        print_success "Cron job added for health monitoring every 5 minutes"
        print_status "Logs will be written to logs/health.log"
    else
        print_status "Skipping cron job setup"
    fi
}

# Function to run initial tests
run_initial_tests() {
    read -p "Do you want to run initial health checks? (Y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        print_status "Running initial health checks..."
        
        if ./health-monitor.sh quick; then
            print_success "Initial health checks passed"
        else
            print_warning "Some health checks failed - please review your configuration"
        fi
    else
        print_status "Skipping initial tests"
    fi
}

# Main setup function
main() {
    echo -e "${BLUE}"
    echo "================================================="
    echo "  CAF System Testing Suite Setup"
    echo "================================================="
    echo -e "${NC}"
    echo
    
    print_status "Starting setup process..."
    echo
    
    # Check prerequisites
    print_status "Checking prerequisites..."
    
    if ! command_exists curl; then
        print_error "curl is required but not installed"
        exit 1
    fi
    
    if ! command_exists bc; then
        print_error "bc is required but not installed"
        print_status "Install with: sudo apt-get install bc (Ubuntu) or brew install bc (macOS)"
        exit 1
    fi
    
    if ! check_node_version; then
        print_error "Please install Node.js 14+ and npm"
        exit 1
    fi
    
    print_success "Prerequisites check passed"
    echo
    
    # Setup steps
    create_directories
    setup_environment
    install_dependencies
    make_scripts_executable
    validate_configuration
    test_connectivity
    
    echo
    print_status "Core setup completed successfully!"
    echo
    
    # Optional setup steps
    setup_cron_jobs
    run_initial_tests
    
    # Final instructions
    echo
    echo -e "${GREEN}================================================="
    echo "  Setup Complete!"
    echo "=================================================${NC}"
    echo
    echo "Next steps:"
    echo "1. Edit .env file with your production URLs and test credentials"
    echo "2. Create dedicated test users in your production system"
    echo "3. Configure alert webhooks (Slack/email) in .env"
    echo
    echo "Available commands:"
    echo "  ./health-monitor.sh           # Run health checks"
    echo "  npm run smoke-tests          # Run smoke tests"
    echo "  npm run load-test            # Run load tests"
    echo "  npm run integration-tests    # Run integration tests"
    echo
    echo "For detailed usage, see README.md"
    echo
    print_success "CAF Testing Suite is ready to use!"
}

# Check if running from correct directory
if [ ! -f "package.json" ] || [ ! -f "health-monitor.sh" ]; then
    print_error "Please run this script from the testing directory"
    print_error "Expected files: package.json, health-monitor.sh"
    exit 1
fi

# Run main setup
main "$@"
