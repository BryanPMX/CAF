// admin-portal/src/abstractions/httpClient.ts
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { ApiClient, ApiResponse, RequestConfig, HttpClient, HttpRequestConfig, HttpResponse } from '@/interfaces/api';

// Axios-based HTTP client implementation
export class AxiosHttpClient implements HttpClient {
  private axiosInstance: AxiosInstance;

  constructor(baseURL: string) {
    this.axiosInstance = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for auth token
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Handle unauthorized access
          localStorage.removeItem('authToken');
          localStorage.removeItem('userRole');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  async request<T>(config: HttpRequestConfig): Promise<HttpResponse<T>> {
    const axiosConfig: AxiosRequestConfig = {
      method: config.method,
      url: config.url,
      data: config.data,
      headers: config.headers,
      params: config.params,
      timeout: config.timeout,
    };

    const response: AxiosResponse<T> = await this.axiosInstance.request(axiosConfig);

    return {
      data: response.data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers as Record<string, string>,
    };
  }
}

// API Client implementation using HTTP client
export class ApiClientImpl implements ApiClient {
  constructor(private httpClient: HttpClient) {}

  async get<T>(url: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    const response = await this.httpClient.request<T>({
      method: 'GET',
      url,
      headers: config?.headers,
      params: config?.params,
      timeout: config?.timeout,
    });

    return {
      data: response.data,
      success: response.status >= 200 && response.status < 300,
    };
  }

  async post<T>(url: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    const response = await this.httpClient.request<T>({
      method: 'POST',
      url,
      data,
      headers: config?.headers,
      params: config?.params,
      timeout: config?.timeout,
    });

    return {
      data: response.data,
      success: response.status >= 200 && response.status < 300,
    };
  }

  async put<T>(url: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    const response = await this.httpClient.request<T>({
      method: 'PUT',
      url,
      data,
      headers: config?.headers,
      params: config?.params,
      timeout: config?.timeout,
    });

    return {
      data: response.data,
      success: response.status >= 200 && response.status < 300,
    };
  }

  async patch<T>(url: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    const response = await this.httpClient.request<T>({
      method: 'PATCH',
      url,
      data,
      headers: config?.headers,
      params: config?.params,
      timeout: config?.timeout,
    });

    return {
      data: response.data,
      success: response.status >= 200 && response.status < 300,
    };
  }

  async delete<T>(url: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    const response = await this.httpClient.request<T>({
      method: 'DELETE',
      url,
      headers: config?.headers,
      params: config?.params,
      timeout: config?.timeout,
    });

    return {
      data: response.data,
      success: response.status >= 200 && response.status < 300,
    };
  }
}
