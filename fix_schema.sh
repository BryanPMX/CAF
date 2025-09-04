#!/bin/bash

# Database Schema Fix Script
# This script applies the emergency schema fix to resolve runtime errors

set -e  # Exit on any error

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

# Default values
DB_NAME="caf_system"
DB_USER="user"
DB_HOST="localhost"
DB_PORT="5432"
MIGRATIONS_DIR="api/db/migrations"

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -d, --database NAME    Database name (default: caf_system)"
    echo "  -u, --user NAME        Database user (default: user)"
    echo "  -h, --host HOST        Database host (default: localhost)"
    echo "  -p, --port PORT        Database port (default: 5432)"
    echo "  -m, --migrations DIR   Migrations directory (default: api/db/migrations)"
    echo "  --help                 Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Use defaults"
    echo "  $0 -d my_database -u my_user         # Custom database and user"
    echo "  $0 -h 192.168.1.100 -p 5433          # Custom host and port"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--database)
            DB_NAME="$2"
            shift 2
            ;;
        -u|--user)
            DB_USER="$2"
            shift 2
            ;;
        -h|--host)
            DB_HOST="$2"
            shift 2
            ;;
        -p|--port)
            DB_PORT="$2"
            shift 2
            ;;
        -m|--migrations)
            MIGRATIONS_DIR="$2"
            shift 2
            ;;
        --help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Check if migrations directory exists
if [ ! -d "$MIGRATIONS_DIR" ]; then
    print_error "Migrations directory not found: $MIGRATIONS_DIR"
    exit 1
fi

# Check if required migration files exist
EMERGENCY_FIX="$MIGRATIONS_DIR/0038_fix_missing_columns.sql"
VERIFICATION_SCRIPT="$MIGRATIONS_DIR/verify_schema.sql"

if [ ! -f "$EMERGENCY_FIX" ]; then
    print_error "Emergency fix migration not found: $EMERGENCY_FIX"
    exit 1
fi

if [ ! -f "$VERIFICATION_SCRIPT" ]; then
    print_error "Verification script not found: $VERIFICATION_SCRIPT"
    exit 1
fi

print_status "Starting database schema fix..."
print_status "Database: $DB_NAME"
print_status "User: $DB_USER"
print_status "Host: $DB_HOST:$DB_PORT"
print_status "Migrations directory: $MIGRATIONS_DIR"

# Test database connection
print_status "Testing database connection..."
if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
    print_error "Cannot connect to database. Please check your connection parameters."
    print_error "You may need to set PGPASSWORD environment variable or use .pgpass file."
    exit 1
fi
print_success "Database connection successful"

# Apply emergency fix
print_status "Applying emergency schema fix..."
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$EMERGENCY_FIX"; then
    print_success "Emergency fix applied successfully"
else
    print_error "Failed to apply emergency fix"
    exit 1
fi

# Verify schema
print_status "Verifying schema synchronization..."
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$VERIFICATION_SCRIPT" | grep -q "SCHEMA VERIFICATION PASSED"; then
    print_success "Schema verification passed"
else
    print_warning "Schema verification may have issues. Check the output above for details."
fi

# Final status
print_success "Database schema fix completed!"
print_status "You can now restart your API server."
print_status "The runtime errors should be resolved."

# Optional: Show next steps
echo ""
print_status "Next steps:"
echo "1. Restart your API server"
echo "2. Test the login endpoint: POST /api/v1/login"
echo "3. Test the offices endpoint: GET /api/v1/offices"
echo ""
print_status "If you encounter any issues, check the PostgreSQL logs for detailed error messages."
