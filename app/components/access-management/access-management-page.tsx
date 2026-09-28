"use client";

import { AlertTriangle, Clock3, RefreshCw, Search, ShieldCheck, UserCheck, UserRound, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { userAccessService } from '../../services/user-access.service';
import type { AccessUser } from './access-management.types';
import { AVAILABLE_PERMISSION_CODES } from './permission-catalog';
import { PendingUserActions } from './pending-user-actions';
import { PermissionEditor } from './permission-editor';
import { UserList } from './user-list';
import { UserStatusBadge } from './user-status-badge';

type StatusFilter = 'todos' | AccessUser['status'];
type AccessFilter = 'todos' | 'master' | 'usuario';
type Feedback = { kind: 'success' | 'error'; text: string } | null;

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const formatDate = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(value));
const samePermissions = (left: Set<string>, right: Set<string>) => left.size === right.size && [...left].every(code => right.has(code));

export function AccessManagementPage({ users, loading, error, currentUserId, actorPermissions, onRetry, onUserChanged }: {
  users: AccessUser[];
  loading: boolean;
  error: string;
  currentUserId: string;
  actorPermissions: string[];
  onRetry: () => void;
  onUserChanged: (user: AccessUser) => void;
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');
  const [accessFilter, setAccessFilter] = useState<AccessFilter>('todos');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [permissionsByUser, setPermissionsByUser] = useState<Record<string, string[]>>({});
  const [permissionErrors, setPermissionErrors] = useState<Record<string, string>>({});
  const [draftsByUser, setDraftsByUser] = useState<Record<string, string[]>>({});
  const [permissionReload, setPermissionReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const actorPermissionSet = useMemo(() => new Set(actorPermissions), [actorPermissions]);

  const metrics = useMemo(() => ({
    pendente: users.filter(user => user.status === 'pendente').length,
    ativo: users.filter(user => user.status === 'ativo').length,
    inativo: users.filter(user => user.status === 'inativo').length,
    rejeitado: users.filter(user => user.status === 'rejeitado').length,
  }), [users]);
  const filteredUsers = useMemo(() => users.filter(user => {
    const query = normalize(search.trim());
    return (!query || normalize(`${user.nome} ${user.email}`).includes(query))
      && (statusFilter === 'todos' || user.status === statusFilter)
      && (accessFilter === 'todos' || user.perfilCodigo === accessFilter);
  }), [accessFilter, search, statusFilter, users]);
  const selectedUser = filteredUsers.find(user => user.id === selectedId) ?? filteredUsers[0] ?? null;
  const selectedUserId = selectedUser?.id ?? null;
  const canReadPermissions = actorPermissionSet.has('permissoes:ler');
  const canEditPermissions = actorPermissionSet.has('permissoes:editar');
  const locked = Boolean(selectedUser && (selectedUser.id === currentUserId || selectedUser.perfilCodigo === 'master' || !canEditPermissions));
  const baselinePermissions = new Set(selectedUser?.perfilCodigo === 'master'
    ? AVAILABLE_PERMISSION_CODES : selectedUserId ? permissionsByUser[selectedUserId] ?? [] : []);
  const draftPermissions = selectedUserId && draftsByUser[selectedUserId]
    ? new Set(draftsByUser[selectedUserId]) : baselinePermissions;
  const hasDraftChanges = !samePermissions(draftPermissions, baselinePermissions);
  const permissionLoading = Boolean(selectedUserId && selectedUser?.perfilCodigo !== 'master' && canReadPermissions
    && !permissionsByUser[selectedUserId] && !permissionErrors[selectedUserId]);

  useEffect(() => {
    if (!selectedUserId || selectedUser?.perfilCodigo === 'master' || !canReadPermissions) return;
    let current = true;
    userAccessService.permissions(selectedUserId).then(access => {
      if (!current) return;
      setPermissionsByUser(values => ({ ...values, [selectedUserId]: access.permissoes }));
      setPermissionErrors(values => { const next = { ...values }; delete next[selectedUserId]; return next; });
    }).catch(reason => {
      if (!current) return;
      setPermissionErrors(values => ({ ...values, [selectedUserId]: reason instanceof Error ? reason.message : 'Não foi possível carregar as permissões.' }));
    });
    return () => { current = false; };
  }, [canReadPermissions, permissionReload, selectedUser?.perfilCodigo, selectedUserId]);

  const run = async (operation: () => Promise<void>, success: string) => {
    setBusy(true);
    setFeedback(null);
    try {
      await operation();
      setFeedback({ kind: 'success', text: success });
    } catch (reason) {
      setFeedback({ kind: 'error', text: reason instanceof Error ? reason.message : 'Não foi possível concluir a operação.' });
    } finally {
      setBusy(false);
    }
  };
  const manageableDraft = () => [...draftPermissions].filter(code => actorPermissionSet.has(code));
  const updateUser = (user: AccessUser) => { onUserChanged(user); setSelectedId(user.id); };
  const savePermissions = () => selectedUser && run(async () => {
    const access = await userAccessService.savePermissions(selectedUser.id, manageableDraft());
    setPermissionsByUser(current => ({ ...current, [selectedUser.id]: access.permissoes }));
    setDraftsByUser(current => { const next = { ...current }; delete next[selectedUser.id]; return next; });
  }, 'Permissões atualizadas. As sessões anteriores desta conta foram invalidadas.');
  const approve = () => selectedUser && run(async () => {
    const updated = await userAccessService.approve(selectedUser.id, manageableDraft());
    updateUser(updated);
    setPermissionsByUser(current => ({ ...current, [selectedUser.id]: [...draftPermissions] }));
    setDraftsByUser(current => { const next = { ...current }; delete next[selectedUser.id]; return next; });
  }, 'Solicitação aprovada. O usuário já pode entrar com os acessos definidos.');
  const changeStatus = (action: 'reject' | 'activate' | 'deactivate', success: string) => selectedUser && run(async () => {
    updateUser(await userAccessService[action](selectedUser.id));
  }, success);

  return <section className="access-management-page">
    <header className="access-page-heading">
      <div><p className="eyebrow">Administração</p><h1>Usuários e acessos</h1><p>Analise solicitações e administre os acessos efetivos de cada conta.</p></div>
      {metrics.pendente > 0 && <span className="access-pending-callout"><Clock3 aria-hidden="true" /><strong>{metrics.pendente}</strong>{metrics.pendente === 1 ? 'solicitação pendente' : 'solicitações pendentes'}</span>}
    </header>

    <section className="access-summary" aria-label="Resumo dos usuários">
      <button type="button" className={statusFilter === 'pendente' ? 'is-active' : ''} onClick={() => setStatusFilter(statusFilter === 'pendente' ? 'todos' : 'pendente')}><Clock3 aria-hidden="true" /><span><small>Pendentes</small><strong>{metrics.pendente}</strong></span></button>
      <button type="button" className={statusFilter === 'ativo' ? 'is-active' : ''} onClick={() => setStatusFilter(statusFilter === 'ativo' ? 'todos' : 'ativo')}><UserCheck aria-hidden="true" /><span><small>Ativos</small><strong>{metrics.ativo}</strong></span></button>
      <button type="button" className={statusFilter === 'inativo' ? 'is-active' : ''} onClick={() => setStatusFilter(statusFilter === 'inativo' ? 'todos' : 'inativo')}><UserRound aria-hidden="true" /><span><small>Inativos</small><strong>{metrics.inativo}</strong></span></button>
      <button type="button" className={statusFilter === 'rejeitado' ? 'is-active' : ''} onClick={() => setStatusFilter(statusFilter === 'rejeitado' ? 'todos' : 'rejeitado')}><AlertTriangle aria-hidden="true" /><span><small>Rejeitados</small><strong>{metrics.rejeitado}</strong></span></button>
    </section>

    <div className="access-toolbar">
      <label className="access-search"><span className="sr-only">Buscar usuários</span><Search aria-hidden="true" /><input type="search" value={search} onChange={event => { setSearch(event.target.value); setSelectedId(null); }} placeholder="Buscar por nome ou e-mail" /></label>
      <label className="access-filter"><span>Status</span><select value={statusFilter} onChange={event => { setStatusFilter(event.target.value as StatusFilter); setSelectedId(null); }}><option value="todos">Todos os status</option><option value="pendente">Pendentes</option><option value="ativo">Ativos</option><option value="inativo">Inativos</option><option value="rejeitado">Rejeitados</option></select></label>
      <label className="access-filter"><span>Nível de acesso</span><select value={accessFilter} onChange={event => { setAccessFilter(event.target.value as AccessFilter); setSelectedId(null); }}><option value="todos">Todos os níveis</option><option value="master">Master</option><option value="usuario">Usuários</option></select></label>
    </div>

    <div className="access-integration-note" role="note"><ShieldCheck aria-hidden="true" /><p><strong>Autorização integrada ao backend</strong><span>Alterações são auditadas, não permitem autoedição e invalidam tokens antigos da conta afetada.</span></p></div>
    {feedback && <div className="access-integration-note" role={feedback.kind === 'error' ? 'alert' : 'status'}><ShieldCheck aria-hidden="true" /><p><strong>{feedback.kind === 'error' ? 'Operação não concluída' : 'Alteração concluída'}</strong><span>{feedback.text}</span></p></div>}

    <div className="access-workspace">
      <aside className="access-list-panel" aria-label="Lista de usuários">
        <header><div><strong>Contas cadastradas</strong><span>{filteredUsers.length} de {users.length}</span></div></header>
        {loading ? <div className="access-list-skeleton" aria-label="Carregando usuários"><i /><i /><i /></div>
          : error ? <div className="access-list-error" role="alert"><AlertTriangle aria-hidden="true" /><strong>Não foi possível carregar os usuários</strong><span>{error}</span><button type="button" onClick={onRetry}><RefreshCw aria-hidden="true" />Tentar novamente</button></div>
            : <UserList users={filteredUsers} selectedId={selectedUser?.id ?? null} onSelect={user => { setSelectedId(user.id); setFeedback(null); }} />}
      </aside>

      <article className="access-detail-panel">
        {selectedUser ? <>
          <header className="access-user-header">
            <span className="access-detail-avatar" aria-hidden="true">{selectedUser.nome.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase()}</span>
            <div><span><UserStatusBadge status={selectedUser.status} />{selectedUser.perfilCodigo === 'master' && <b>Master</b>}</span><h2>{selectedUser.nome}</h2><p>{selectedUser.email}</p></div>
          </header>
          <dl className="access-user-metadata">
            <div><dt>Perfil atual</dt><dd>{selectedUser.perfilCodigo === 'master' ? 'Master' : 'Usuário'}</dd></div>
            <div><dt>Cadastrado em</dt><dd>{formatDate(selectedUser.createdAt)}</dd></div>
            <div><dt>Última atualização</dt><dd>{formatDate(selectedUser.updatedAt)}</dd></div>
          </dl>
          {selectedUser.id === currentUserId && <p className="access-self-note"><ShieldCheck aria-hidden="true" />Sua própria conta está protegida contra autoelevação ou perda acidental de acesso.</p>}
          {selectedUserId && permissionErrors[selectedUserId] && <p className="access-self-note"><AlertTriangle aria-hidden="true" />{permissionErrors[selectedUserId]} <button type="button" onClick={() => { setPermissionErrors(current => { const next = { ...current }; delete next[selectedUserId]; return next; }); setPermissionReload(current => current + 1); }}>Tentar novamente</button></p>}
          <PendingUserActions user={selectedUser} locked={locked} busy={busy}
            canApprove={actorPermissionSet.has('usuarios:aprovar') && canEditPermissions}
            canReject={actorPermissionSet.has('usuarios:rejeitar')}
            canActivate={actorPermissionSet.has('usuarios:ativar')}
            canDeactivate={actorPermissionSet.has('usuarios:inativar')}
            onApprove={approve} onReject={() => changeStatus('reject', 'Solicitação rejeitada.')}
            onActivate={() => changeStatus('activate', 'Conta reativada.')}
            onDeactivate={() => changeStatus('deactivate', 'Conta inativada. As sessões existentes foram bloqueadas.')} />
          <PermissionEditor selected={draftPermissions} editable={canEditPermissions ? actorPermissionSet : new Set()} onChange={next => setDraftsByUser(current => ({ ...current, [selectedUser.id]: [...next] }))} locked={locked} loading={permissionLoading} />
          <footer className="access-editor-footer"><p>{hasDraftChanges ? 'Existem alterações ainda não salvas.' : 'Permissões sincronizadas com a API.'}</p><div><button type="button" disabled={!hasDraftChanges || busy} onClick={() => setDraftsByUser(current => { const next = { ...current }; delete next[selectedUser.id]; return next; })}>Descartar</button><button type="button" disabled={!hasDraftChanges || locked || busy || selectedUser.status === 'pendente'} onClick={savePermissions}>Salvar alterações</button></div></footer>
        </> : <div className="access-detail-empty"><UsersRound aria-hidden="true" /><strong>Selecione um usuário</strong><span>Os dados e acessos da conta aparecerão neste painel.</span></div>}
      </article>
    </div>
  </section>;
}
