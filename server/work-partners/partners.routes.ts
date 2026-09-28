import { Hono } from 'hono';
import type { AppEnv } from '../common/types.ts';
import { created, ok } from '../common/http.ts';
import { readJson, readParams } from '../common/validation.ts';
import { requireAuth } from '../auth/auth.middleware.ts';
import { requirePermission } from '../permissions/authorize.middleware.ts';
import { PERMISSIONS } from '../permissions/permissions.ts';
import { contributionCreateSchema, contributionPaymentSchema, cotaParamsSchema, participationPatchSchema, partnerCreateSchema, socioParamsSchema, worksNestParamsSchema } from './dto.ts';
import { addPartner, createContribution, editParticipation, listContributions, listPartners, registerContributionPayment, removePartner } from './partners.service.ts';

// Montado em /obras/:obraId/socios — participação societária versionada (E27).
export const workPartnersRoutes = new Hono<AppEnv>();
workPartnersRoutes.use('*', requireAuth);
workPartnersRoutes.get('/', requirePermission(PERMISSIONS.SOCIOS_LER), async (c) => c.json(await listPartners(readParams(c, worksNestParamsSchema).obraId)));
workPartnersRoutes.post('/', requirePermission(PERMISSIONS.SOCIOS_GERIR), async (c) => created(c, await addPartner(readParams(c, worksNestParamsSchema).obraId, await readJson(c, partnerCreateSchema), { actorId: c.get('user').id })));
workPartnersRoutes.patch('/:socioId', requirePermission(PERMISSIONS.SOCIOS_GERIR), async (c) => { const p = readParams(c, socioParamsSchema); return ok(c, await editParticipation(p.obraId, p.socioId, await readJson(c, participationPatchSchema), { actorId: c.get('user').id })); });
workPartnersRoutes.delete('/:socioId', requirePermission(PERMISSIONS.SOCIOS_GERIR), async (c) => { const p = readParams(c, socioParamsSchema); return ok(c, await removePartner(p.obraId, p.socioId, { actorId: c.get('user').id })); });

// Montado em /obras/:obraId/aportes — aportes, cotas (rateio) e pagamentos (E29–E32).
export const workContributionsRoutes = new Hono<AppEnv>();
workContributionsRoutes.use('*', requireAuth);
workContributionsRoutes.get('/', requirePermission(PERMISSIONS.APORTES_LER), async (c) => c.json(await listContributions(readParams(c, worksNestParamsSchema).obraId)));
workContributionsRoutes.post('/', requirePermission(PERMISSIONS.APORTES_REGISTRAR), async (c) => created(c, await createContribution(readParams(c, worksNestParamsSchema).obraId, await readJson(c, contributionCreateSchema), { actorId: c.get('user').id })));
workContributionsRoutes.post('/:aporteId/cotas/:cotaId/pagamentos', requirePermission(PERMISSIONS.APORTES_PAGAR), async (c) => { const p = readParams(c, cotaParamsSchema); return created(c, await registerContributionPayment(p.obraId, p.aporteId, p.cotaId, await readJson(c, contributionPaymentSchema), { actorId: c.get('user').id })); });
