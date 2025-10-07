// admin-portal/src/services/documentService.ts
// Centralized Document Data Access Layer

import { apiClient } from '@/app/lib/api';
import { UserRole } from '@/app/lib/types';
import { EndpointResolver } from './endpointResolver';

// Type definitions for better type safety
export interface DocumentUploadResponse {
  success: boolean;
  message: string;
  documentId: string;
  eventId: string;
}

export interface DocumentData {
  id: string;
  fileName: string;
  fileUrl: string;
  visibility: string;
  uploadedBy: string;
  uploadedAt: string;
}


/**
 * Centralized service for all document-related data operations
 * Implements role-based endpoint routing to ensure correct API access
 * Follows Single Responsibility Principle by focusing only on document operations
 */
export class DocumentService {
  /**
   * Upload a document for a case
   * @param userRole - The role of the current user
   * @param caseId - The ID of the case
   * @param file - The file to upload
   * @param visibility - The visibility level of the document
   * @returns Promise<DocumentUploadResponse>
   */
  static async uploadDocument(
    userRole: UserRole,
    caseId: string,
    file: File,
    visibility: string = 'internal'
  ): Promise<DocumentUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('visibility', visibility);

    const endpoint = EndpointResolver.getCaseEndpoint(userRole, 'documents', caseId);

    const response = await apiClient.post(endpoint, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  /**
   * Get a document by event ID
   * @param userRole - The role of the current user
   * @param eventId - The ID of the document event
   * @returns Promise<DocumentData>
   */
  static async getDocument(
    userRole: UserRole,
    eventId: string
  ): Promise<DocumentData> {
    const endpoint = EndpointResolver.getResourceEndpoint(userRole, 'documents', eventId);

    const response = await apiClient.get(endpoint);
    return response.data;
  }

  /**
   * Update a document
   * @param userRole - The role of the current user
   * @param eventId - The ID of the document event
   * @param updateData - The data to update
   * @returns Promise<DocumentData>
   */
  static async updateDocument(
    userRole: UserRole,
    eventId: string,
    updateData: Partial<DocumentData>
  ): Promise<DocumentData> {
    const endpoint = EndpointResolver.getCaseEndpoint(userRole, 'documents', '', `/${eventId}`);

    const response = await apiClient.put(endpoint, updateData);
    return response.data;
  }

  /**
   * Delete a document
   * @param userRole - The role of the current user
   * @param eventId - The ID of the document event
   * @returns Promise<void>
   */
  static async deleteDocument(
    userRole: UserRole,
    eventId: string
  ): Promise<void> {
    const endpoint = EndpointResolver.getCaseEndpoint(userRole, 'documents', '', `/${eventId}`);

    await apiClient.delete(endpoint);
  }
}

// Export convenience functions for backward compatibility
export const {
  uploadDocument,
  getDocument,
  updateDocument,
  deleteDocument,
} = DocumentService;
