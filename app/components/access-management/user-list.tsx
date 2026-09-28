import { ChevronRight, UserRound } from 'lucide-react';
import type { AccessUser } from './access-management.types';
import { UserStatusBadge } from './user-status-badge';

const initials = (name: string) => name.split(/\s+/).filter(Boolean).map(part => part[0]).join('').slice(0, 2).toUpperCase();
const accessLabel = (user: AccessUser) => user.perfilCodigo === 'master' ? 'Master'
  : user.status === 'pendente' ? 'Aguardando definição' : 'Usuário';

export function UserList({ users, selectedId, onSelect }: { users: AccessUser[]; selectedId: string | null; onSelect: (user: AccessUser) => void }) {
  if (!users.length) return <div className="access-list-empty"><UserRound aria-hidden="true" /><strong>Nenhum usuário encontrado</strong><span>Ajuste a busca ou os filtros para ver outras contas.</span></div>;
  return <div className="access-user-list" role="list" aria-label="Usuários cadastrados">
    {users.map(user => <button type="button" role="listitem" key={user.id} className={`access-user-item ${selectedId === user.id ? 'is-selected' : ''}`} onClick={() => onSelect(user)} aria-current={selectedId === user.id ? 'true' : undefined}>
      <span className="access-user-avatar" aria-hidden="true">{initials(user.nome)}</span>
      <span className="access-user-copy"><strong>{user.nome}</strong><small>{user.email}</small><span><UserStatusBadge status={user.status} /><em>{accessLabel(user)}</em></span></span>
      <ChevronRight aria-hidden="true" />
    </button>)}
  </div>;
}
