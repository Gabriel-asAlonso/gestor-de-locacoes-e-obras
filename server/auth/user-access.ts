/** Central status/profile gate shared by login, refresh and authenticated requests. */
import { ForbiddenError } from '../common/errors.ts';
import { roleExists } from '../roles/roles.ts';
import type { UsuarioRow } from '../users/users.service.ts';

export function ensureUserCanAccess(row: UsuarioRow): void {
  if (row.status === 'pendente') throw new ForbiddenError('Cadastro aguardando aprovação.');
  if (row.status === 'rejeitado') throw new ForbiddenError('Solicitação de acesso rejeitada.');
  if (row.status !== 'ativo' || !row.ativo) throw new ForbiddenError('Usuário sem acesso ao sistema.');
  if (!roleExists(row.papel_codigo)) throw new ForbiddenError('Perfil não suportado.');
}
