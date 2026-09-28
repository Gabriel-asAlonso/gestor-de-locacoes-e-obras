import { Hono } from 'hono';
import type { AppEnv } from '../common/types.ts';
import { created, ok } from '../common/http.ts';
import { NotFoundError } from '../common/errors.ts';
import { readJson, readParams, readQuery } from '../common/validation.ts';
import { requireAuth } from '../auth/auth.middleware.ts';
import { requirePermission } from '../permissions/authorize.middleware.ts';
import { PERMISSIONS } from '../permissions/permissions.ts';
import { contractCreateSchema, contractIdSchema, contractListQuerySchema } from './dto.ts';
import { createContract, findContract, listContracts } from './contracts.service.ts';

export const contractsRoutes = new Hono<AppEnv>();
contractsRoutes.use('*', requireAuth);
contractsRoutes.get('/', requirePermission(PERMISSIONS.CONTRATOS_LER), async (c) => c.json(await listContracts(readQuery(c, contractListQuerySchema))));
contractsRoutes.get('/:id', requirePermission(PERMISSIONS.CONTRATOS_LER), async (c) => { const row = await findContract(readParams(c, contractIdSchema).id); if (!row) throw new NotFoundError('Contrato não encontrado.'); return ok(c, row); });
contractsRoutes.post('/', requirePermission(PERMISSIONS.CONTRATOS_CRIAR), async (c) => created(c, await createContract(await readJson(c, contractCreateSchema), { actorId: c.get('user').id })));
