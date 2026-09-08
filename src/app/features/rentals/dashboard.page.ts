import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { PROPERTY_IMAGES } from '../../core/data/demo-data';
import { AppStore } from '../../core/services/app-store.service';
import type { Charge } from '../../core/models/domain.models';
import { brl, chargeBalance, chargeTotal, receivedTotal } from '../../core/utils/domain.utils';

@Component({
  selector: 'app-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page-enter">
      <article class="dashboard-executive-hero">
        <div class="dashboard-executive-main">
          <header><div><i class="dashboard-live-dot"></i>PAINEL EXECUTIVO ATUALIZADO</div><b>AGOSTO · 2026</b></header>
          <div class="dashboard-executive-copy"><p>Gestão patrimonial consolidada</p><h1>Visão geral</h1><span>Carteiras, contratos e fluxo financeiro no mesmo panorama.</span></div>
          <div class="dashboard-result"><span>Resultado operacional previsto</span><strong class="positive">{{ money(result()) }}</strong><small>Recebíveis menos despesas pendentes</small></div>
          <div class="dashboard-result-breakdown"><span><small>Faturado</small><strong>{{ money(billed()) }}</strong></span><i>−</i><span><small>Em aberto</small><strong>{{ money(openBalance()) }}</strong></span><i>−</i><span><small>A pagar</small><strong>{{ money(payable()) }}</strong></span></div>
        </div>
        <aside class="dashboard-executive-pulse">
          <header><div><span>Pulso da operação</span><h2>Pontos essenciais</h2></div><small>● ao vivo</small></header>
          <div class="dashboard-pulse-metrics">
            <button type="button" (click)="go('/cobrancas')"><i class="dashboard-pulse-ring" [style.background]="'conic-gradient(#b85057 0 66%, #e9edf1 66%)'"><span>{{ overdueCount() }}</span></i><span><strong>Cobranças vencidas</strong><small>{{ money(overdueBalance()) }} aguardando ação</small></span><b>→</b></button>
            <button type="button" (click)="go('/unidades')"><i class="dashboard-pulse-ring" [style.background]="'conic-gradient(#3c8b68 0 '+occupancy()+'%, #e9edf1 '+occupancy()+'%)'"><span>{{ occupancy() }}%</span></i><span><strong>Ocupação do portfólio</strong><small>{{ occupiedUnits() }} de {{ store.units().length }} unidades ocupadas</small></span><b>→</b></button>
            <button type="button" (click)="go('/despesas')"><i class="dashboard-pulse-ring" [style.background]="'conic-gradient(#c88a31 0 45%, #e9edf1 45%)'"><span>{{ pendingExpenses() }}</span></i><span><strong>Contas pendentes</strong><small>{{ money(payable()) }} programados</small></span><b>→</b></button>
          </div>
          <footer><button (click)="go('/contratos')">Contratos</button><button (click)="go('/cobrancas')">Recebíveis</button><button (click)="go('/despesas')">Despesas</button></footer>
        </aside>
      </article>

      <section class="dashboard-domain dashboard-domain-operation">
        <header class="dashboard-domain-header"><span class="dashboard-domain-index">01</span><div><p>Patrimônio e ocupação</p><h2>Operação imobiliária</h2><small>Leitura consolidada das carteiras e unidades ativas.</small></div><b>{{ store.properties().length }} IMÓVEIS</b></header>
        <div class="dashboard-domain-content">
          <div class="dashboard-kpis">
            <button class="dashboard-kpi kpi-occupancy" (click)="go('/carteiras')"><span>Carteiras</span><strong>{{ store.portfolios().length }}</strong><small>estruturas patrimoniais</small><i>◇</i></button>
            <button class="dashboard-kpi kpi-contracts" (click)="go('/contratos')"><span>Contratos ativos</span><strong>{{ store.contracts().length }}</strong><small>{{ money(monthlyRent()) }} de aluguel mensal</small><i>▤</i></button>
            <button class="dashboard-kpi kpi-available" (click)="go('/unidades')"><span>Unidades disponíveis</span><strong>{{ availableUnits() }}</strong><small>prontas para nova locação</small><i>□</i></button>
            <button class="dashboard-kpi kpi-occupancy" (click)="go('/unidades')"><span>Taxa de ocupação</span><strong>{{ occupancy() }}%</strong><small>do inventário cadastrado</small><i>◔</i></button>
          </div>
          <div class="dashboard-grid dashboard-grid-operation">
            <article class="dashboard-property-spotlight"><img [src]="featuredImage" alt="Centro Empresarial Nexo"><div class="dashboard-property-spotlight-top"><span>DESTAQUE DA CARTEIRA</span><b>100% operacional</b></div><div class="dashboard-property-spotlight-copy"><span>Carteira Atlas</span><h2>Centro Empresarial Nexo</h2><p>Rua das Acácias, 240 · Centro</p><div><b>3 unidades</b><b>2 contratos ativos</b></div><button type="button" (click)="go('/imoveis')">Ver portfólio imobiliário <span>→</span></button></div></article>
            <article class="dashboard-panel"><header class="dashboard-panel-header"><div><p class="eyebrow">Ocupação</p><h2>Unidades por situação</h2></div></header><div class="status-overview"><div class="status-donut" [style.background]="'conic-gradient(#3157a4 0 '+occupancy()+'%, #dfe5ec '+occupancy()+'%)'"><span><strong>{{ occupancy() }}%</strong><small>ocupadas</small></span></div><div class="status-breakdown"><button (click)="go('/unidades')"><i style="background:#3157a4"></i>Ocupadas <strong>{{ occupiedUnits() }}</strong></button><button (click)="go('/unidades')"><i style="background:#dfe5ec"></i>Disponíveis <strong>{{ availableUnits() }}</strong></button></div></div></article>
          </div>
        </div>
      </section>
      <section class="dashboard-domain dashboard-domain-financial">
        <header class="dashboard-domain-header"><span class="dashboard-domain-index">02</span><div><p>Recebíveis e pagamentos</p><h2>Movimento financeiro</h2><small>Posição das cobranças e contas a pagar.</small></div><b>{{ money(result()) }}</b></header>
        <div class="dashboard-domain-content"><div class="dashboard-kpis dashboard-kpis-three"><button class="dashboard-kpi kpi-receivable" (click)="go('/cobrancas')"><span>Recebido</span><strong>{{ money(received()) }}</strong><small>baixas registradas</small></button><button class="dashboard-kpi kpi-overdue" (click)="go('/cobrancas')"><span>Saldo vencido</span><strong>{{ money(overdueBalance()) }}</strong><small>{{ overdueCount() }} cobranças</small></button><button class="dashboard-kpi kpi-payable" (click)="go('/despesas')"><span>Despesas em aberto</span><strong>{{ money(payable()) }}</strong><small>{{ pendingExpenses() }} lançamentos</small></button></div></div>
      </section>
    </section>
  `,
})
export class DashboardPage {
  readonly store = inject(AppStore);
  private readonly router = inject(Router);
  readonly featuredImage = PROPERTY_IMAGES['IMO-001'];
  readonly billed = computed(() => this.store.charges().reduce((sum, charge) => sum + chargeTotal(charge), 0));
  readonly received = computed(() => this.store.charges().reduce((sum, charge) => sum + receivedTotal(charge), 0));
  readonly openBalance = computed(() => this.store.charges().reduce((sum, charge) => sum + this.operationalBalance(charge), 0));
  readonly overdueBalance = computed(() => this.store.charges().filter(c => c.status === 'Vencida').reduce((sum, c) => sum + this.operationalBalance(c), 0));
  readonly overdueCount = computed(() => this.store.charges().filter(c => c.status === 'Vencida').length);
  readonly payable = computed(() => this.store.expenses().filter(e => e.status !== 'Pago').reduce((sum, e) => sum + e.amount, 0));
  readonly pendingExpenses = computed(() => this.store.expenses().filter(e => e.status !== 'Pago').length);
  readonly occupiedUnits = computed(() => this.store.units().filter(unit => unit.occupied).length);
  readonly availableUnits = computed(() => this.store.units().length - this.occupiedUnits());
  readonly occupancy = computed(() => Math.round(this.occupiedUnits() / Math.max(1, this.store.units().length) * 100));
  readonly monthlyRent = computed(() => this.store.contracts().reduce((sum, contract) => sum + contract.rent, 0));
  readonly result = computed(() => this.openBalance() - this.payable());
  private operationalBalance(charge: Charge): number {
    const negotiation = this.store.negotiations()[charge.id];
    if (!negotiation) return chargeBalance(charge);
    const receiptTotal = (this.store.receipts()[charge.id] ?? []).reduce((sum, receipt) => sum + receipt.amount, 0);
    return Math.max(0, negotiation.negotiatedTotal - (receiptTotal - (negotiation.priorReceiptAmount ?? 0)));
  }
  money(value: number): string { return brl.format(value); }
  go(route: string): void { void this.router.navigateByUrl(route); }
}
