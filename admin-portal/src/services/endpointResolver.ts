// admin-portal/src/services/endpointResolver.ts
// Shared endpoint resolver utility following DRY principles

import { UserRole } from '@/app/lib/types';

/**
 * Generic endpoint resolver for role-based API routing
 * Follows Single Responsibility Principle by handling only routing logic
 * Follows Open/Closed Principle by being easily extensible for new roles
 */
export class EndpointResolver {
  private static readonly ROLE_ENDPOINT_MAP = {
    admin: {
      prefix: '/admin',
    },
    office_manager: {
      prefix: '/manager',
    },
    default: {
      prefix: '', // Staff and other roles use protected routes (no prefix)
    },
  } as const;

  /**
   * Get the appropriate API prefix for a user role
   * @param userRole - The role of the current user
   * @returns The API prefix for the role
   */
  private static getRolePrefix(userRole: UserRole): string {
    const roleConfig = this.ROLE_ENDPOINT_MAP[userRole as keyof typeof this.ROLE_ENDPOINT_MAP] || this.ROLE_ENDPOINT_MAP.default;
    return roleConfig.prefix;
  }

  /**
   * Build a case-related endpoint
   * @param userRole - The role of the current user
   * @param operation - The operation (documents, comments, etc.)
   * @param caseId - The case ID
   * @param additionalPath - Additional path parameters
   * @returns The complete endpoint URL
   */
  static getCaseEndpoint(
    userRole: UserRole,
    operation: string,
    caseId: string,
    additionalPath: string = ''
  ): string {
    const prefix = this.getRolePrefix(userRole);
    return `${prefix}/cases/${caseId}/${operation}${additionalPath}`;
  }

  /**
   * Build a general endpoint
   * @param userRole - The role of the current user
   * @param resource - The resource name
   * @param resourceId - The resource ID
   * @param additionalPath - Additional path parameters
   * @returns The complete endpoint URL
   */
  static getResourceEndpoint(
    userRole: UserRole,
    resource: string,
    resourceId: string,
    additionalPath: string = ''
  ): string {
    const prefix = this.getRolePrefix(userRole);
    return `${prefix}/${resource}/${resourceId}${additionalPath}`;
  }

  /**
   * Build a task-related endpoint
   * @param userRole - The role of the current user
   * @param operation - The operation (comments, etc.)
   * @param taskId - The task ID
   * @param additionalPath - Additional path parameters
   * @returns The complete endpoint URL
   */
  static getTaskEndpoint(
    userRole: UserRole,
    operation: string,
    taskId: string,
    additionalPath: string = ''
  ): string {
    const prefix = this.getRolePrefix(userRole);
    return `${prefix}/${operation}/${taskId}${additionalPath}`;
  }
}
