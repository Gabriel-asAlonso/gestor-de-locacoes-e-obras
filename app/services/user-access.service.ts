import { ApiError } from './api-client';
import { apiClient } from './auth.service';
import type { AccessUser } from '../components/access-management/access-management.types';

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isStatus = (value: unknown): value is AccessUser['status'] => ['pendente', 'ativo', 'rejeitado', 'inativo'].includes(String(value));

function validateUser(value: unknown): AccessUser {
  if (!isObject(value) || typeof value.id !== 'string' || typeof value.nome !== 'string' || typeof value.email !== 'string'
    || !(typeof value.perfilCodigo === 'string' || value.perfilCodigo === null) || !isStatus(value.status)
    || typeof value.ativo !== 'boolean' || typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string') {
    throw new ApiError('Resposta inválida ao carregar usuários.', 502, 'RESPOSTA_INVALIDA');
  }
  return value as unknown as AccessUser;
}

export interface UserAccess {
  perfilCodigo: string;
  permissoes: string[];
}

function validateAccess(value: unknown): UserAccess {
  if (!isObject(value) || typeof value.perfilCodigo !== 'string' || !Array.isArray(value.permissoes)
    || !value.permissoes.every(permission => typeof permission === 'string')) {
    throw new ApiError('Resposta inválida ao carregar permissões.', 502, 'RESPOSTA_INVALIDA');
  }
  return value as unknown as UserAccess;
}

const json = (body?: object): RequestInit => ({ method: 'POST', body: body ? JSON.stringify(body) : undefined });

export const userAccessService = {
  async list(): Promise<AccessUser[]> {
    const response = await apiClient.request<unknown>('/users');
    if (!isObject(response) || !Array.isArray(response.data)) throw new ApiError('Resposta inválida ao carregar usuários.', 502, 'RESPOSTA_INVALIDA');
    return response.data.map(validateUser);
  },
  async permissions(userId: string): Promise<UserAccess> {
    return validateAccess(await apiClient.request<unknown>(`/users/${encodeURIComponent(userId)}/permissions`));
  },
  async savePermissions(userId: string, permissoes: string[]): Promise<UserAccess> {
    return validateAccess(await apiClient.request<unknown>(`/users/${encodeURIComponent(userId)}/permissions`, {
      method: 'PUT', body: JSON.stringify({ permissoes }),
    }));
  },
  async approve(userId: string, permissoes: string[]): Promise<AccessUser> {
    return validateUser(await apiClient.request<unknown>(`/users/${encodeURIComponent(userId)}/approve`, json({ permissoes })));
  },
  async reject(userId: string): Promise<AccessUser> {
    return validateUser(await apiClient.request<unknown>(`/users/${encodeURIComponent(userId)}/reject`, json()));
  },
  async deactivate(userId: string): Promise<AccessUser> {
    return validateUser(await apiClient.request<unknown>(`/users/${encodeURIComponent(userId)}/deactivate`, json()));
  },
  async activate(userId: string): Promise<AccessUser> {
    return validateUser(await apiClient.request<unknown>(`/users/${encodeURIComponent(userId)}/activate`, json()));
  },
};
