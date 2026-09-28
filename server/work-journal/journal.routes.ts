import { Hono } from 'hono';
import type { AppEnv } from '../common/types.ts';
import { created, ok } from '../common/http.ts';
import { ValidationError } from '../common/errors.ts';
import { readJson, readParams, readQuery } from '../common/validation.ts';
import { requireAuth } from '../auth/auth.middleware.ts';
import { requirePermission } from '../permissions/authorize.middleware.ts';
import { PERMISSIONS } from '../permissions/permissions.ts';
import { journalCreateSchema, journalEntryParams, journalParams, journalQuerySchema, pendingCreateSchema } from './dto.ts';
import { addJournalFile, createJournalEntry, createPending, findJournalEntry, listJournal, listPending, resolvePending } from './journal.service.ts';

export const journalRoutes = new Hono<AppEnv>();
journalRoutes.use('*', requireAuth);
journalRoutes.get('/', requirePermission(PERMISSIONS.OBRAS_LER), async (c) => c.json(await listJournal(readParams(c, journalParams).obraId, readQuery(c, journalQuerySchema))));
journalRoutes.get('/:id', requirePermission(PERMISSIONS.OBRAS_LER), async (c) => {
  const p = readParams(c, journalEntryParams); return ok(c, await findJournalEntry(p.obraId, p.id));
});
journalRoutes.post('/', requirePermission(PERMISSIONS.OBRAS_EDITAR), async (c) => created(c,
  await createJournalEntry(readParams(c, journalParams).obraId, await readJson(c, journalCreateSchema), { actorId: c.get('user').id })));
journalRoutes.post('/:id/documentos', requirePermission(PERMISSIONS.DOCUMENTOS_GERIR), async (c) => {
  const p = readParams(c, journalEntryParams);
  const body = await c.req.parseBody();
  if (!(body.arquivo instanceof File)) throw new ValidationError('Informe um arquivo válido.');
  return created(c, await addJournalFile(p.obraId, p.id, body.arquivo, { actorId: c.get('user').id }));
});

export const pendingRoutes = new Hono<AppEnv>();
pendingRoutes.use('*', requireAuth);
pendingRoutes.get('/', requirePermission(PERMISSIONS.OBRAS_LER), async (c) => c.json(await listPending(readParams(c, journalParams).obraId)));
pendingRoutes.post('/', requirePermission(PERMISSIONS.OBRAS_EDITAR), async (c) => created(c,
  await createPending(readParams(c, journalParams).obraId, await readJson(c, pendingCreateSchema), { actorId: c.get('user').id })));
pendingRoutes.post('/:id/resolver', requirePermission(PERMISSIONS.OBRAS_EDITAR), async (c) => {
  const p = readParams(c, journalEntryParams); return ok(c, await resolvePending(p.obraId, p.id, { actorId: c.get('user').id }));
});
