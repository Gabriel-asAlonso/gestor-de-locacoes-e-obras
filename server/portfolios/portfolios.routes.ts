import { Hono } from 'hono';
import type { AppEnv } from '../common/types.ts';
import { created, ok } from '../common/http.ts';
import { NotFoundError } from '../common/errors.ts';
import { readJson, readParams, readQuery } from '../common/validation.ts';
import { requireAuth } from '../auth/auth.middleware.ts';
import { requirePermission } from '../permissions/authorize.middleware.ts';
import { PERMISSIONS } from '../permissions/permissions.ts';
import { portfolioCreateSchema, portfolioIdSchema, portfolioListQuerySchema, portfolioPatchSchema } from './dto.ts';
import { createPortfolio, findPortfolio, listPortfolios, updatePortfolio } from './portfolios.service.ts';

export const portfoliosRoutes = new Hono<AppEnv>();
portfoliosRoutes.use('*', requireAuth);
portfoliosRoutes.get('/', requirePermission(PERMISSIONS.CARTEIRAS_LER), async (c) => c.json(await listPortfolios(readQuery(c, portfolioListQuerySchema))));
portfoliosRoutes.get('/:id', requirePermission(PERMISSIONS.CARTEIRAS_LER), async (c) => { const row = await findPortfolio(readParams(c, portfolioIdSchema).id); if (!row) throw new NotFoundError('Carteira não encontrada.'); return ok(c, row); });
portfoliosRoutes.post('/', requirePermission(PERMISSIONS.CARTEIRAS_CRIAR), async (c) => created(c, await createPortfolio(await readJson(c, portfolioCreateSchema), { actorId: c.get('user').id })));
portfoliosRoutes.patch('/:id', requirePermission(PERMISSIONS.CARTEIRAS_EDITAR), async (c) => ok(c, await updatePortfolio(readParams(c, portfolioIdSchema).id, await readJson(c, portfolioPatchSchema), { actorId: c.get('user').id })));
