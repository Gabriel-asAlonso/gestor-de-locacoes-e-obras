import { Hono } from 'hono';
import type { AppEnv } from '../common/types.ts';
import { created, ok } from '../common/http.ts';
import { NotFoundError } from '../common/errors.ts';
import { readJson, readParams, readQuery } from '../common/validation.ts';
import { requireAuth } from '../auth/auth.middleware.ts';
import { requirePermission } from '../permissions/authorize.middleware.ts';
import { PERMISSIONS } from '../permissions/permissions.ts';
import { receiptCreateSchema, receiptIdSchema, receiptListQuerySchema, receiptReversalSchema } from './dto.ts';
import { createReceipt, findReceipt, listReceipts, reverseReceipt } from './receipts.service.ts';

export const receiptsRoutes = new Hono<AppEnv>();
receiptsRoutes.use('*', requireAuth);
receiptsRoutes.get('/', requirePermission(PERMISSIONS.RECEBIMENTOS_LER), async (c) => c.json(await listReceipts(readQuery(c, receiptListQuerySchema))));
receiptsRoutes.get('/:id', requirePermission(PERMISSIONS.RECEBIMENTOS_LER), async (c) => { const row = await findReceipt(readParams(c, receiptIdSchema).id); if (!row) throw new NotFoundError('Recebimento não encontrado.'); return ok(c, row); });
receiptsRoutes.post('/', requirePermission(PERMISSIONS.RECEBIMENTOS_REGISTRAR), async (c) => created(c, await createReceipt(await readJson(c, receiptCreateSchema), { actorId: c.get('user').id })));
receiptsRoutes.post('/:id/estornar', requirePermission(PERMISSIONS.RECEBIMENTOS_ESTORNAR), async (c) => ok(c, await reverseReceipt(readParams(c, receiptIdSchema).id, (await readJson(c, receiptReversalSchema)).motivo, { actorId: c.get('user').id })));
