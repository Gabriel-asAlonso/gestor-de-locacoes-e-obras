import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Portfolio } from '../../core/models/domain.models';
import { AppStore } from '../../core/services/app-store.service';
import { EntityModalService } from '../../core/services/entity-modal.service';
import { normalizeSearch } from '../../core/utils/domain.utils';
import { DetailDrawerComponent, type DetailRow } from '../../shared/components/detail-drawer.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { PageHeadingComponent } from '../../shared/components/page-heading.component';

@Component({
  selector: 'app-portfolios-page', imports: [FormsModule, PageHeadingComponent, EmptyStateComponent, DetailDrawerComponent], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page-enter"><app-page-heading title="Carteiras" description="Estruturas patrimoniais, titulares e ativos vinculados." actionLabel="Nova carteira" (action)="modal.open('portfolio')" />
      <div class="portfolio-overview"><div class="portfolio-overview-intro"><span>Estrutura consolidada</span><strong><b>{{ store.portfolios().length }}</b> carteiras ativas</strong><small>Organização por titular e responsabilidade.</small></div><div class="portfolio-overview-metric"><span>Imóveis</span><strong>{{ store.properties().length }}</strong><small>ativos cadastrados</small></div><div class="portfolio-overview-metric"><span>Unidades</span><strong>{{ store.units().length }}</strong><small>espaços gerenciados</small></div><div class="portfolio-overview-occupancy"><span>Ocupação</span><strong>{{ occupancy() }}%</strong><i><b [style.width.%]="occupancy()"></b></i><small>do inventário total</small></div></div>
      <div class="portfolio-controls"><label class="search-field"><span class="app-search-icon">⌕</span><input [(ngModel)]="query" placeholder="Buscar por carteira, titular ou documento" aria-label="Buscar carteiras"></label><span class="app-result-count">{{ filtered().length }} resultado(s)</span></div>
      <section class="table-section"><div class="table-wrap">
        @if (filtered().length) { <table><thead><tr><th>Carteira</th><th>Titular</th><th>Documento</th><th>Imóveis</th><th>Unidades</th><th></th></tr></thead><tbody>@for (item of filtered(); track item.id) { <tr><td><button class="app-table-link" (click)="selected.set(item)"><strong>{{ item.name }}</strong><small>{{ item.id }}</small></button></td><td>{{ item.holder }}</td><td>{{ item.document }}</td><td>{{ item.properties || propertyCount(item) }}</td><td>{{ item.units || unitCount(item) }}</td><td><button class="text-button" (click)="modal.open('portfolio', item)">Editar</button></td></tr> }</tbody></table> } @else { <app-empty-state title="Nenhuma carteira encontrada" description="Ajuste a busca ou cadastre uma nova carteira." /> }
      </div><footer class="table-footer"><span>Cadastro patrimonial</span><span>{{ filtered().length }} de {{ store.portfolios().length }}</span></footer></section>
    </section>
    @if (selected(); as item) { <app-detail-drawer eyebrow="Carteira patrimonial" [title]="item.name" [subtitle]="item.holder" [rows]="rows(item)" actionLabel="Editar carteira" (closed)="selected.set(null)" (action)="modal.open('portfolio', item); selected.set(null)" /> }
  `,
})
export class PortfoliosPage {
  readonly store = inject(AppStore); readonly modal = inject(EntityModalService); readonly selected = signal<Portfolio | null>(null); query = '';
  readonly filtered = computed(() => { const term = normalizeSearch(this.query); return this.store.portfolios().filter(item => !term || normalizeSearch(`${item.name} ${item.holder} ${item.document}`).includes(term)); });
  readonly occupancy = computed(() => Math.round(this.store.units().filter(unit => unit.occupied).length / Math.max(1, this.store.units().length) * 100));
  propertyCount(item: Portfolio): number { return this.store.properties().filter(p => p.portfolio === item.name).length; }
  unitCount(item: Portfolio): number { return this.store.units().filter(u => u.portfolio === item.name).length; }
  rows(item: Portfolio): DetailRow[] { return [{ label: 'Código', value: item.id }, { label: 'Titular', value: item.holder }, { label: 'CPF/CNPJ', value: item.document }, { label: 'Imóveis vinculados', value: String(this.propertyCount(item)) }, { label: 'Unidades vinculadas', value: String(this.unitCount(item)) }, { label: 'Gestor', value: item.manager || 'Núcleo Patrimonial' }]; }
}
