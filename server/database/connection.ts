/**
 * Bridge to the existing, validated persistence layer in `db/`. The backend never
 * re-implements connection/transaction logic: it reuses `openDatabase()`, which
 * enforces one dedicated connection per unit of work, audited writes and immutability.
 */
import { sql } from 'drizzle-orm';
import { openDatabase, databasePath, type WriteContext } from '../../db/index.ts';
import { requestContext } from '../observability/context.ts';
import { logger } from '../common/logger.ts';
import { EVENTS } from '../observability/event-codes.ts';
import { AppError } from '../common/errors.ts';

function databaseErrorSummary(error: unknown): Record<string, unknown> {
  const outer = error instanceof Error ? error : undefined;
  const cause = outer?.cause instanceof Error ? outer.cause : undefined;
  const source = cause ?? outer;
  const message = source?.message ?? 'Falha desconhecida do banco.';
  return {
    name: source?.name ?? 'DatabaseError',
    category: /unique constraint/i.test(message) ? 'unique_constraint'
      : /foreign key constraint/i.test(message) ? 'foreign_key_constraint'
        : /database is locked|busy/i.test(message) ? 'database_busy' : 'database_operation',
  };
}

type Database = ReturnType<typeof openDatabase>;
export type ReadDb = Database['read'];
type TransactionCallback = Parameters<Database['transaction']>[1];
export type WriteDb = Parameters<TransactionCallback>[0];
export type Audit = Parameters<TransactionCallback>[1];
export type { WriteContext };

/** Read-only unit of work: opens a connection, runs the reader, always closes it. */
export async function withRead<T>(fn: (db: ReadDb) => Promise<T> | T): Promise<T> {
  const database = openDatabase();
  try {
    return await fn(database.read);
  } finally {
    database.close();
  }
}

/**
 * Write unit of work: opens a dedicated connection and runs an audited transaction.
 * `context` must carry either an authenticated `actorId` or a `system` process name.
 */
export async function withTransaction<T>(
  context: WriteContext,
  fn: (db: WriteDb, audit: Audit) => Promise<T>,
): Promise<T> {
  const database = openDatabase();
  try {
    const current = requestContext();
    const inferredModule = current?.path.split('/').filter(Boolean)[1];
    const inferredEvent = context.reason
      ? `AUDIT_${context.reason.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 90)}`
      : 'AUDIT_DATA_CHANGE';
    return await database.transaction({
      requestId: current?.requestId,
      source: current ? 'api' : context.system ? 'system' : undefined,
      category: 'audit',
      module: inferredModule,
      eventCode: inferredEvent,
      ...context,
    }, fn);
  } catch (error) {
    if (!(error instanceof AppError)) {
      const summary = databaseErrorSummary(error);
      const expectedConstraint = summary['category'] === 'unique_constraint' || summary['category'] === 'foreign_key_constraint';
      logger[expectedConstraint ? 'warn' : 'error'](EVENTS.DATABASE_OPERATION_FAILED,
        { databaseError: summary, module: context.module, auditEventCode: context.eventCode },
        expectedConstraint ? 'Transação rejeitada por restrição de integridade.' : 'Falha em transação do banco de dados.');
    }
    throw error;
  } finally {
    database.close();
  }
}

/** Cheap liveness probe used by the health check. */
export async function pingDatabase(): Promise<boolean> {
  try {
    await withRead((db) => db.get(sql`select 1 as ok`));
    return true;
  } catch (error) {
    logger.error(EVENTS.DATABASE_UNAVAILABLE, { error }, 'Falha na verificação de disponibilidade do banco.');
    return false;
  }
}

/** Startup guard: fails clearly when migrations have not been applied. */
export async function assertSchemaReady(): Promise<void> {
  try {
    await withRead((db) => db.get(sql`select 1 from usuarios limit 1`));
    await withRead((db) => db.get(sql`select 1 from __auth_revocations limit 1`));
  } catch (error) {
    throw new Error(
      'Banco não inicializado ou migrations pendentes (usuarios/sessões). Execute `npm run db:migrate` antes de iniciar o backend.',
      { cause: error },
    );
  }
}

export { databasePath };
