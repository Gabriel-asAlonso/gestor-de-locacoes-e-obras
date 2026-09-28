"use client";

import { useEffect, useRef, useState, type ComponentType, type FormEvent } from 'react';
import { ApiError, type SessionInfo } from './services/api-client';
import { authService } from './services/auth.service';

export interface LoginProps {
  loading: boolean;
  error: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

export function SessionGate({ loginView: LoginView, workspace: Workspace }: {
  loginView: ComponentType<LoginProps>;
  workspace: ComponentType<{ session: SessionInfo; onLogout: () => Promise<void> }>;
}) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(true);
  const [error, setError] = useState('');
  const submitting = useRef(false);

  useEffect(() => {
    let active = true;
    const unsubscribe = authService.subscribe(value => { if (active) setSession(value); });
    authService.restore().then(value => { if (active) setSession(value); })
      .catch(cause => { if (active) { setSession(null); setError(cause instanceof ApiError ? cause.message : 'Não foi possível recuperar a sessão.'); } })
      .finally(() => { if (active) { setLoading(false); setRestoring(false); } });
    return () => { active = false; unsubscribe(); };
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || loading) return;
    const data = new FormData(event.currentTarget);
    submitting.current = true;
    setLoading(true);
    setError('');
    try { setSession(await authService.login(String(data.get('email') ?? ''), String(data.get('senha') ?? ''))); }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Não foi possível entrar. Tente novamente.'); }
    finally { submitting.current = false; setLoading(false); }
  }

  async function onLogout() {
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true);
    setError('');
    try { await authService.logout(); }
    catch { setError('Sessão removida deste navegador, mas a API não confirmou o encerramento. Verifique sua conexão.'); }
    finally { setSession(null); submitting.current = false; setLoading(false); }
  }

  if (!session || restoring) return <LoginView loading={loading} error={error} onSubmit={onSubmit} />;
  return <div aria-busy={loading} inert={loading || undefined}>
    <Workspace session={session} onLogout={onLogout} />
  </div>;
}
