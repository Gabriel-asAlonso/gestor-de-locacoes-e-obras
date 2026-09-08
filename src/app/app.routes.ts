import type { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { AppShellComponent } from './layout/app-shell.component';
import { LoginPage } from './features/auth/login.page';
import { DashboardPage } from './features/rentals/dashboard.page';
import { PortfoliosPage } from './features/rentals/portfolios.page';
import { PropertiesPage } from './features/rentals/properties.page';
import { UnitsPage } from './features/rentals/units.page';
import { TenantsPage } from './features/rentals/tenants.page';
import { ContractsPage } from './features/rentals/contracts.page';
import { ChargesPage } from './features/rentals/charges.page';
import { ExpensesPage } from './features/rentals/expenses.page';
import { WorksDashboardPage } from './features/works/works-dashboard.page';
import { WorksListPage } from './features/works/works-list.page';
import { WorkFormPage } from './features/works/work-form.page';
import { WorkDetailPage } from './features/works/work-detail.page';

export const appRoutes: Routes = [
  { path: 'login', component: LoginPage, title: 'Acesso' },
  {
    path: '',
    component: AppShellComponent,
    canActivate: [authGuard],
    children: [
      { path: 'inicio', component: DashboardPage, data: { title: 'Visão geral' }, title: 'Visão geral · Gestor Patrimonial' },
      { path: 'carteiras', component: PortfoliosPage, data: { title: 'Carteiras' }, title: 'Carteiras · Gestor Patrimonial' },
      { path: 'imoveis', component: PropertiesPage, data: { title: 'Imóveis' }, title: 'Imóveis · Gestor Patrimonial' },
      { path: 'unidades', component: UnitsPage, data: { title: 'Unidades' }, title: 'Unidades · Gestor Patrimonial' },
      { path: 'locatarios', component: TenantsPage, data: { title: 'Locatários' }, title: 'Locatários · Gestor Patrimonial' },
      { path: 'contratos', component: ContractsPage, data: { title: 'Contratos' }, title: 'Contratos · Gestor Patrimonial' },
      { path: 'cobrancas', component: ChargesPage, data: { title: 'Cobranças' }, title: 'Cobranças · Gestor Patrimonial' },
      { path: 'despesas', component: ExpensesPage, data: { title: 'Despesas' }, title: 'Despesas · Gestor Patrimonial' },
      { path: 'obras/inicio', component: WorksDashboardPage, data: { title: 'Painel de obras' }, title: 'Painel de obras · Gestor Patrimonial' },
      { path: 'obras', component: WorksListPage, pathMatch: 'full', data: { title: 'Todas as obras' }, title: 'Obras · Gestor Patrimonial' },
      { path: 'obras/nova', component: WorkFormPage, data: { title: 'Nova obra' }, title: 'Nova obra · Gestor Patrimonial' },
      { path: 'obras/:id/editar', component: WorkFormPage, data: { title: 'Editar obra' }, title: 'Editar obra · Gestor Patrimonial' },
      { path: 'obras/:id', component: WorkDetailPage, data: { title: 'Detalhe da obra' }, title: 'Detalhe da obra · Gestor Patrimonial' },
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
    ],
  },
  { path: '**', redirectTo: '' },
];
