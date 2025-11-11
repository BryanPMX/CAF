// admin-portal/src/services/userService.ts
import { ApiClient } from '@/interfaces/api';
import { IUserService } from '@/interfaces/services';

export class UserService implements IUserService {
  constructor(private apiClient: ApiClient) {}

  // Static methods for backward compatibility when imported as class
  static async fetchUsers(userRole?: string, params?: any) {
    console.log('Static legacy fetchUsers called with:', userRole, params);
    return { data: [], pagination: { total: 0, page: 1, pageSize: 20 } };
  }

  // Backward compatibility methods
  async fetchUsers(params?: any) {
    console.log('Legacy fetchUsers called with:', params);
    return { data: [], pagination: { total: 0, page: 1, pageSize: 20 } };
  }

  async getCurrentUser(): Promise<any> {
    // TODO: Implement
    throw new Error('Not implemented');
  }

  async updateProfile(updates: any): Promise<any> {
    // TODO: Implement
    throw new Error('Not implemented');
    }

  async getUsers(params?: any): Promise<any> {
    // TODO: Implement
    return { data: [], pagination: { total: 0, page: 1, pageSize: 20 } };
  }

  async createUser(userData: any): Promise<any> {
    // TODO: Implement
    throw new Error('Not implemented');
    }

  async updateUser(id: string, updates: any): Promise<any> {
    // TODO: Implement
    throw new Error('Not implemented');
  }

  async deleteUser(id: string): Promise<void> {
    // TODO: Implement
    throw new Error('Not implemented');
    }
}

// Legacy service instance for backward compatibility
const legacyUserService = {
  fetchUsers: async (params?: any) => {
    console.log('Legacy fetchUsers called with:', params);
    return { data: [], pagination: { total: 0, page: 1, pageSize: 20 } };
  }
};

// Default export for backward compatibility
export default legacyUserService;