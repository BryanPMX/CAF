#!/bin/bash

echo "CAF Appointment Category Migration Script"
echo "=========================================="
echo ""
echo "This script will fix existing appointment category/department data."
echo ""

# Get JWT token from user
echo "Please provide your JWT token from the admin portal:"
echo "(Get it from: Dev Tools > Application > Local Storage > authToken)"
echo ""
read -p "JWT Token: " JWT_TOKEN

if [ -z "$JWT_TOKEN" ]; then
    echo "❌ No JWT token provided. Exiting."
    exit 1
fi

echo ""
echo "🔄 Running migration..."

# Run the migration
curl -X POST 'http://localhost:8080/api/v1/admin/appointments/fix-categories' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -w "\nStatus: %{http_code}\n"

echo ""
echo "✅ Migration completed!"
echo "Now refresh your appointments page and try the category filter."
