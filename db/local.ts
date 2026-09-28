import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { drizzle, type AsyncRemoteCallback } from 'drizzle-orm/sqlite-proxy';
import { tables } from './schema.ts';
import * as relations from './relations.ts';

export interface WriteContext {
  actorId?: string;
  system?: string;
  reason?: string;
  requestId?: string;
  eventCode?: string;
  category?: string;
  module?: string;
  source?: string;
}
export const databasePath = () => process.env['DATABASE_PATH'] || './.data/locacoes.sqlite';

const RELEVANT_AUDIT_FIELD = /^(?:id|codigo|nome|email|status|estado|ativo|created_at|created_by|updated_at|updated_by|papel_codigo|perfil_codigo|autorizacao_versao|permissao_codigo|concedida_em|concedida_por|mime_type|tamanho_bytes|tipo|natureza|competencia|vencimento|valor|valor_.+|saldo_.+|desconto|acrescimo|entrada_prevista|quantidade.*|percentual|progresso_.+|data_.+|inicio.*|fim_.+|termino|resolvida_em|retirado_em|motivo|motivo_estorno|forma_pagamento.*|versao|numero|ordem.*|.+_id|.+_por)$/;
const SENSITIVE_AUDIT_FIELD = /(?:senha|password|token|secret|authorization|cookie|chave_armazenamento|hash_sha256)/i;

function relevantAuditJson(raw: unknown): string | null {
  if (raw == null) return null;
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try { value = JSON.parse(raw); } catch { return null; }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const output = Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => RELEVANT_AUDIT_FIELD.test(key) && !SENSITIVE_AUDIT_FIELD.test(key)));
  return JSON.stringify(output);
}

/** Opens a file, never creates application tables or auto-migrates. */
export function openSqlite(path = databasePath()) {
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
  const sqlite = new DatabaseSync(path);
  sqlite.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA recursive_triggers=ON;');
  return sqlite;
}

/** One dedicated connection per unit of work. Concurrent transactions on this handle are rejected. */
export function openDatabase(path = databasePath()) {
  const sqlite = openSqlite(path);
  let busy = false;
  let closed = false;
  const makeOrm = (writable: boolean, alive: () => boolean) => {
    const callback: AsyncRemoteCallback = async (query, params, method) => {
      if (closed || !alive()) throw new Error('Sessao encerrada ou fora da transacao.');
      // Do not expose arbitrary DDL/transaction control through ORM SQL helpers.
      if (!/^\s*(select\b|insert\b|update\b|delete\b)/i.test(query) || /\b__write_context\b|\b__transaction_end\b/i.test(query)) throw new Error('Comando fora do acesso de dados permitido.');
      if (!writable && !/^\s*select\b/i.test(query)) throw new Error('Escrita exige database.transaction(context, callback).');
      const statement = sqlite.prepare(query);
      const args = params as SQLInputValue[];
      if (method === 'run') { statement.run(...args); return { rows: [] }; }
      statement.setReturnArrays(true);
      if (method === 'get') return { rows: statement.get(...args) as unknown as unknown[] };
      return { rows: statement.all(...args) as unknown as unknown[][] };
    };
    return drizzle(callback, { schema: { ...tables, ...relations } });
  };
  const read = makeOrm(false, () => !busy);
  return {
    read,
    async transaction<T>(context: WriteContext, callback: (db: ReturnType<typeof makeOrm>, audit: { updated_at: string; updated_by: string | null; created_by: string | null }) => Promise<T>): Promise<T> {
      if (closed || busy) throw new Error('Use uma conexao independente por transacao concorrente.');
      if (!context.actorId && !context.system?.trim()) throw new Error('Informe ator ou processo de sistema.');
      busy = true;
      let alive = true;
      try {
        sqlite.exec('BEGIN IMMEDIATE');
        const firstAuditRowId = Number(sqlite.prepare('SELECT COALESCE(MAX(rowid),0) AS id FROM auditoria_eventos').get()!['id']);
        const metadata = {
          requestId: context.requestId ?? null,
          eventCode: context.eventCode ?? 'AUDIT_DATA_CHANGE',
          category: context.category ?? 'audit',
          module: context.module ?? null,
          source: context.source ?? (context.system ? 'system' : 'internal'),
        };
        sqlite.prepare(`INSERT INTO __write_context(
          id,ator_usuario_id,contexto_ator,motivo,request_id,event_code,categoria,modulo,origem
        ) VALUES(1,?,?,?,?,?,?,?,?)`).run(
          context.actorId ?? null, context.system ?? null, context.reason ?? null, metadata.requestId,
          metadata.eventCode, metadata.category, metadata.module, metadata.source,
        );
        const result = await callback(makeOrm(true, () => alive), {
          get updated_at() { return String(sqlite.prepare("SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now') AS instante").get()!['instante']); },
          updated_by: context.actorId ?? null, created_by: context.actorId ?? null,
        });
        const auditRows = sqlite.prepare('SELECT rowid,antes,depois FROM auditoria_eventos WHERE rowid>?').all(firstAuditRowId);
        const enrichAudit = sqlite.prepare(`UPDATE auditoria_eventos SET
          antes=?, depois=?, request_id=?, event_code=?, categoria=?, modulo=?, origem=? WHERE rowid=?`);
        for (const row of auditRows) enrichAudit.run(
          relevantAuditJson(row['antes']), relevantAuditJson(row['depois']), metadata.requestId, metadata.eventCode,
          metadata.category, metadata.module, metadata.source, row['rowid'] as SQLInputValue,
        );
        alive = false;
        // The DELETE trigger validates complete aggregates. A deferred FK prevents committing an open context.
        sqlite.exec('DELETE FROM __write_context WHERE id=1; COMMIT;');
        return result;
      } catch (error) {
        if (sqlite.isTransaction) sqlite.exec('ROLLBACK');
        throw error;
      } finally { alive = false; busy = false; }
    },
    close() { if (busy) throw new Error('Transacao em andamento.'); if (!closed) sqlite.close(); closed = true; },
  };
}
