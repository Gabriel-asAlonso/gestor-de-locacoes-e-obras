"use client";

import { AlertTriangle, Bug, KeyRound, Search, ShieldCheck, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { logsService, type AuditLogRecord, type LogSummary, type TechnicalLogRecord } from '../../services/logs.service';

type Mode = 'audit' | 'technical';
type Selected = { mode: Mode; value: AuditLogRecord | TechnicalLogRecord } | null;
const EMPTY: LogSummary = { auditToday: 0, errors: 0, warnings: 0, critical: 0, authenticationFailures: 0 };
const dateTime = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value));

export function LogsPage({ canViewTechnical }: { canViewTechnical: boolean }) {
  const [mode, setMode] = useState<Mode>('audit');
  const [summary, setSummary] = useState(EMPTY);
  const [rows, setRows] = useState<Array<AuditLogRecord | TechnicalLogRecord>>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [requestId, setRequestId] = useState('');
  const [eventCode, setEventCode] = useState('');
  const [entity, setEntity] = useState('');
  const [level, setLevel] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Selected>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const filters = { page, limit: 25, requestId: requestId.trim() || undefined, eventCode: eventCode.trim() || undefined,
        entity: mode === 'audit' ? entity.trim() || undefined : undefined, level: mode === 'technical' ? level || undefined : undefined };
      const [nextSummary, result] = await Promise.all([logsService.summary(), mode === 'audit' ? logsService.audit(filters) : logsService.technical(filters)]);
      setSummary(nextSummary); setRows(result.data); setPages(Math.max(1, result.pagination.totalPages));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os registros.'); }
    finally { setLoading(false); }
  }, [entity, eventCode, level, mode, page, requestId]);

  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);
  const chooseMode = (next: Mode) => { setMode(next); setPage(1); setSelected(null); };

  return <section className="logs-page">
    <header className="logs-heading"><div><p className="eyebrow">Observabilidade e controle</p><h1>Logs e auditoria</h1><p>Investigue alterações, falhas técnicas e eventos de segurança usando o identificador da requisição.</p></div><button type="button" onClick={() => void load()}>Atualizar</button></header>
    <div className="logs-metrics">
      <article><ShieldCheck /><span>Auditorias hoje<strong>{summary.auditToday}</strong></span></article>
      <article><AlertTriangle /><span>Warnings recentes<strong>{summary.warnings}</strong></span></article>
      <article><Bug /><span>Erros recentes<strong>{summary.errors}</strong></span></article>
      <article><KeyRound /><span>Falhas de login<strong>{summary.authenticationFailures}</strong></span></article>
      <article className={summary.critical ? 'critical' : ''}><AlertTriangle /><span>Críticos recentes<strong>{summary.critical}</strong></span></article>
    </div>
    <div className="logs-panel">
      <div className="logs-tabs" role="tablist"><button type="button" className={mode === 'audit' ? 'active' : ''} onClick={() => chooseMode('audit')}>Auditoria</button>{canViewTechnical && <button type="button" className={mode === 'technical' ? 'active' : ''} onClick={() => chooseMode('technical')}>Logs técnicos</button>}</div>
      <form className="logs-filters" onSubmit={event => { event.preventDefault(); setPage(1); void load(); }}>
        <label><Search aria-hidden="true" /><input value={requestId} onChange={event => setRequestId(event.target.value)} placeholder="Request ID" /></label>
        <input value={eventCode} onChange={event => setEventCode(event.target.value)} placeholder="Código do evento" />
        {mode === 'audit' ? <input value={entity} onChange={event => setEntity(event.target.value)} placeholder="Entidade" /> : <select value={level} onChange={event => setLevel(event.target.value)}><option value="">Todos os níveis</option><option value="debug">DEBUG</option><option value="info">INFO</option><option value="warn">WARN</option><option value="error">ERROR</option><option value="critical">CRITICAL</option></select>}
        <button type="submit">Filtrar</button>
      </form>
      {error && <div className="logs-error" role="alert"><span>{error}</span><button type="button" onClick={() => void load()}>Tentar novamente</button></div>}
      <div className="logs-table-wrap"><table><thead><tr><th>Data e hora</th><th>Evento</th><th>{mode === 'audit' ? 'Usuário' : 'Nível'}</th><th>{mode === 'audit' ? 'Entidade' : 'Endpoint'}</th><th>Request ID</th><th /></tr></thead><tbody>
        {!loading && !rows.length && <tr><td colSpan={6} className="logs-empty">Nenhum registro encontrado para os filtros informados.</td></tr>}
        {rows.map(row => mode === 'audit' ? <AuditRow key={row.id} row={row as AuditLogRecord} onOpen={() => setSelected({ mode, value: row })} /> : <TechnicalRow key={row.id} row={row as TechnicalLogRecord} onOpen={() => setSelected({ mode, value: row })} />)}
        {loading && <tr><td colSpan={6} className="logs-empty">Carregando registros…</td></tr>}
      </tbody></table></div>
      <footer className="logs-pagination"><span>Página {page} de {pages}</span><div><button type="button" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Anterior</button><button type="button" disabled={page >= pages} onClick={() => setPage(value => value + 1)}>Próxima</button></div></footer>
    </div>
    {selected && <div className="logs-detail-layer" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSelected(null); }}><aside role="dialog" aria-modal="true" aria-labelledby="log-detail-title"><header><div><span>{selected.mode === 'audit' ? 'Evento de auditoria' : 'Diagnóstico técnico'}</span><h2 id="log-detail-title">{selected.value.eventCode ?? 'Evento sem código'}</h2></div><button type="button" onClick={() => setSelected(null)} aria-label="Fechar detalhes"><X /></button></header><LogDetails selected={selected} /></aside></div>}
  </section>;
}

function AuditRow({ row, onOpen }: { row: AuditLogRecord; onOpen: () => void }) {
  return <tr><td>{dateTime(row.timestamp)}</td><td><strong>{row.eventCode ?? row.operation}</strong><small>{row.reason ?? row.operation}</small></td><td>{row.actorName ?? row.actorContext ?? 'Sistema'}</td><td>{row.entity}<small>{row.entityId ?? 'chave composta'}</small></td><td><code>{row.requestId?.slice(0, 12) ?? '—'}</code></td><td><button type="button" onClick={onOpen}>Detalhes</button></td></tr>;
}
function TechnicalRow({ row, onOpen }: { row: TechnicalLogRecord; onOpen: () => void }) {
  return <tr><td>{dateTime(row.timestamp)}</td><td><strong>{row.eventCode}</strong><small>{row.message}</small></td><td><span className={`log-level ${row.level}`}>{row.level}</span></td><td>{row.method ?? '—'} {row.route ?? '—'}<small>{row.statusCode ?? ''}</small></td><td><code>{row.requestId?.slice(0, 12) ?? '—'}</code></td><td><button type="button" onClick={onOpen}>Detalhes</button></td></tr>;
}
function LogDetails({ selected }: { selected: NonNullable<Selected> }) {
  const value = selected.value;
  return <div className="logs-detail-body"><dl><div><dt>Data</dt><dd>{dateTime(value.timestamp)}</dd></div><div><dt>Request ID</dt><dd><code>{value.requestId ?? 'Não disponível'}</code></dd></div>{'userId' in value && <div><dt>Usuário</dt><dd>{value.userId ?? 'Sistema'}</dd></div>}</dl>
    {selected.mode === 'audit' ? <><h3>Dados anteriores</h3><pre>{JSON.stringify((value as AuditLogRecord).before, null, 2) || '—'}</pre><h3>Dados posteriores</h3><pre>{JSON.stringify((value as AuditLogRecord).after, null, 2) || '—'}</pre></> : <><h3>Contexto técnico</h3><pre>{JSON.stringify(value, null, 2)}</pre></>}
  </div>;
}
