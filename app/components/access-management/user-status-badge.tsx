import type { UserStatus } from '../../services/api-client';

const STATUS_LABELS: Record<UserStatus, string> = {
  pendente: 'Pendente', ativo: 'Ativo', rejeitado: 'Rejeitado', inativo: 'Inativo',
};

export function UserStatusBadge({ status }: { status: UserStatus }) {
  return <span className={`access-status access-status-${status}`}><i aria-hidden="true" />{STATUS_LABELS[status]}</span>;
}
