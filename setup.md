# CAF System - Appointments Section Setup Guide

## Issues Found and Fixed

### 1. ✅ Missing dayjs dependency
- **Issue**: The `dayjs` library was imported but not installed
- **Fix**: Added `dayjs: "^1.11.10"` to package.json dependencies
- **Action**: Run `npm install` to install the dependency

### 2. ✅ Incorrect API payload field
- **Issue**: AppointmentModal was sending `appointmentTitle` instead of `title`
- **Fix**: Updated the payload to use the correct field name
- **Location**: `admin-portal/src/app/(dashboard)/components/AppointmentModal.tsx`

### 3. ⚠️ Environment Variables Required
The application needs these environment variables to run:

```bash
# Database Configuration
DB_USER=caf_user
DB_PASSWORD=caf_password
DB_HOST=localhost
DB_NAME=caf_db
DB_PORT=5432

# Server Configuration
PORT=8080
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Frontend Configuration
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
```

### 4. ⚠️ Database Setup Required
- PostgreSQL database needs to be running
- Database should be accessible at localhost:5432
- Database user and database should exist

## Quick Setup Steps

1. **Install Dependencies**:
   ```bash
   cd admin-portal
   npm install
   ```

2. **Set Environment Variables**:
   Create a `.env` file in the root directory with the variables above

3. **Start Database**:
   ```bash
   # Option 1: Using Docker
   docker-compose up -d db
   
   # Option 2: Install PostgreSQL locally
   # Create database and user manually
   ```

4. **Start API Server**:
   ```bash
   cd api
   go run cmd/server/main.go
   ```

5. **Start Admin Portal**:
   ```bash
   cd admin-portal
   npm run dev
   ```

## API Endpoints for Appointments

- `GET /api/v1/appointments` - Get all appointments (protected)
- `POST /api/v1/admin/appointments` - Create appointment (admin only)
- `PATCH /api/v1/admin/appointments/:id` - Update appointment (admin only)
- `DELETE /api/v1/admin/appointments/:id` - Delete appointment (admin only)

## Testing the Appointments Section

1. Navigate to the admin portal
2. Login with admin credentials
3. Go to the Appointments section
4. Try creating a new appointment using the "Programar Cita" button
5. Verify that appointments are displayed in the table

## Common Issues and Solutions

### "dayjs is not defined" error
- Run `npm install` in the admin-portal directory

### "Failed to fetch appointments" error
- Check if the API server is running
- Verify database connection
- Check environment variables

### "Authorization header is required" error
- Make sure you're logged in to the admin portal
- Check if the JWT token is being sent correctly

### Database connection errors
- Verify PostgreSQL is running
- Check database credentials in environment variables
- Ensure database and user exist 