/** Converts a DB row into safe views. senha_hash is never included. */
import type { AuthenticatedUser } from '../common/types.ts';
import type { UsuarioRow } from './users.service.ts';
import type { DomainCode } from '../../db/domains.ts';

export interface PublicUser {
  id: string;
  nome: string;
  email: string;
  perfilCodigo: string | null;
  status: DomainCode<'usuarioStatus'>;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export function toPublicUser(row: UsuarioRow): PublicUser {
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    perfilCodigo: row.papel_codigo,
    status: row.status,
    ativo: row.ativo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toAuthenticatedUser(row: UsuarioRow): AuthenticatedUser {
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    perfilCodigo: row.papel_codigo,
    status: row.status,
    ativo: row.ativo,
    autorizacaoVersao: row.autorizacao_versao,
  };
}
