# CAF Admin Portal - Frontend Application

This directory contains the Next.js-based admin portal for the Centro de Apoyo para la Familia (CAF) system.

## Architecture Overview

The frontend follows modern React patterns with TypeScript, implementing a service-oriented architecture with dependency injection and clean separation of concerns.

## Directory Structure

```
admin-portal/
├── src/
│   ├── app/                        # Next.js 14 App Router
│   │   ├── (dashboard)/            # Protected dashboard routes
│   │   │   ├── layout.tsx          # Dashboard layout with sidebar, header, auth guard
│   │   │   ├── page.tsx            # Panel de Control - role-based dashboard with stats
│   │   │   ├── components/         # Dashboard-scoped shared components
│   │   │   │   ├── SidebarBrand.tsx     # Sidebar brand logo (brand-only, no text)
│   │   │   │   ├── AppointmentModal.tsx # Multi-step appointment creation wizard
│   │   │   │   ├── EditAppointmentModal.tsx
│   │   │   │   ├── SmartSearchBar.tsx   # Debounced search + filter component
│   │   │   │   └── ...
│   │   │   └── app/                # Main application pages
│   │   │       ├── cases/          # Expedientes - Case management with pagination
│   │   │       ├── appointments/   # Citas - Appointment scheduling with filters
│   │   │       ├── users/          # Usuarios - User management (admin/manager)
│   │   │       ├── offices/        # Oficinas - Office management with staff detail drawer
│   │   │       ├── web-content/    # Gestión de Contenido Web - CMS for marketing site
│   │   │       ├── records/        # Archivos - Archives of completed/deleted cases & appointments
│   │   │       ├── reports/        # Reportes
│   │   │       └── notifications/  # Notificaciones
│   │   ├── login/                  # Authentication page
│   │   ├── lib/                    # Utility libraries
│   │   │   ├── api.ts              # Axios HTTP client with JWT interceptors
│   │   │   ├── config.ts           # Centralized app configuration
│   │   │   ├── types.ts            # TypeScript type definitions
│   │   │   └── caseTaxonomy.ts     # Case type→department mapping
│   │   ├── components/             # Global components (ErrorBoundary, ClientOnly)
│   │   ├── layout.tsx              # Root layout
│   │   └── globals.css             # Global styles + Tailwind
│   ├── config/                     # Centralized configuration
│   │   ├── roles.ts                # RBAC roles, permissions, navigation items
│   │   └── statuses.ts             # Case/appointment status definitions
│   ├── context/                    # React Context providers
│   │   ├── AuthContext.tsx          # Authentication state (JWT, user profile)
│   │   └── NotificationContext.tsx  # Notification system
│   ├── hooks/                      # Custom React hooks
│   │   ├── useHydrationSafe.ts     # SSR-safe hydration hook
│   │   ├── useWebSocket.ts         # WebSocket real-time connection
│   │   └── useIsomorphicLayoutEffect.ts
│   ├── services/                   # Service layer (role-based API routing)
│   │   ├── caseService.ts          # Case CRUD with endpoint resolution
│   │   ├── appointmentService.ts   # Appointment CRUD
│   │   ├── recordService.ts        # Archive operations (stats, restore, delete)
│   │   ├── officeService.ts        # Office CRUD
│   │   ├── userService.ts          # User management
│   │   └── index.ts                # Barrel exports
│   ├── interfaces/                 # TypeScript interfaces for DI
│   └── middleware.ts               # Next.js route protection middleware
├── public/
│   └── logo.png                    # Brand logo
└── package.json
```

## Key Components

### 1. App Router Structure (`src/app/`)

**Route Groups**: Uses Next.js route groups for logical organization
- `(dashboard)` - Protected routes requiring authentication
- Route-based code splitting for optimal performance

**Layout System**:
- Root layout provides global context and styling
- Dashboard layout includes navigation and authentication guards
- Nested layouts for section-specific UI

### 2. Authentication System (`src/context/AuthContext.tsx`)

**State Management**:
- JWT token persistence in localStorage
- User profile caching
- Automatic token refresh logic
- Role-based permission checks

**Security Features**:
- Automatic logout on token expiration
- Secure token storage and retrieval
- Cross-tab synchronization

### 3. API Integration (`src/lib/api.ts`)

**HTTP Client Configuration**:
- Axios-based HTTP client
- Automatic JWT token injection
- Request/response interceptors
- Error handling and retry logic

**API Structure**:
- RESTful endpoint organization
- Consistent error response handling
- Request caching strategies

### 4. Component Architecture

**Service-Oriented Components**:
- Business logic separated from UI
- Dependency injection through custom hooks
- Consistent error handling patterns

**Form Management**:
- React Hook Form for complex forms
- Zod schema validation
- Real-time validation feedback

### 5. State Management Strategy

**Context + Hooks Pattern**:
- React Context for global state
- Custom hooks for domain-specific logic
- Server-state management with SWR/React Query (future)

**Authentication Flow**:
1. Login form collects credentials
2. API call validates credentials
3. JWT token stored in localStorage
4. AuthContext updated with user data
5. Protected routes become accessible

## Development Workflow

### Local Development Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Access at http://localhost:3000
```

### Build Process

```bash
# Production build
npm run build

# Start production server
npm start

# Type checking
npm run type-check

# Linting
npm run lint
```

### Environment Configuration

**`.env.local`** (and on Vercel use the same names):
```env
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws
NEXT_PUBLIC_ENV=development
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

## Key Design Patterns

### Component Composition
- Higher-order components for cross-cutting concerns
- Render props for flexible component behavior
- Compound components for related UI elements

### Custom Hooks
- `useAuth()` - Authentication state and actions
- `useWebSocket()` - Real-time communication
- `useHydrationSafe()` - SSR-safe state management

### Error Boundaries
- Global error catching for React errors
- Graceful degradation with fallback UI
- Error reporting and logging

## Security Implementation

### Client-Side Security
- JWT token automatic inclusion in requests
- Secure token storage (localStorage with httpOnly consideration)
- XSS prevention through React's built-in sanitization
- CSRF protection via same-origin requests

### Authentication Guards
- Route-level protection in layout components
- Component-level permission checks
- Automatic redirect on authentication failure

## Performance Optimizations

### Code Splitting
- Route-based code splitting via Next.js App Router
- Dynamic imports for heavy components
- Tree shaking for unused dependencies

### Caching Strategy
- Browser caching for static assets
- API response caching with appropriate TTL
- Service worker for offline functionality (future)

### Bundle Optimization
- Optimized imports and tree shaking
- Image optimization with Next.js Image component
- Font loading optimization

## Testing Strategy

### Unit Tests
```bash
npm run test:unit
# Tests for hooks, utilities, and components
```

### Integration Tests
```bash
npm run test:integration
# API integration and component interaction tests
```

### E2E Tests
```bash
npm run test:e2e
# Full user journey tests with Playwright/Cypress
```

## Build and Deployment

### CI/CD Pipeline
- Automated testing on pull requests
- Type checking and linting
- Bundle size monitoring
- Performance regression testing

### Docker Integration
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

This frontend architecture provides a scalable, maintainable, and performant foundation for the CAF administrative interface, with strong emphasis on developer experience, security, and user experience.