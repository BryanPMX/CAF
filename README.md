# Centro de Apoyo para la Familia A.C.

This is the official monorepo for the CAF digital platform. The project is under active development.

## 🚀 Quick Start - Testing the System

### Prerequisites

- **Docker & Docker Compose** (for backend services)
- **Node.js 18+** (for admin portal)
- **Flutter SDK** (optional, for mobile app)

### 1. Start Backend Services

```bash
# Clone the repository
git clone <repository-url>
cd "CAF SYSTEM"

# Start backend API, database, and supporting services
docker-compose up -d

# Verify services are running
docker-compose ps
```

**Expected Services:**
- `caf_api` (Go API) - http://localhost:8080
- `caf_postgres` (Database) - localhost:5432
- `caf_localstack` (AWS services simulation)

### 2. Start Admin Portal (Frontend)

```bash
# Navigate to admin portal
cd admin-portal

# Install dependencies
npm install

# Start development server
npm run dev
```

**Access at:** http://localhost:3000

### 3. Test Login

**Default Admin Credentials:**
- **Email:** `admin@caf.org`
- **Password:** `admin123` 

### 4. Verify System Components

After logging in, you should see:

✅ **Dashboard** - Main overview with statistics  
✅ **Cases** - Case management system  
✅ **Appointments** - Appointment scheduling  
✅ **Users** - User management (admin only)  
✅ **Reports** - Analytics and reporting (admin only)  

## 🛠️ Development Setup

### Backend API (Go)

```bash
# If you need to run the API outside Docker
cd api

# Install Go dependencies
go mod download

# Run with environment variables
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=caf_db
export DB_USER=caf_user
export DB_PASSWORD=caf_password
export JWT_SECRET=your_jwt_secret_here

# Start the API
go run cmd/server/main.go
```

### Admin Portal (Next.js)

```bash
cd admin-portal

# Development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run linting
npm run lint
```

### Environment Variables

Create `.env.local` in the admin-portal directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
NEXT_PUBLIC_ENV=development
```

## 🧪 Testing Guide

### 1. Login Flow Test
1. Navigate to http://localhost:3000
2. Should redirect to `/login`
3. Enter admin credentials
4. Should redirect to dashboard

### 2. Dashboard Features Test
- **Statistics Cards** - Should display current system stats
- **Recent Activity** - Should show latest system activity
- **Navigation Menu** - Should show role-appropriate menu items

### 3. Core Functionality Test
- **Cases**: Create, view, edit case records
- **Appointments**: Schedule and manage appointments
- **Users**: Add/edit users (admin only)
- **Reports**: Generate system reports (admin only)

### 4. Authentication Test
- **Role-based Access**: Different roles see different features
- **Session Management**: Logout and re-login works properly
- **Token Persistence**: Refresh page maintains login state

## 🐛 Known Issues & Fixes

### Recently Fixed Issues ✅
- **Infinite Loop after Login** - Fixed by disabling React Strict Mode and optimizing auth flow
- **Authentication Token Sync** - Fixed token key mismatch between auth and notification systems
- **Loading State Hangs** - Eliminated by removing circular dependencies in useEffect hooks
- **Database Schema Mismatch** - Fixed missing columns in case_events table (visibility, comment_text, etc.)
- **Duplicate Migration Systems** - Consolidated two migration directories into unified system
- **File Structure Issues** - Cleaned up unused files, binaries, and implemented proper .gitignore files

### Current Limitations ⚠️
- **Notifications System** - Temporarily disabled to prevent API loops (will be re-enabled)
- **Auto-redirects** - Role-based redirects temporarily simplified
- **Real-time Updates** - Limited during development phase

## 📊 API Endpoints

### Authentication
- `POST /api/v1/login` - User authentication
- `GET /api/v1/profile` - Get user profile

### Dashboard
- `GET /api/v1/dashboard-summary` - Dashboard statistics

### Cases Management
- `GET /api/v1/cases` - List cases
- `POST /api/v1/cases` - Create case
- `GET /api/v1/cases/:id` - Get case details
- `PUT /api/v1/cases/:id` - Update case

### Appointments
- `GET /api/v1/appointments` - List appointments
- `POST /api/v1/appointments` - Create appointment

### Users (Admin Only)
- `GET /api/v1/users` - List users
- `POST /api/v1/users` - Create user

## 🔧 Troubleshooting

### Backend Not Starting
```bash
# Check Docker services
docker-compose logs caf_api
docker-compose logs caf_postgres

# Restart services
docker-compose down
docker-compose up -d
```

### Frontend Issues
```bash
# Clear Next.js cache
cd admin-portal
rm -rf .next
npm run dev
```

### Database Issues
```bash
# Reset database (WARNING: This will delete all data)
docker-compose down -v
docker-compose up -d
```

### Port Conflicts
- **API**: Change port 8080 in `docker-compose.yml`
- **Frontend**: Change port 3000 with `npm run dev -- -p 3001`
- **Database**: Change port 5432 in `docker-compose.yml`

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly using the testing guide above
4. Submit a pull request

## 📝 Development Notes

- **Backend**: Go with Gin framework, PostgreSQL database
- **Frontend**: Next.js 14 with TypeScript, Ant Design components
- **Authentication**: JWT-based with session management
- **State Management**: React hooks with context API
- **Styling**: Tailwind CSS with Ant Design

## 🔒 Security

- JWT tokens with 24-hour expiration
- Role-based access control (RBAC)
- Session management with device tracking
- SQL injection prevention with GORM
- XSS protection with proper input sanitization

**Last Updated:** September, 2025  
**Status:** Active Development - Recently Cleaned & Optimized  
**Contact:** Development Team