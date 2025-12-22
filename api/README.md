# CAF API - Backend Service

This directory contains the Go-based backend API for the Centro de Apoyo para la Familia (CAF) system.

## Architecture Overview

The API follows Clean Architecture principles with SOLID design patterns implemented through:

- **Dependency Injection**: Service container pattern in `container/container.go`
- **Repository Pattern**: Data access abstraction in `repositories/`
- **Service Layer**: Business logic encapsulation in `services/`
- **HTTP Handlers**: Request/response handling in `handlers/`

## Directory Structure

```
api/
├── cmd/server/           # Application entry point
│   └── main.go          # Server initialization and routing
├── config/              # Configuration management
│   └── config.go        # Environment-based configuration
├── container/           # Dependency injection
│   └── container.go     # Service container setup
├── db/                  # Database layer
│   ├── migrations/      # Database schema migrations
│   └── postgres.go      # Database connection and setup
├── handlers/            # HTTP request handlers
│   ├── auth.go         # Authentication endpoints
│   ├── cases.go        # Case management endpoints
│   ├── appointments.go # Appointment scheduling endpoints
│   └── users.go        # User management endpoints
├── middleware/          # Cross-cutting concerns
│   ├── auth.go         # JWT authentication middleware
│   ├── cors.go         # CORS handling
│   └── logging.go      # Request logging
├── models/             # Data models (GORM structs)
│   ├── user.go         # User entity
│   ├── case.go         # Case entity
│   ├── appointment.go  # Appointment entity
│   └── office.go       # Office entity
├── repositories/       # Data access layer
│   ├── user_repository.go      # User data operations
│   ├── case_repository.go      # Case data operations
│   ├── appointment_repository.go # Appointment data operations
│   └── office_repository.go     # Office data operations
├── services/           # Business logic layer
│   ├── user_service.go      # User business operations
│   ├── case_service.go      # Case business operations
│   ├── appointment_service.go # Appointment business operations
│   └── dashboard_service.go # Dashboard metrics
└── utils/              # Utility functions
    ├── validation.go   # Input validation helpers
    └── security.go     # Security utilities
```

## Key Components

### 1. Server Initialization (`cmd/server/main.go`)
- Sets up Gin HTTP server
- Configures middleware stack
- Defines API routes
- Handles graceful shutdown

### 2. Configuration (`config/config.go`)
- Environment variable management
- Database connection settings
- JWT secret configuration
- CORS policy setup

### 3. Database Layer (`db/`)
- PostgreSQL connection management
- Schema migrations with version control
- Connection pooling configuration

### 4. Authentication (`handlers/auth.go`, `middleware/auth.go`)
- JWT token generation and validation
- Password hashing with bcrypt
- Role-based access control
- Session management

### 5. Business Logic (`services/`)
- Case assignment and workflow management
- Appointment scheduling with conflict detection
- User role and permission management
- Dashboard metrics calculation

### 6. Data Access (`repositories/`)
- GORM-based database operations
- Query optimization and indexing
- Transaction management
- Audit logging integration

## API Endpoints

### Authentication
- `POST /api/v1/login` - User authentication
- `GET /api/v1/profile` - Get current user profile

### Cases Management
- `GET /api/v1/cases` - List cases with filtering
- `POST /api/v1/cases` - Create new case
- `GET /api/v1/cases/:id` - Get case details
- `PUT /api/v1/cases/:id` - Update case
- `DELETE /api/v1/cases/:id` - Delete case

### Appointments
- `GET /api/v1/appointments` - List appointments
- `POST /api/v1/appointments` - Schedule appointment
- `PUT /api/v1/appointments/:id` - Update appointment
- `DELETE /api/v1/appointments/:id` - Cancel appointment

### Users (Admin Only)
- `GET /api/v1/users` - List users
- `POST /api/v1/users` - Create user
- `PUT /api/v1/users/:id` - Update user
- `DELETE /api/v1/users/:id` - Delete user

## Development Setup

```bash
# Install dependencies
go mod download

# Run with environment variables
export DB_HOST=localhost
export DB_USER=caf_user
export DB_PASSWORD=caf_password
export JWT_SECRET=your_secret_key

# Start server
go run cmd/server/main.go
```

## Key Design Patterns

### SOLID Principles Implementation
- **Single Responsibility**: Each service handles one business domain
- **Open/Closed**: New features added without modifying existing code
- **Liskov Substitution**: Compatible interfaces across implementations
- **Interface Segregation**: Client-specific interfaces in repositories
- **Dependency Inversion**: Dependencies injected through container

### Clean Architecture Layers
1. **Entities** (models): Core business objects
2. **Use Cases** (services): Application business rules
3. **Interface Adapters** (handlers): Convert data between layers
4. **Frameworks & Drivers** (repositories): External concerns

### Security Features
- JWT authentication with configurable expiration
- Password hashing with bcrypt
- Role-based access control (RBAC)
- Input validation and sanitization
- SQL injection prevention through GORM
- CORS protection
- Rate limiting middleware

This backend provides a scalable, secure, and maintainable foundation for the CAF case management system.