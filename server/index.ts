/**
 * Backend entry point. Fails fast and clearly when configuration is invalid, the
 * database is unreachable, or migrations have not been applied. Only starts serving
 * when the foundation is healthy.
 */
import { serve } from '@hono/node-server';
import { loadConfig } from './config/env.ts';
import { logger } from './common/logger.ts';
import { EVENTS } from './observability/event-codes.ts';
import { assertSchemaReady, databasePath, pingDatabase } from './database/connection.ts';
import { buildApp } from './app.ts';

async function main(): Promise<void> {
  // 1. Configuration (fail-fast; secrets have no defaults).
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    // Config isn't ready, so log plainly to stderr and stop.
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }

  // 2. Database reachable?
  if (!(await pingDatabase())) {
    logger.critical(EVENTS.DATABASE_UNAVAILABLE, { databasePath: databasePath() }, 'Banco de dados indisponível durante a inicialização.');
    process.stderr.write('Não foi possível conectar ao banco de dados. Verifique DATABASE_PATH.\n');
    process.exit(1);
  }

  // 3. Migrations applied?
  try {
    await assertSchemaReady();
  } catch (err) {
    logger.critical(EVENTS.DATABASE_UNAVAILABLE, { error: err }, 'Schema do banco não está pronto.');
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }

  const app = buildApp();
  const server = serve({ fetch: app.fetch, port: config.APP_PORT, hostname: config.APP_HOST }, (info) => {
    logger.info(EVENTS.SERVER_STARTED, {
      env: config!.APP_ENV,
      host: config!.APP_HOST,
      port: info.port,
      databasePath: databasePath(),
    });
  });

  const shutdown = (signal: string) => {
    logger.info(EVENTS.SERVER_STOPPING, { signal }, 'Servidor encerrando.');
    server.close(() => process.exit(0));
    // Force-exit if close hangs.
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => logger.critical(EVENTS.PROCESS_UNHANDLED_REJECTION, { error: reason }, 'Promise rejeitada sem tratamento.'));
  process.on('uncaughtException', (err) => {
    logger.critical(EVENTS.PROCESS_UNCAUGHT_EXCEPTION, { error: err }, 'Exceção não capturada no processo.');
    process.exit(1);
  });
}

void main();
