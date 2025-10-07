// admin-portal/src/services/commentService.ts
// Centralized Comment Data Access Layer

import { apiClient } from '@/app/lib/api';
import { UserRole } from '@/app/lib/types';
import { EndpointResolver } from './endpointResolver';

// Type definitions for better type safety
export interface CommentCreateRequest {
  comment: string;
  visibility: string;
}

export interface CommentData {
  id: string;
  comment: string;
  visibility: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Centralized service for all comment-related data operations
 * Implements role-based endpoint routing to ensure correct API access
 * Follows Single Responsibility Principle by focusing only on comment operations
 */
export class CommentService {
  /**
   * Create a comment for a case
   * @param userRole - The role of the current user
   * @param caseId - The ID of the case
   * @param commentData - The comment data
   * @returns Promise<CommentData>
   */
  static async createComment(
    userRole: UserRole,
    caseId: string,
    commentData: CommentCreateRequest
  ): Promise<CommentData> {
    const endpoint = EndpointResolver.getCaseEndpoint(userRole, 'comments', caseId);

    const response = await apiClient.post(endpoint, commentData);
    return response.data;
  }

  /**
   * Update a comment
   * @param userRole - The role of the current user
   * @param eventId - The ID of the comment event
   * @param updateData - The data to update
   * @returns Promise<CommentData>
   */
  static async updateComment(
    userRole: UserRole,
    eventId: string,
    updateData: Partial<CommentData>
  ): Promise<CommentData> {
    const endpoint = EndpointResolver.getCaseEndpoint(userRole, 'comments', '', `/${eventId}`);

    const response = await apiClient.put(endpoint, updateData);
    return response.data;
  }

  /**
   * Delete a comment
   * @param userRole - The role of the current user
   * @param eventId - The ID of the comment event
   * @returns Promise<void>
   */
  static async deleteComment(
    userRole: UserRole,
    eventId: string
  ): Promise<void> {
    const endpoint = EndpointResolver.getCaseEndpoint(userRole, 'comments', '', `/${eventId}`);

    await apiClient.delete(endpoint);
  }
}

// Export convenience functions for backward compatibility
export const {
  createComment,
  updateComment,
  deleteComment,
} = CommentService;
