#!/bin/bash

# CAF Dependencies Setup Script
# Comprehensive dependency installation for all CAF components

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

# Component directories
API_DIR="$PROJECT_ROOT/api"
ADMIN_PORTAL_DIR="$PROJECT_ROOT/admin-portal"
MARKETING_DIR="$PROJECT_ROOT/marketing"
TESTING_DIR="$PROJECT_ROOT/testing"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_header() {
    echo -e "${CYAN}=== $1 ===${NC}"
}

# Error handling
error_exit() {
    log_error "$1"
    exit 1
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check system prerequisites
check_prerequisites() {
    log_header "SYSTEM PREREQUISITE VERIFICATION"

    local missing_tools=()

    # Check for Go
    if ! command_exists go; then
        missing_tools+=("Go (https://golang.org/dl/)")
    else
        GO_VERSION=$(go version | grep -o 'go[0-9]\+\.[0-9]\+' | sed 's/go//')
        log_success "Go runtime v$GO_VERSION detected"
    fi

    # Check for Node.js
    if ! command_exists node; then
        missing_tools+=("Node.js (https://nodejs.org/)")
    else
        NODE_VERSION=$(node --version | sed 's/v//')
        NODE_MAJOR=$(echo $NODE_VERSION | cut -d. -f1)
        if [ "$NODE_MAJOR" -lt 18 ]; then
            log_warning "Node.js v$NODE_VERSION detected (minimum requirement: v18+)"
        else
            log_success "Node.js v$NODE_VERSION detected"
        fi
    fi

    # Check for npm
    if ! command_exists npm; then
        missing_tools+=("npm (comes with Node.js)")
    else
        NPM_VERSION=$(npm --version)
        log_success "npm v$NPM_VERSION detected"
    fi

    # Check for git
    if ! command_exists git; then
        missing_tools+=("Git (https://git-scm.com/)")
    else
        GIT_VERSION=$(git --version | awk '{print $3}')
        log_success "Git v$GIT_VERSION detected"
    fi

    # Check for curl
    if ! command_exists curl; then
        missing_tools+=("curl")
    else
        log_success "curl utility detected"
    fi

    # Report missing tools
    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "CRITICAL: Required system tools not found:"
        for tool in "${missing_tools[@]}"; do
            echo "   - $tool"
        done
        echo ""
        log_info "Install missing tools and re-execute this script."
        exit 1
    fi

    log_success "All system prerequisites verified"
}

# Setup Go dependencies
setup_go_dependencies() {
    log_header "GO RUNTIME DEPENDENCY INITIALIZATION"

    if [ ! -d "$API_DIR" ]; then
        log_warning "API directory not found at $API_DIR - aborting Go initialization"
        return
    fi

    cd "$API_DIR"

    # Check if go.mod exists
    if [ ! -f "go.mod" ]; then
        log_warning "go.mod manifest not found in API directory - aborting Go initialization"
        return
    fi

    log_info "Initiating Go module dependency acquisition..."

    # Try to download dependencies with retry logic
    local max_attempts=3
    local attempt=1
    while [ $attempt -le $max_attempts ]; do
        log_info "Attempt $attempt/$max_attempts: Executing go mod download..."

        if go mod download 2>/dev/null; then
            log_success "Go module dependencies acquired successfully"
            break
        else
            log_warning "Attempt $attempt failed - retrying..."

            if [ $attempt -eq $max_attempts ]; then
                log_error "CRITICAL: Go dependency acquisition failed after $max_attempts attempts"
                log_info "Manual intervention required: execute 'go mod download' in api/ directory"
                return 1
            fi

            sleep 2
            ((attempt++))
        fi
    done

    # Check if we can build the project
    log_info "Executing Go build verification..."
    if go build -o /tmp/caf-api-test ./cmd/server 2>/dev/null; then
        log_success "Go application build verification successful"
        rm -f /tmp/caf-api-test
    else
        log_warning "Go build verification failed - dependency integrity compromised"
    fi

    cd "$PROJECT_ROOT"
}

# Setup Node.js dependencies with error handling
setup_nodejs_dependencies() {
    local component_name="$1"
    local component_dir="$2"
    local package_file="$3"

    log_header "NODE.JS DEPENDENCY INITIALIZATION: $component_name"

    if [ ! -d "$component_dir" ]; then
        log_warning "$component_name directory not found at $component_dir - aborting initialization"
        return
    fi

    cd "$component_dir"

    # Check if package.json exists
    if [ ! -f "$package_file" ]; then
        log_warning "$package_file manifest not found in $component_name directory - aborting initialization"
        return
    fi

    # Check if node_modules already exists and is up to date
    if [ -d "node_modules" ] && [ -f "package-lock.json" ]; then
        log_info "Verifying $component_name dependency status..."

        # Use npm outdated to check if updates are needed
        if npm outdated >/dev/null 2>&1; then
            log_info "Dependency updates detected, proceeding with reinstallation..."
        else
            log_success "$component_name dependencies verified and current"
            cd "$PROJECT_ROOT"
            return
        fi
    fi

    # Clean install with retry logic
    local max_attempts=3
    local attempt=1
    while [ $attempt -le $max_attempts ]; do
        log_info "Attempt $attempt/$max_attempts: Executing $component_name dependency installation..."

        # Clear npm cache if this isn't the first attempt
        if [ $attempt -gt 1 ]; then
            log_info "Purging npm cache..."
            npm cache clean --force >/dev/null 2>&1 || true
        fi

        # Try to install dependencies
        if npm install --no-audit --no-fund 2>/dev/null; then
            log_success "$component_name dependencies installed successfully"
            break
        else
            log_warning "Attempt $attempt failed - retry protocol initiated"

            if [ $attempt -eq $max_attempts ]; then
                log_error "CRITICAL: $component_name dependency installation failed after $max_attempts attempts"
                log_info "Manual intervention required: execute 'npm install' in $component_name/ directory"
                log_info "Troubleshooting procedures:"
                echo "  - Verify network connectivity"
                echo "  - Execute: npm cache clean --force"
                echo "  - Remove node_modules directory and retry"
                return 1
            fi

            # Wait before retry with exponential backoff
            sleep $((attempt * 2))
            ((attempt++))
        fi
    done

    # Verify installation
    if [ -d "node_modules" ] && npm list --depth=0 >/dev/null 2>&1; then
        log_success "$component_name dependency integrity verified"
    else
        log_warning "$component_name dependency verification failed"
    fi

    cd "$PROJECT_ROOT"
}

# Setup environment files
setup_environment_files() {
    log_header "ENVIRONMENT CONFIGURATION DEPLOYMENT"

    # API environment file
    if [ -f "api/env.development" ] && [ ! -f "api/.env" ]; then
        cp api/env.development api/.env
        log_success "API environment configuration deployed"
    elif [ -f "api/.env" ]; then
        log_success "API environment configuration verified"
    else
        log_warning "API environment template not found"
    fi

    # Admin Portal environment file
    if [ -f "admin-portal/env.development" ] && [ ! -f "admin-portal/.env.local" ]; then
        cp admin-portal/env.development admin-portal/.env.local
        log_success "Admin Portal environment configuration deployed"
    elif [ -f "admin-portal/.env.local" ]; then
        log_success "Admin Portal environment configuration verified"
    else
        log_warning "Admin Portal environment template not found"
    fi

    # Marketing environment file
    if [ -f "marketing/env.development" ] && [ ! -f "marketing/.env" ]; then
        cp marketing/env.development marketing/.env
        log_success "Marketing Site environment configuration deployed"
    elif [ -f "marketing/.env" ]; then
        log_success "Marketing Site environment configuration verified"
    else
        log_warning "Marketing Site environment template not found"
    fi
}

# Check network connectivity
check_network_connectivity() {
    log_header "NETWORK CONNECTIVITY VERIFICATION"

    local test_urls=("https://registry.npmjs.org" "https://proxy.golang.org")

    for url in "${test_urls[@]}"; do
        log_info "Testing connection to $url..."
        if curl -f --max-time 10 --silent "$url" >/dev/null 2>&1; then
            log_success "Connection to $url established"
        else
            log_warning "Connection to $url failed - network protocol may impact dependency acquisition"
        fi
    done
}

# Main setup function
main() {
    log_header "CAF DEPENDENCY INITIALIZATION"
    log_info "Initializing dependencies for CAF system components..."
    echo ""

    # Change to project root
    cd "$PROJECT_ROOT"

    # Check network connectivity first
    check_network_connectivity
    echo ""

    # Check prerequisites
    check_prerequisites
    echo ""

    # Setup environment files
    setup_environment_files
    echo ""

    # Setup Go dependencies
    if setup_go_dependencies; then
        log_success "Go backend dependencies initialization completed"
    else
        log_warning "Go backend dependencies initialization encountered issues"
    fi
    echo ""

    # Setup Node.js dependencies for each component
    local setup_results=()

    if setup_nodejs_dependencies "Admin Portal" "$ADMIN_PORTAL_DIR" "package.json"; then
        setup_results+=("[OK] Admin Portal")
    else
        setup_results+=("[FAIL] Admin Portal")
    fi

    if [ -d "$MARKETING_DIR" ]; then
        if setup_nodejs_dependencies "Marketing Site" "$MARKETING_DIR" "package.json"; then
            setup_results+=("[OK] Marketing Site")
        else
            setup_results+=("[FAIL] Marketing Site")
        fi
    else
        setup_results+=("[SKIP] Marketing Site (directory not found)")
    fi

    if [ -d "$TESTING_DIR" ]; then
        if setup_nodejs_dependencies "Testing Suite" "$TESTING_DIR" "package.json"; then
            setup_results+=("[OK] Testing Suite")
        else
            setup_results+=("[FAIL] Testing Suite")
        fi
    else
        setup_results+=("[SKIP] Testing Suite (directory not found)")
    fi

    # Final status
    log_header "DEPENDENCY INITIALIZATION COMPLETE"

    echo ""
    echo "DEPLOYMENT STATUS REPORT:"
    for result in "${setup_results[@]}"; do
        echo "   $result"
    done

    echo ""
    log_success "All system dependencies have been processed."
    echo ""
    echo "OPERATIONAL PROCEDURES:"
    echo "   EXECUTE: docker-compose up -d"
    echo "   EXECUTE: cd admin-portal && npm run dev"
    if [ -d "$MARKETING_DIR" ]; then
        echo "   EXECUTE: cd marketing && npm run dev"
    fi
    echo ""
    echo "SERVICE ENDPOINTS (POST-DEPLOYMENT):"
    echo "   Admin Portal: http://localhost:3000"
    echo "   API Gateway: http://localhost:8080"
    if [ -d "$MARKETING_DIR" ]; then
        echo "   Marketing Site: http://localhost:5173"
    fi
    echo ""
    echo "DEFAULT CREDENTIALS:"
    echo "   Username: admin@caf.org"
    echo "   Password: admin123"
}

# Cleanup function
cleanup() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        log_error "EXECUTION TERMINATED: Exit code $exit_code"
        log_info "Protocol supports re-execution - designed for idempotent operation"
    fi
    exit $exit_code
}

# Set trap for cleanup
trap cleanup EXIT

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            echo "CAF DEPENDENCY INITIALIZATION PROTOCOL"
            echo ""
            echo "EXECUTION: $0 [OPTIONS]"
            echo ""
            echo "PARAMETERS:"
            echo "  --help, -h         Display operational instructions"
            echo "  --verbose, -v      Enable detailed reporting mode"
            echo ""
            echo "SYSTEM COMPONENTS TARGETED:"
            echo "  - Go backend API dependencies"
            echo "  - Node.js Admin Portal dependencies"
            echo "  - Node.js Marketing Site dependencies (conditional)"
            echo "  - Node.js Testing Suite dependencies (conditional)"
            echo ""
            echo "PROTOCOL FEATURES: Edge case handling, idempotent execution."
            exit 0
            ;;
        --verbose|-v)
            set -x
            shift
            ;;
        *)
            log_error "INVALID PARAMETER: $1"
            echo "Execute with --help for operational instructions."
            exit 1
            ;;
    esac
done

# Run main setup
main "$@"
