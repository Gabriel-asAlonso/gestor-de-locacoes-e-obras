/**
 * Registry for future business modules. Each module (obras, despesas, cobrancas,
 * socios, aportes, documentos, ...) will expose a Hono router and mount it under /api
 * here. Intentionally empty in the foundation phase — the architecture supports the
 * expansion without changing the core.
 *
 * Example (later):
 *   import { obrasRoutes } from './obras/obras.routes.ts';
 *   api.route('/obras', obrasRoutes);
 */
import type { Hono } from 'hono';
import type { AppEnv } from '../common/types.ts';
import { portfoliosRoutes } from '../portfolios/portfolios.routes.ts';
import { propertiesRoutes } from '../properties/properties.routes.ts';
import { unitsRoutes } from '../units/units.routes.ts';
import { tenantsRoutes } from '../tenants/tenants.routes.ts';
import { agenciesRoutes } from '../agencies/agencies.routes.ts';
import { contractsRoutes } from '../contracts/contracts.routes.ts';
import { chargesRoutes } from '../charges/charges.routes.ts';
import { receiptsRoutes } from '../receipts/receipts.routes.ts';
import { negotiationsRoutes } from '../negotiations/negotiations.routes.ts';
import { suppliersRoutes } from '../suppliers/suppliers.routes.ts';
import { expenseCategoriesRoutes } from '../expense-categories/categories.routes.ts';
import { expensesRoutes } from '../expenses/expenses.routes.ts';
import { professionalsRoutes } from '../professionals/professionals.routes.ts';
import { worksRoutes } from '../works/works.routes.ts';
import { activitiesRoutes } from '../work-activities/activities.routes.ts';
import { workTeamRoutes } from '../work-team/team.routes.ts';
import { workContractsRoutes } from '../work-contracts/contracts.routes.ts';
import { documentsRoutes } from '../documents/documents.routes.ts';
import { financeRoutes } from '../work-finance/finance.routes.ts';
import { journalRoutes, pendingRoutes } from '../work-journal/journal.routes.ts';
import { workContributionsRoutes, workPartnersRoutes } from '../work-partners/partners.routes.ts';

export function registerModules(api: Hono<AppEnv>): void {
  api.route('/carteiras', portfoliosRoutes);
  api.route('/imoveis', propertiesRoutes);
  api.route('/unidades', unitsRoutes);
  api.route('/locatarios', tenantsRoutes);
  api.route('/imobiliarias', agenciesRoutes);
  api.route('/contratos', contractsRoutes);
  api.route('/cobrancas', chargesRoutes);
  api.route('/recebimentos', receiptsRoutes);
  api.route('/negociacoes', negotiationsRoutes);
  api.route('/fornecedores', suppliersRoutes);
  api.route('/categorias-despesa', expenseCategoriesRoutes);
  api.route('/despesas', expensesRoutes);
  api.route('/profissionais', professionalsRoutes);
  api.route('/obras', worksRoutes);
  api.route('/obras/:obraId/atividades', activitiesRoutes);
  api.route('/obras/:obraId/equipe', workTeamRoutes);
  api.route('/obras/:obraId/contratacoes', workContractsRoutes);
  api.route('/obras/:obraId/financeiro', financeRoutes);
  api.route('/obras/:obraId/diario', journalRoutes);
  api.route('/obras/:obraId/pendencias', pendingRoutes);
  api.route('/obras/:obraId/socios', workPartnersRoutes);
  api.route('/obras/:obraId/aportes', workContributionsRoutes);
  api.route('/documentos', documentsRoutes);
}
