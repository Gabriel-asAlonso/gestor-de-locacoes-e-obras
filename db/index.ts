/** Persistence entry point only: no HTTP server, authentication or business services. */
export { openDatabase, databasePath } from './local.ts';
export type { WriteContext } from './local.ts';
export { tables } from './schema.ts';
export type { EntityModels, EntityInserts, EntityName } from './schema.ts';
