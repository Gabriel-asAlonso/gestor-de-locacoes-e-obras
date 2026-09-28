import { Hono } from 'hono';
import type { AppEnv } from '../common/types.ts';
import { created, ok } from '../common/http.ts';
import { NotFoundError } from '../common/errors.ts';
import { readJson, readParams, readQuery } from '../common/validation.ts';
import { requireAuth } from '../auth/auth.middleware.ts';
import { requirePermission } from '../permissions/authorize.middleware.ts';
import { PERMISSIONS } from '../permissions/permissions.ts';
import { supplierCreateSchema, supplierIdSchema, supplierListQuerySchema } from './dto.ts';
import { createSupplier, findSupplier, listSuppliers } from './suppliers.service.ts';

export const suppliersRoutes = new Hono<AppEnv>();
suppliersRoutes.use('*', requireAuth);
suppliersRoutes.get('/', requirePermission(PERMISSIONS.FORNECEDORES_LER), async (c) => c.json(await listSuppliers(readQuery(c, supplierListQuerySchema))));
suppliersRoutes.get('/:id', requirePermission(PERMISSIONS.FORNECEDORES_LER), async (c) => { const row = await findSupplier(readParams(c, supplierIdSchema).id); if (!row) throw new NotFoundError('Fornecedor não encontrado.'); return ok(c, row); });
suppliersRoutes.post('/', requirePermission(PERMISSIONS.FORNECEDORES_CRIAR), async (c) => created(c, await createSupplier(await readJson(c, supplierCreateSchema), { actorId: c.get('user').id })));
