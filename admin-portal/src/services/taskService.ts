// admin-portal/src/services/taskService.ts
// Centralized Task Data Access Layer

import { apiClient } from '@/app/lib/api';
import { UserRole, Task, PaginatedResponse, SearchFilters } from '@/app/lib/types';

/**
 * Centralized service for all task-related data operations
 * Implements role-based endpoint routing to ensure correct API access
 */
export class TaskService {
  /**
   * Fetch tasks based on user role
   * @param userRole - The role of the current user
   * @param params - Query parameters for filtering and pagination
   * @returns Promise<PaginatedResponse<Task>>
   */
  static async fetchTasks(
    userRole: UserRole,
    params: {
      page?: number;
      pageSize?: number;
      search?: string;
      filters?: SearchFilters;
    } = {}
  ): Promise<PaginatedResponse<Task>> {
    const { page = 1, pageSize = 20, search, filters = {} } = params;
    
    // Build query parameters
    const queryParams = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
      ...(search && { search }),
      ...(filters.status && { status: filters.status }),
      ...(filters.assignedTo && { assignedTo: filters.assignedTo.toString() }),
      ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
      ...(filters.dateTo && { dateTo: filters.dateTo }),
    });

    // Determine endpoint based on role
    let endpoint: string;
    
    if (userRole === 'admin') {
      endpoint = `/admin/tasks?${queryParams}`;
    } else {
      endpoint = `/tasks?${queryParams}`;
    }

    const response = await apiClient.get(endpoint);
    // Admin optimized endpoints wrap data in a data property
    return response.data;
  }

  /**
   * Fetch a specific task by ID
   * @param userRole - The role of the current user
   * @param taskId - The ID of the task to fetch
   * @returns Promise<Task>
   */
  static async fetchTaskById(
    userRole: UserRole,
    taskId: string
  ): Promise<Task> {
    // Determine endpoint based on role
    let endpoint: string;
    
    if (userRole === 'admin') {
      endpoint = `/admin/tasks/${taskId}`;
    } else {
      endpoint = `/tasks/${taskId}`;
    }

    const response = await apiClient.get(endpoint);
    // Admin optimized endpoints wrap data in a data property
    return response.data;
  }

  /**
   * Create a new task
   * @param userRole - The role of the current user
   * @param taskData - The task data to create
   * @returns Promise<Task>
   */
  static async createTask(
    userRole: UserRole,
    taskData: Partial<Task>
  ): Promise<Task> {
    // Determine endpoint based on role
    let endpoint: string;
    
    if (userRole === 'admin') {
      endpoint = '/admin/tasks';
    } else {
      endpoint = '/tasks';
    }

    const response = await apiClient.post(endpoint, taskData);
    return response.data;
  }

  /**
   * Update an existing task
   * @param userRole - The role of the current user
   * @param taskId - The ID of the task to update
   * @param taskData - The updated task data
   * @returns Promise<Task>
   */
  static async updateTask(
    userRole: UserRole,
    taskId: string,
    taskData: Partial<Task>
  ): Promise<Task> {
    // Determine endpoint based on role
    let endpoint: string;
    
    if (userRole === 'admin') {
      endpoint = `/admin/tasks/${taskId}`;
    } else {
      endpoint = `/tasks/${taskId}`;
    }

    const response = await apiClient.patch(endpoint, taskData);
    return response.data;
  }

  /**
   * Delete a task
   * @param userRole - The role of the current user
   * @param taskId - The ID of the task to delete
   * @returns Promise<void>
   */
  static async deleteTask(
    userRole: UserRole,
    taskId: string
  ): Promise<void> {
    // Determine endpoint based on role
    let endpoint: string;
    
    if (userRole === 'admin') {
      endpoint = `/admin/tasks/${taskId}`;
    } else {
      endpoint = `/tasks/${taskId}`;
    }

    await apiClient.delete(endpoint);
  }

  /**
   * Fetch tasks assigned to the current user
   * @param userRole - The role of the current user
   * @param params - Query parameters for filtering and pagination
   * @returns Promise<PaginatedResponse<Task>>
   */
  static async fetchMyTasks(
    userRole: UserRole,
    params: {
      page?: number;
      pageSize?: number;
      search?: string;
      filters?: SearchFilters;
    } = {}
  ): Promise<PaginatedResponse<Task>> {
    const { page = 1, pageSize = 20, search, filters = {} } = params;
    
    // Build query parameters
    const queryParams = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
      ...(search && { search }),
      ...(filters.status && { status: filters.status }),
    });

    // All roles use the same endpoint for "my tasks"
    const endpoint = `/tasks/my?${queryParams}`;

    const response = await apiClient.get(endpoint);
    // Admin optimized endpoints wrap data in a data property
    return response.data;
  }

  /**
   * Create a task for a specific case
   * @param userRole - The role of the current user
   * @param caseId - The ID of the case
   * @param taskData - The task data to create
   * @returns Promise<Task>
   */
  static async createTaskForCase(
    userRole: UserRole,
    caseId: string,
    taskData: Partial<Task>
  ): Promise<Task> {
    // Determine endpoint based on role
    let endpoint: string;
    
    if (userRole === 'admin') {
      endpoint = `/admin/cases/${caseId}/tasks`;
    } else {
      endpoint = `/cases/${caseId}/tasks`;
    }

    const response = await apiClient.post(endpoint, taskData);
    return response.data;
  }

  /**
   * Add a comment to a task
   * @param userRole - The role of the current user
   * @param taskId - The ID of the task
   * @param comment - The comment data
   * @returns Promise<any>
   */
  static async addTaskComment(
    userRole: UserRole,
    taskId: string,
    comment: { content: string }
  ): Promise<any> {
    // Determine endpoint based on role
    let endpoint: string;
    
    if (userRole === 'admin') {
      endpoint = `/admin/tasks/${taskId}/comments`;
    } else {
      endpoint = `/tasks/${taskId}/comments`;
    }

    const response = await apiClient.post(endpoint, comment);
    return response.data;
  }

  /**
   * Update a task comment
   * @param userRole - The role of the current user
   * @param taskId - The ID of the task
   * @param commentId - The ID of the comment
   * @param comment - The updated comment data
   * @returns Promise<any>
   */
  static async updateTaskComment(
    userRole: UserRole,
    taskId: string,
    commentId: string,
    comment: { content: string }
  ): Promise<any> {
    // Determine endpoint based on role
    let endpoint: string;
    
    if (userRole === 'admin') {
      endpoint = `/admin/tasks/${taskId}/comments/${commentId}`;
    } else {
      endpoint = `/tasks/${taskId}/comments/${commentId}`;
    }

    const response = await apiClient.put(endpoint, comment);
    return response.data;
  }

  /**
   * Delete a task comment
   * @param userRole - The role of the current user
   * @param taskId - The ID of the task
   * @param commentId - The ID of the comment
   * @returns Promise<void>
   */
  static async deleteTaskComment(
    userRole: UserRole,
    taskId: string,
    commentId: string
  ): Promise<void> {
    // Determine endpoint based on role
    let endpoint: string;
    
    if (userRole === 'admin') {
      endpoint = `/admin/tasks/${taskId}/comments/${commentId}`;
    } else {
      endpoint = `/tasks/${taskId}/comments/${commentId}`;
    }

    await apiClient.delete(endpoint);
  }
}

// Export convenience functions for backward compatibility
export const {
  fetchTasks,
  fetchTaskById,
  createTask,
  updateTask,
  deleteTask,
  fetchMyTasks,
  createTaskForCase,
  addTaskComment,
  updateTaskComment,
  deleteTaskComment,
} = TaskService;
