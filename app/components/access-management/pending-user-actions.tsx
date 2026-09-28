import { ShieldCheck, UserCheck, UserX } from 'lucide-react';
import type { AccessUser } from './access-management.types';

export function PendingUserActions({ user, locked, busy, canApprove, canReject, canActivate, canDeactivate, onApprove, onReject, onActivate, onDeactivate }: {
  user: AccessUser;
  locked: boolean;
  busy: boolean;
  canApprove: boolean;
  canReject: boolean;
  canActivate: boolean;
  canDeactivate: boolean;
  onApprove: () => void;
  onReject: () => void;
  onActivate: () => void;
  onDeactivate: () => void;
}) {
  if (user.status === 'ativo') return canDeactivate && !locked ? <section className="pending-user-actions"><div><span aria-hidden="true"><UserCheck /></span><p><strong>Conta ativa</strong><small>Você pode bloquear novos acessos sem apagar o histórico.</small></p></div><div className="pending-user-buttons"><button type="button" disabled={busy} onClick={onDeactivate}><UserX aria-hidden="true" />Inativar conta</button></div></section> : null;
  if (user.status === 'inativo') return canActivate && !locked ? <section className="pending-user-actions"><div><span aria-hidden="true"><UserCheck /></span><p><strong>Conta inativa</strong><small>As permissões serão preservadas ao reativar.</small></p></div><div className="pending-user-buttons"><button type="button" disabled={busy} onClick={onActivate}><ShieldCheck aria-hidden="true" />Reativar conta</button></div></section> : null;
  if (user.status !== 'pendente') return null;
  return <section className="pending-user-actions" aria-labelledby="pending-user-title">
    <div><span aria-hidden="true"><ShieldCheck /></span><p><strong id="pending-user-title">Solicitação aguardando análise</strong><small>Defina os acessos iniciais antes de aprovar esta conta.</small></p></div>
    <div className="pending-user-buttons">
      {canReject && <button type="button" disabled={busy || locked} onClick={onReject}><UserX aria-hidden="true" />Rejeitar</button>}
      {canApprove && <button type="button" disabled={busy || locked} onClick={onApprove}><ShieldCheck aria-hidden="true" />Aprovar acesso</button>}
    </div>
  </section>;
}
