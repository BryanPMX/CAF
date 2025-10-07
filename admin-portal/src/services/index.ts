// admin-portal/src/services/index.ts
// Centralized Service Layer Export

// Export all service classes and their methods
export * from './caseService';
export * from './appointmentService';
export * from './userService';
export * from './officeService';
export * from './taskService';
export * from './recordService';
export * from './reportService';
export * from './documentService';
export * from './commentService';

// Export shared utilities
export * from './endpointResolver';

// Re-export types for convenience
export type { UserRole, Case, CaseDetails, Appointment, User, Office, Task, PaginatedResponse, EnhancedPaginatedResponse, SearchFilters } from '@/app/lib/types';
