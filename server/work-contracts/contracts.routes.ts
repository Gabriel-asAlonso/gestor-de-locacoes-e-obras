import { Hono } from 'hono';
import type { AppEnv } from '../common/types.ts';
import { created, ok } from '../common/http.ts';
import { readJson, readParams } from '../common/validation.ts';
import { requireAuth } from '../auth/auth.middleware.ts';
import { requirePermission } from '../permissions/authorize.middleware.ts';
import { PERMISSIONS } from '../permissions/permissions.ts';
import { contractCreateSchema, contractParamsSchema, contractPaymentParamsSchema, contractPaymentSchema, contractReversalSchema, worksNestParamsSchema } from './dto.ts';
import { createContract, listContracts, registerContractPayment, reverseContractPayment } from './contracts.service.ts';

// Montado em /obras/:obraId/contratacoes.
export const workContractsRoutes = new Hono<AppEnv>();
workContractsRoutes.use('*', requireAuth);
workContractsRoutes.get('/', requirePermission(PERMISSIONS.OBRAS_LER), async (c) => c.json(await listContracts(readParams(c, worksNestParamsSchema).obraId)));
workContractsRoutes.post('/', requirePermission(PERMISSIONS.DESPESAS_CRIAR), async (c) => created(c, await createContract(readParams(c, worksNestParamsSchema).obraId, await readJson(c, contractCreateSchema), { actorId: c.get('user').id })));
workContractsRoutes.post('/:id/pagamentos', requirePermission(PERMISSIONS.DESPESAS_PAGAR), async (c) => { const p = readParams(c, contractParamsSchema); return created(c, await registerContractPayment(p.obraId, p.id, await readJson(c, contractPaymentSchema), { actorId: c.get('user').id })); });
workContractsRoutes.post('/:id/pagamentos/:pagId/estornar', requirePermission(PERMISSIONS.DESPESAS_ESTORNAR), async (c) => { const p = readParams(c, contractPaymentParamsSchema); return ok(c, await reverseContractPayment(p.obraId, p.id, p.pagId, (await readJson(c, contractReversalSchema)).motivo, { actorId: c.get('user').id })); });
