import type { UserStatus } from '../../services/api-client';

export interface AccessUser {
  id: string;
  nome: string;
  email: string;
  perfilCodigo: string | null;
  status: UserStatus;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PermissionItem {
  code: string;
  label: string;
  description: string;
}

export interface PermissionGroup {
  id: string;
  label: string;
  description: string;
  permissions: PermissionItem[];
}
