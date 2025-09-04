# Database Schema Fix Script (PowerShell Version)
# This script applies the emergency schema fix to resolve runtime errors

param(
    [string]$Database = "caf_system",
    [string]$User = "user",
    [string]$Host = "localhost",
    [string]$Port = "5432",
    [string]$MigrationsDir = "api/db/migrations",
    [switch]$Help
)

# Function to show usage
function Show-Usage {
    Write-Host "Usage: .\fix_schema.ps1 [OPTIONS]" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Yellow
    Write-Host "  -Database NAME    Database name (default: caf_system)" -ForegroundColor White
    Write-Host "  -User NAME        Database user (default: user)" -ForegroundColor White
    Write-Host "  -Host HOST        Database host (default: localhost)" -ForegroundColor White
    Write-Host "  -Port PORT        Database port (default: 5432)" -ForegroundColor White
    Write-Host "  -MigrationsDir DIR Migrations directory (default: api/db/migrations)" -ForegroundColor White
    Write-Host "  -Help             Show this help message" -ForegroundColor White
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Yellow
    Write-Host "  .\fix_schema.ps1                                    # Use defaults" -ForegroundColor White
    Write-Host "  .\fix_schema.ps1 -Database my_database -User my_user" -ForegroundColor White
    Write-Host "  .\fix_schema.ps1 -Host 192.168.1.100 -Port 5433" -ForegroundColor White
}

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Show help if requested
if ($Help) {
    Show-Usage
    exit 0
}

# Check if migrations directory exists
if (-not (Test-Path $MigrationsDir)) {
    Write-Error "Migrations directory not found: $MigrationsDir"
    exit 1
}

# Check if required migration files exist
$EmergencyFix = Join-Path $MigrationsDir "0038_fix_missing_columns.sql"
$VerificationScript = Join-Path $MigrationsDir "verify_schema.sql"

if (-not (Test-Path $EmergencyFix)) {
    Write-Error "Emergency fix migration not found: $EmergencyFix"
    exit 1
}

if (-not (Test-Path $VerificationScript)) {
    Write-Error "Verification script not found: $VerificationScript"
    exit 1
}

Write-Status "Starting database schema fix..."
Write-Status "Database: $Database"
Write-Status "User: $User"
Write-Status "Host: $Host`:$Port"
Write-Status "Migrations directory: $MigrationsDir"

# Test database connection
Write-Status "Testing database connection..."
try {
    $testQuery = "SELECT 1;"
    $testResult = psql -h $Host -p $Port -U $User -d $Database -c $testQuery 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Database connection successful"
    } else {
        throw "Connection failed"
    }
} catch {
    Write-Error "Cannot connect to database. Please check your connection parameters."
    Write-Error "You may need to set PGPASSWORD environment variable or use .pgpass file."
    exit 1
}

# Apply emergency fix
Write-Status "Applying emergency schema fix..."
try {
    psql -h $Host -p $Port -U $User -d $Database -f $EmergencyFix
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Emergency fix applied successfully"
    } else {
        throw "Failed to apply emergency fix"
    }
} catch {
    Write-Error "Failed to apply emergency fix"
    exit 1
}

# Verify schema
Write-Status "Verifying schema synchronization..."
try {
    $verificationOutput = psql -h $Host -p $Port -U $User -d $Database -f $VerificationScript
    if ($verificationOutput -match "SCHEMA VERIFICATION PASSED") {
        Write-Success "Schema verification passed"
    } else {
        Write-Warning "Schema verification may have issues. Check the output above for details."
    }
} catch {
    Write-Warning "Schema verification may have issues. Check the output above for details."
}

# Final status
Write-Success "Database schema fix completed!"
Write-Status "You can now restart your API server."
Write-Status "The runtime errors should be resolved."

# Optional: Show next steps
Write-Host ""
Write-Status "Next steps:"
Write-Host "1. Restart your API server" -ForegroundColor White
Write-Host "2. Test the login endpoint: POST /api/v1/login" -ForegroundColor White
Write-Host "3. Test the offices endpoint: GET /api/v1/offices" -ForegroundColor White
Write-Host ""
Write-Status "If you encounter any issues, check the PostgreSQL logs for detailed error messages."
