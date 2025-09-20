#!/bin/bash

# CAF System Health Monitor - Fixed Version
# Monitors all health endpoints and sends alerts on failures

set -e

# Configuration
API_BASE="https://api.caf-mexico.org"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"  # Set this environment variable for alerts
EMAIL_ALERT="${EMAIL_ALERT:-}"  # Set this for email alerts

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Health endpoints to check (name:path:expected_time)
HEALTH_ENDPOINTS=(
    "Basic Health:/health:1"
    "Database Ready:/health/ready:2"
    "AWS ALB Health:/health/live:1"
    "Migration Status:/health/migrations:3"
    "S3 Storage:/health/s3:5"
    "Cache System:/health/cache:1"
    "Test Endpoint:/test:1"
)

# Function to send alerts
send_alert() {
    local message="$1"
    local severity="$2"
    
    echo -e "${RED}🚨 ALERT: $message${NC}"
    
    # Send to Slack if webhook is configured
    if [[ -n "$SLACK_WEBHOOK_URL" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🚨 CAF System Alert [$severity]: $message\"}" \
            "$SLACK_WEBHOOK_URL" 2>/dev/null || true
    fi
    
    # Send email if configured
    if [[ -n "$EMAIL_ALERT" ]]; then
        echo "$message" | mail -s "CAF System Alert [$severity]" "$EMAIL_ALERT" 2>/dev/null || true
    fi
}

# Function to check a single endpoint
check_endpoint() {
    local name="$1"
    local path="$2"
    local expected_time="$3"
    local url="$API_BASE$path"
    
    echo -n "Checking $name... "
    
    # Measure response time and get HTTP status
    local start_time=$(date +%s.%N)
    local http_status
    local response
    
    if response=$(curl -f -s -w "%{http_code}" -m 10 "$url" 2>/dev/null); then
        local end_time=$(date +%s.%N)
        local response_time=$(echo "$end_time - $start_time" | bc)
        http_status="${response: -3}"
        local body="${response%???}"
        
        if [[ "$http_status" == "200" ]]; then
            if (( $(echo "$response_time > $expected_time" | bc -l) )); then
                echo -e "${YELLOW}⚠️  SLOW (${response_time}s > ${expected_time}s expected)${NC}"
                send_alert "$name is responding slowly (${response_time}s)" "WARNING"
            else
                echo -e "${GREEN}✅ OK (${response_time}s)${NC}"
            fi
        else
            echo -e "${RED}❌ HTTP $http_status${NC}"
            send_alert "$name returned HTTP $http_status" "ERROR"
            return 1
        fi
    else
        echo -e "${RED}❌ FAILED (Connection/Timeout)${NC}"
        send_alert "$name is unreachable or timed out" "CRITICAL"
        return 1
    fi
    
    return 0
}

# Function to check frontend health
check_frontend() {
    echo -n "Checking Frontend... "
    
    local frontend_url="https://admin.caf-mexico.org"
    local start_time=$(date +%s.%N)
    
    if curl -f -s -m 10 "$frontend_url" > /dev/null 2>&1; then
        local end_time=$(date +%s.%N)
        local response_time=$(echo "$end_time - $start_time" | bc)
        
        if (( $(echo "$response_time > 3" | bc -l) )); then
            echo -e "${YELLOW}⚠️  SLOW (${response_time}s)${NC}"
        else
            echo -e "${GREEN}✅ OK (${response_time}s)${NC}"
        fi
    else
        echo -e "${RED}❌ FAILED${NC}"
        send_alert "Frontend is unreachable" "CRITICAL"
        return 1
    fi
    
    return 0
}

# Function to run comprehensive health check
run_health_check() {
    local failed_count=0
    local total_count=${#HEALTH_ENDPOINTS[@]}
    
    echo "🏥 CAF System Health Check - $(date)"
    echo "=================================================="
    
    # Check API endpoints
    for endpoint_info in "${HEALTH_ENDPOINTS[@]}"; do
        IFS=':' read -r name path expected_time <<< "$endpoint_info"
        if ! check_endpoint "$name" "$path" "$expected_time"; then
            ((failed_count++))
        fi
        sleep 0.5  # Small delay between checks
    done
    
    # Check frontend
    if ! check_frontend; then
        ((failed_count++))
    fi
    ((total_count++))
    
    echo "=================================================="
    
    if [[ $failed_count -eq 0 ]]; then
        echo -e "${GREEN}🎉 All systems healthy! ($total_count/$total_count)${NC}"
    else
        echo -e "${RED}⚠️  $failed_count/$total_count systems have issues${NC}"
        send_alert "$failed_count/$total_count systems have issues" "WARNING"
    fi
    
    return $failed_count
}

# Function to run continuous monitoring
run_continuous_monitoring() {
    local interval=${1:-30}  # Default 30 seconds
    
    echo "🔄 Starting continuous monitoring (every ${interval}s)"
    echo "Press Ctrl+C to stop"
    echo ""
    
    while true; do
        run_health_check
        echo ""
        echo "⏰ Next check in ${interval} seconds..."
        sleep "$interval"
        clear
    done
}

# Function to run quick health check (just basic endpoints)
run_quick_check() {
    echo "⚡ Quick Health Check - $(date)"
    echo "=============================="
    
    local quick_endpoints=("/health" "/health/ready")
    local failed=0
    
    for path in "${quick_endpoints[@]}"; do
        if ! check_endpoint "Quick Check" "$path" "2"; then
            ((failed++))
        fi
    done
    
    if [[ $failed -eq 0 ]]; then
        echo -e "${GREEN}✅ Quick check passed${NC}"
    else
        echo -e "${RED}❌ Quick check failed${NC}"
    fi
    
    return $failed
}

# Function to test specific endpoint with details
test_endpoint() {
    local path="$1"
    local url="$API_BASE$path"
    
    echo "🔍 Testing endpoint: $path"
    echo "URL: $url"
    echo "=============================="
    
    echo "Response Headers:"
    curl -I -s "$url" | head -10
    
    echo ""
    echo "Response Body:"
    curl -s "$url" | jq . 2>/dev/null || curl -s "$url"
    
    echo ""
    echo "Response Time:"
    curl -w "Total: %{time_total}s\nConnect: %{time_connect}s\nSSL: %{time_appconnect}s\n" \
         -o /dev/null -s "$url"
}

# Main script logic
main() {
    case "${1:-health}" in
        "health"|"check")
            run_health_check
            ;;
        "monitor")
            run_continuous_monitoring "${2:-30}"
            ;;
        "quick")
            run_quick_check
            ;;
        "test")
            if [[ -n "$2" ]]; then
                test_endpoint "$2"
            else
                echo "Usage: $0 test <endpoint_path>"
                echo "Example: $0 test /health"
                exit 1
            fi
            ;;
        "help"|"-h"|"--help")
            echo "CAF System Health Monitor"
            echo ""
            echo "Usage: $0 [command] [options]"
            echo ""
            echo "Commands:"
            echo "  health, check     Run full health check (default)"
            echo "  monitor [interval] Run continuous monitoring (default: 30s)"
            echo "  quick            Run quick health check"
            echo "  test <path>      Test specific endpoint with details"
            echo "  help             Show this help message"
            echo ""
            echo "Environment Variables:"
            echo "  SLACK_WEBHOOK_URL  Slack webhook for alerts"
            echo "  EMAIL_ALERT        Email address for alerts"
            echo ""
            echo "Examples:"
            echo "  $0                     # Run health check"
            echo "  $0 monitor 60          # Monitor every 60 seconds"
            echo "  $0 quick               # Quick check"
            echo "  $0 test /health/ready  # Test specific endpoint"
            ;;
        *)
            echo "Unknown command: $1"
            echo "Use '$0 help' for usage information"
            exit 1
            ;;
    esac
}

# Check dependencies
if ! command -v curl &> /dev/null; then
    echo "Error: curl is required but not installed"
    exit 1
fi

if ! command -v bc &> /dev/null; then
    echo "Error: bc is required but not installed"
    exit 1
fi

# Run main function
main "$@"
