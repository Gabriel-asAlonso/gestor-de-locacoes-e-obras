/** Public registration creates a pending account and never grants a profile or session. */
import type { RegistrationDto } from '../auth/dto.ts';
import { logger } from '../common/logger.ts';
import { EVENTS } from '../observability/event-codes.ts';
import { createUser } from './users.service.ts';

export interface RegistrationResult {
  id: string;
  nome: string;
  email: string;
  status: 'pendente';
  createdAt: string;
}

export async function requestRegistration(input: RegistrationDto): Promise<RegistrationResult> {
  const row = await createUser(
    { nome: input.nome, email: input.email, senha: input.senha, status: 'pendente' },
    { system: 'public:registration:v1', reason: 'Solicitação pública de acesso' },
  );
  logger.event('info', 'business', EVENTS.USER_REGISTRATION_REQUESTED, 'Solicitação de cadastro criada.', { userId: row.id, entity: 'usuarios', entityId: row.id, outcome: 'success' });
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    status: 'pendente',
    createdAt: row.created_at,
  };
}
