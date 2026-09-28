import { ApiClient } from './api-client';

// Injected by Vite from the public environment setting. Never inject the full process.env.
export const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';
export const apiClient = new ApiClient({
  baseUrl: API_URL,
  storage: () => typeof window === 'undefined' ? null : window.sessionStorage,
});

export const authService = {
  login: (email: string, senha: string) => apiClient.login(email, senha),
  restore: () => apiClient.restore(),
  logout: () => apiClient.logout(),
  subscribe: (listener: Parameters<ApiClient['subscribe']>[0]) => apiClient.subscribe(listener),
};
