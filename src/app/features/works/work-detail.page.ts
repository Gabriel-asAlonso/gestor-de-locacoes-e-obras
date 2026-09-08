import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { FALLBACK_PROPERTY_IMAGE, PROPERTY_IMAGES } from '../../core/data/demo-data';
import type {
  WorkActivity,
  WorkContribution,
  WorkContributionShare,
  WorkFinancialEntry,
  WorkJournalEntry,
  WorkPartner,
  WorkSupplier,
  WorkSupplierStatus,
  WorkTeamAllocation,
} from '../../core/data/work-details.data';
import type { WorkRecord, WorkStatus } from '../../core/data/works.data';
import { AppStore } from '../../core/services/app-store.service';
import { ToastService } from '../../core/services/toast.service';
import { brl, formatDate, nextRecordId, normalizeSearch } from '../../core/utils/domain.utils';
import {
  contributionPaid,
  contributionRemaining,
  createContributionShares,
  nextPartnerRecordId,
  participationTotal,
  partnerTotals,
  shareRemaining,
} from '../../core/utils/work-partners';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';

type WorkTab = 'Resumo' | 'Planejamento' | 'Equipe' | 'Fornecedores' | 'Sócios' | 'Financeiro' | 'Diário';
type WorkDialog = 'progress' | 'activity' | 'block' | 'reprogram' | 'team' | 'supplier' | 'supplierPayment' | 'partner' | 'contribution' | 'partnerPayment' | 'cash' | 'journal' | null;

@Component({
  selector: 'app-work-detail-page',
  imports: [ReactiveFormsModule, EmptyStateComponent, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (work(); as work) {
      <section class="work-detail-page page-enter">
        <header class="work-detail-hero">
          <span class="work-detail-hero-cover"><img [src]="image(work)" [alt]="work.property"><i class="work-detail-hero-cover-shade"></i><span class="work-detail-hero-cover-copy"><small>{{work.id}}</small><strong>{{work.property}}</strong><em>{{work.unit || 'Intervenção geral no imóvel'}}</em></span></span>
          <button class="work-detail-back" type="button" (click)="go('/obras')">← Todas as obras</button>
          <div class="work-detail-title"><div><app-status-badge [value]="work.status"/><span class="app-risk app-risk-{{riskClass(work)}}">{{work.risk}}</span></div><h1>{{work.title}}</h1><p><strong>{{work.manager}}</strong> · {{work.lastUpdateLabel}}</p></div>
          <div class="work-detail-actions"><button class="primary-button" type="button" (click)="openDialog('progress')">Atualizar progresso</button><button class="secondary-button" type="button" (click)="go('/obras/'+work.id+'/editar')">Editar</button></div>
          <dl class="work-detail-hero-metrics"><div><dt>Progresso</dt><dd>{{work.progress}}%</dd><i><b [style.width.%]="work.progress"></b></i></div><div><dt>Conclusão prevista</dt><dd>{{work.endLabel}}</dd><small>{{work.risk}}</small></div><div><dt>Orçamento</dt><dd>{{money(work.budget)}}</dd><small>{{money(work.spent)}} realizados</small></div><div><dt>Saldo projetado</dt><dd>{{money(work.projectedCashBalance)}}</dd><small>após reserva e realizado</small></div></dl>
        </header>

        <nav class="work-detail-tabs" aria-label="Áreas da obra"><div>@for (item of tabs; track item) {<button type="button" [class.active]="tab()===item" (click)="tab.set(item)">{{item}}@if (tabCount(item)) {<b>{{tabCount(item)}}</b>}</button>}</div></nav>

        @if (tab() === 'Resumo') {
          <div class="work-detail-summary">
            <section class="work-detail-decision-card"><header><div><p class="eyebrow">Decisão do momento</p><h2>Próxima atividade da obra</h2></div></header><div class="work-detail-decision-progress"><i class="work-detail-progress-ring" [style.--work-progress]="work.progress*3.6+'deg'"><strong>{{work.progress}}%</strong><small>concluído</small></i><div><span>Próximo passo</span><strong>{{work.nextActivity}}</strong><small>Responsável: {{work.manager}}</small></div></div><footer><button type="button" (click)="tab.set('Planejamento')">Ver cronograma</button><button type="button" (click)="openDialog('progress')">Atualizar avanço</button><button type="button" (click)="openDialog('journal')">Registrar diário</button></footer></section>
            <section class="work-detail-finance-card"><header><div><p class="eyebrow">Posição financeira</p><h2>Orçamento da obra</h2></div></header><dl><div><dt>Previsto</dt><dd>{{money(work.budget)}}</dd></div><div><dt>Realizado</dt><dd>{{money(work.spent)}}</dd></div><div><dt>Reserva</dt><dd>{{money(work.reserve||0)}}</dd></div><div><dt>Saldo</dt><dd [class.negative]="work.projectedCashBalance<0">{{money(work.projectedCashBalance)}}</dd></div></dl><div class="work-detail-finance-usage"><span><small>Consumo do orçamento</small><strong>{{budgetUse(work)}}%</strong></span><i><b [style.width.%]="Math.min(100,budgetUse(work))"></b></i></div><button type="button" (click)="tab.set('Financeiro')">Abrir financeiro →</button></section>
            <section class="work-detail-pending-card"><header><div><p class="eyebrow">Pendências</p><h2>O que precisa de atenção</h2></div><b>{{detail().pendingItems.length}}</b></header><div>@for (item of detail().pendingItems; track item.id) {<article class="work-detail-pending-{{item.tone}}"><span>!</span><span><strong>{{item.title}}</strong><small>{{item.description}}</small></span><button type="button" (click)="resolvePending(item.id)">Resolver</button></article>}@if (!detail().pendingItems.length) {<app-empty-state title="Nenhuma pendência" description="A obra não possui decisões aguardando ação."/>}</div></section>
            <section class="work-detail-team-card"><header><div><p class="eyebrow">Equipe alocada</p><h2>Responsáveis e custo</h2></div><button type="button" (click)="tab.set('Equipe')">Ver equipe</button></header><div>@for (person of detail().team.slice(0,4); track person.id) {<article><span>{{initials(person.name)}}</span><div><strong>{{person.name}}</strong><small>{{person.role}}</small></div><em>{{money(person.quantity*person.unitRate)}}</em></article>}</div><footer><span>{{detail().team.length}} alocações</span><strong>{{money(teamCost())}}</strong></footer></section>
          </div>
        }

        @if (tab() === 'Planejamento') {
          <section class="work-detail-tab-panel"><header><div><p class="eyebrow">Cronograma</p><h2>Etapas e atividades</h2></div><button class="primary-button" type="button" (click)="openDialog('activity')">＋ Nova atividade</button></header><div class="work-planning-stages">@for (activity of detail().activities; track activity.id) {<article [class.blocked]="activity.status==='Bloqueada'"><span>{{activity.id}}</span><div class="work-planning-identity"><small>{{activity.stage}}</small><strong>{{activity.title}}</strong><em>{{activity.manager}}</em>@if(activity.blockedReason){<small>{{activity.blockedReason}}</small>}</div><span class="work-planning-dates">{{format(activity.startDateIso)}} — {{format(activity.endDateIso)}}</span><app-status-badge [value]="activity.status"/><div class="work-planning-actions">@if(activity.status!=='Concluída'){<button type="button" (click)="completeActivity(activity)">Concluir</button>}@if(activity.status!=='Bloqueada'&&activity.status!=='Concluída'){<button type="button" (click)="openActivityDialog('block',activity)">Bloquear</button>}<button type="button" (click)="openActivityDialog('reprogram',activity)">Reprogramar</button></div></article>}</div></section>
        }

        @if (tab() === 'Equipe') {
          <section class="work-detail-tab-panel"><header><div><p class="eyebrow">Pessoas e alocações</p><h2>Equipe da obra</h2></div><button class="primary-button" type="button" (click)="openDialog('team')">＋ Alocar profissional</button></header>@if (detail().team.length) {<div class="work-team-list">@for (person of detail().team; track person.id) {<article><span>{{initials(person.name)}}</span><div><strong>{{person.name}}</strong><small>{{person.role}}</small></div><div><small>Período</small><strong>{{format(person.startDateIso)}} — {{format(person.endDateIso)}}</strong></div><div><small>Custo</small><strong>{{money(person.quantity*person.unitRate)}}</strong></div><button class="work-team-remove" type="button" (click)="removeTeam(person.id)" [attr.aria-label]="'Remover '+person.name">×</button></article>}</div>} @else {<app-empty-state title="Equipe não alocada" description="Adicione os responsáveis por esta obra."/>}</section>
        }

        @if (tab() === 'Fornecedores') {
          <section class="work-detail-tab-panel work-suppliers-panel"><header><div><p class="eyebrow">Contratações</p><h2>Fornecedores e pagamentos</h2></div><button class="primary-button" type="button" (click)="openDialog('supplier')">＋ Novo fornecedor</button></header><div class="work-suppliers-metrics"><article><span>▣</span><div><small>Fornecedores</small><strong>{{detail().suppliers.length}}</strong><em>contratos ativos</em></div></article><article><span>R$</span><div><small>Contratado</small><strong>{{money(supplierContracted())}}</strong><em>valor total</em></div></article><article><span>✓</span><div><small>Pago</small><strong>{{money(supplierPaid())}}</strong><em>baixas registradas</em></div></article><article class="attention"><span>!</span><div><small>Saldo</small><strong>{{money(supplierContracted()-supplierPaid())}}</strong><em>a pagar</em></div></article></div>@if (detail().suppliers.length) {<div class="work-suppliers-table-wrap"><table class="work-suppliers-table"><thead><tr><th>Fornecedor</th><th>Objeto</th><th>Contratado</th><th>Pago</th><th>Saldo</th><th>Situação</th><th>Ações</th></tr></thead><tbody>@for (item of detail().suppliers; track item.id) {<tr><td><span class="work-supplier-name"><span>{{initials(item.name)}}</span><b>{{item.name}}</b><small>{{item.id}}</small></span></td><td>{{item.description}}<small>{{item.payments.length}} pagamento(s)</small></td><td><b>{{money(item.contractedAmount)}}</b></td><td><b class="positive">{{money(item.paidAmount)}}</b></td><td><b [class.negative]="item.contractedAmount>item.paidAmount">{{money(item.contractedAmount-item.paidAmount)}}</b></td><td><span class="work-supplier-status work-supplier-status-{{slug(item.status)}}"><i></i>{{item.status}}</span></td><td>@if(item.contractedAmount>item.paidAmount){<button class="work-contribution-open" type="button" (click)="openSupplierPayment(item)">Registrar pagamento</button>}@else{<small>Quitado</small>}</td></tr>}</tbody></table></div>} @else {<app-empty-state title="Nenhum fornecedor" description="Cadastre contratos de serviços, produtos ou materiais."/>}</section>
        }

        @if (tab() === 'Sócios') {
          <section class="work-detail-tab-panel work-partners-panel"><header><div><p class="eyebrow">Participação e aportes</p><h2>Sócios da obra</h2></div><div class="work-partners-header-actions"><button class="secondary-button" type="button" [disabled]="participation()>=100" (click)="openDialog('partner')">＋ Sócio</button><button class="primary-button" type="button" [disabled]="participation()!==100" (click)="openDialog('contribution')">＋ Aporte</button></div></header><div class="work-partners-metrics"><article><span>%</span><div><small>Participação</small><strong>{{participation()}}%</strong><em>de 100% distribuídos</em></div></article><article><span>R$</span><div><small>Aportes previstos</small><strong>{{money(contributionTotal())}}</strong><em>{{detail().contributions.length}} registros</em></div></article><article class="complete"><span>✓</span><div><small>Integralizado</small><strong>{{money(contributionPaidTotal())}}</strong><em>capital recebido</em></div></article><article class="attention"><span>!</span><div><small>Pendente</small><strong>{{money(contributionPending())}}</strong><em>a integralizar</em></div></article></div><section class="work-partner-list"><header><div><p class="eyebrow">Quadro societário</p><h3>Participantes</h3></div><span>{{detail().partners.length}} sócios</span></header>@if (detail().partners.length) {<div>@for (partner of detail().partners; track partner.id) {<article [class.has-pending]="partnerValue(partner).pending>0"><header><span class="partner-avatar">{{initials(partner.name)}}</span><div><small>{{partner.id}}</small><strong>{{partner.name}}</strong><em>{{partnerValue(partner).status}}</em></div><i class="partner-percentage" [style.--partner-percent]="partner.participationPercent*3.6+'deg'"><b>{{partner.participationPercent}}%</b></i></header><dl><div><dt>Investido</dt><dd>{{money(partnerValue(partner).invested)}}</dd></div><div><dt>Pendente</dt><dd [class.negative]="partnerValue(partner).pending>0">{{money(partnerValue(partner).pending)}}</dd></div></dl><footer><button type="button" disabled>Histórico nos aportes</button><button type="button" class="danger" (click)="removePartner(partner.id)">×</button></footer></article>}</div>} @else {<app-empty-state title="Nenhum sócio cadastrado" description="Cadastre as participações antes de registrar aportes."/>}</section><section class="work-contributions"><header><div><p class="eyebrow">Aportes</p><h3>Capital solicitado</h3></div><span>{{detail().contributions.length}} lançamentos</span></header>@if (detail().contributions.length) {<div class="app-contribution-list">@for (item of detail().contributions; track item.id) {<article><span><strong>{{item.description}}</strong><small>{{format(item.dateIso)}} · {{item.id}}</small></span><b>{{money(item.amount)}}</b><em>{{money(contributionPaid(item))}} recebido</em><small>{{money(contributionRemaining(item))}} pendente</small>@if(contributionRemaining(item)>0){<button class="work-contribution-open" type="button" (click)="openPartnerPayment(item)">Registrar pagamento</button>}</article>}</div>} @else {<app-empty-state title="Nenhum aporte registrado" description="Com 100% das participações distribuídas, registre o capital solicitado."/>}</section></section>
        }

        @if (tab() === 'Financeiro') {
          <section class="work-detail-tab-panel work-finance-panel"><header><div><p class="eyebrow">Movimentação financeira</p><h2>Fluxo da obra</h2></div><button class="secondary-button" type="button" (click)="openDialog('cash')">Ajustar caixa</button></header><div class="work-finance-metrics"><article><small>Orçamento</small><strong>{{money(work.budget)}}</strong></article><article><small>Aportes recebidos</small><strong>{{money(contributionPaidTotal())}}</strong></article><article><small>Fornecedores pagos</small><strong>{{money(supplierPaid())}}</strong></article><article><small>Equipe prevista</small><strong>{{money(teamCost())}}</strong></article></div><div class="work-finance-list">@for (item of detail().financialEntries; track item.id) {<article><span>R$</span><div><strong>{{item.description}}</strong><small>{{item.party}} · {{format(item.dateIso)}}</small></div><b [class.negative]="item.amount<0">{{money(item.amount)}}</b><app-status-badge [value]="item.status"/></article>}@if (!detail().financialEntries.length) {<app-empty-state title="Sem movimentações" description="Aportes recebidos e ajustes aparecerão aqui."/>}</div></section>
        }

        @if (tab() === 'Diário') {
          <section class="work-detail-tab-panel"><header><div><p class="eyebrow">Linha do tempo</p><h2>Diário da obra</h2></div><button class="primary-button" type="button" (click)="openDialog('journal')">＋ Novo registro</button></header><div class="work-journal-layout"><div class="work-journal-timeline">@for (item of detail().journal; track item.id) {<article><time>{{format(item.dateIso)}}</time><i></i><div><small>{{item.kind}} · {{item.author}}</small><strong>{{item.title}}</strong><p>{{item.description}}</p>@if (item.files.length) {<span>{{item.files.join(' · ')}}</span>}</div></article>}</div><aside class="work-journal-files"><h3>Arquivos recentes</h3>@for (item of journalFiles(); track item) {<span>▧ {{item}}</span>}@if (!journalFiles().length) {<small>Nenhum arquivo anexado.</small>}</aside></div></section>
        }
      </section>
    } @else {
      <section class="system-error"><span>!</span><h1>Obra não encontrada</h1><p>O registro solicitado não existe.</p><button class="primary-button" type="button" (click)="go('/obras')">Voltar para obras</button></section>
    }

    @if (dialog()) {
      <section class="modal-layer" role="dialog" aria-modal="true" [attr.aria-label]="dialogTitle()"><button class="drawer-backdrop" type="button" (click)="closeDialog()"></button><form class="receipt-modal work-detail-modal" [formGroup]="actionForm" (ngSubmit)="saveAction()"><header><div><p class="eyebrow">Gestão de obra</p><h2>{{dialogTitle()}}</h2></div><button class="close-button" type="button" (click)="closeDialog()">×</button></header><div class="form-grid">
        @switch (dialog()) {
          @case ('progress') {<label>Progresso (%) *<input type="number" min="0" max="100" formControlName="progress"></label><label>Situação<select formControlName="status"><option>Planejada</option><option>Em andamento</option><option>Pausada</option><option>Concluída</option><option>Cancelada</option></select></label><label class="full-field">Próxima atividade<input formControlName="description"></label>}
          @case ('activity') {<label>Etapa<select formControlName="stage"><option>Preparação</option><option>Execução</option><option>Entrega</option></select></label><label>Responsável *<input formControlName="role"></label><label class="full-field">Atividade *<input formControlName="name"></label><label>Início<input type="date" formControlName="date"></label><label>Conclusão<input type="date" formControlName="endDate"></label>}
          @case ('block') {<p class="work-detail-modal-context full-field"><strong>{{targetActivity()?.title}}</strong>O motivo ficará visível no planejamento e no diário.</p><label class="full-field">Motivo do bloqueio *<textarea rows="4" formControlName="description"></textarea></label>}
          @case ('reprogram') {<p class="work-detail-modal-context full-field"><strong>{{targetActivity()?.title}}</strong>Prazo atual: {{format(targetActivity()?.endDateIso || '')}}</p><label>Nova conclusão *<input type="date" formControlName="endDate"></label><label class="full-field">Justificativa *<textarea rows="3" formControlName="description"></textarea></label>}
          @case ('team') {<label>Profissional *<input formControlName="name"></label><label>Função *<input formControlName="role"></label><label>Modalidade<select formControlName="mode"><option>Horas</option><option>Diárias</option></select></label><label>Quantidade *<input type="number" min="0.5" step="0.5" formControlName="quantity"></label><label>Valor unitário *<input type="number" min="0" step="0.01" formControlName="amount"></label>}
          @case ('supplier') {<label>Fornecedor *<input formControlName="name"></label><label>Tipo<select formControlName="supplyType"><option>Serviço</option><option>Produto</option><option>Material</option></select></label><label class="full-field">Objeto contratado *<input formControlName="description"></label><label>Valor contratado *<input type="number" min="0.01" step="0.01" formControlName="amount"></label><label>Vencimento<input type="date" formControlName="date"></label>}
          @case ('supplierPayment') {<p class="work-detail-modal-context full-field"><strong>{{selectedSupplier()?.name}}</strong>Saldo pendente: {{money(supplierPaymentLimit())}}</p><label>Valor pago *<input type="number" min="0.01" [max]="supplierPaymentLimit()" step="0.01" formControlName="amount"></label><label>Data do pagamento *<input type="date" formControlName="date"></label><label class="full-field">Observação<textarea rows="3" formControlName="description"></textarea></label><label class="full-field">Comprovante (nome do arquivo)<input formControlName="files"></label>}
          @case ('partner') {<label>Nome do sócio *<input formControlName="name"></label><label>Participação (%) *<input type="number" min="0.01" max="100" step="0.01" formControlName="percent"></label>}
          @case ('contribution') {<label class="full-field">Descrição *<input formControlName="description"></label><label>Valor do aporte *<input type="number" min="0.01" step="0.01" formControlName="amount"></label><label>Data<input type="date" formControlName="date"></label>}
          @case ('partnerPayment') {<p class="work-detail-modal-context full-field"><strong>{{selectedContribution()?.description}}</strong>Selecione o sócio e registre somente o valor efetivamente recebido.</p><label class="full-field">Sócio<select formControlName="party" (change)="syncPartnerPaymentAmount()">@for(share of pendingShares();track share.partnerId){<option [value]="share.partnerId">{{share.partnerName}} · saldo {{money(shareRemaining(share))}}</option>}</select></label><label>Valor recebido *<input type="number" min="0.01" [max]="partnerPaymentLimit()" step="0.01" formControlName="amount"></label><label>Data do pagamento *<input type="date" formControlName="date"></label><label class="full-field">Observação<textarea rows="3" formControlName="description"></textarea></label>}
          @case ('cash') {<p class="work-detail-modal-context full-field"><strong>Ajuste manual</strong>Use valor positivo ou negativo para corrigir o caixa após conferência.</p><label>Data *<input type="date" formControlName="date"></label><label class="full-field">Descrição *<input formControlName="description"></label><label>Valor do ajuste *<input type="number" step="0.01" formControlName="amount"></label>}
          @case ('journal') {<label>Tipo<select formControlName="kind"><option>Atualização</option><option>Ocorrência</option><option>Pendência</option><option>Arquivo</option></select></label><label>Título *<input formControlName="name"></label><label class="full-field">Descrição *<textarea rows="5" formControlName="description"></textarea></label><label class="full-field">Arquivos (separados por vírgula)<input formControlName="files"></label>}
        }
      </div>@if (actionError()) {<p class="inline-field-error">{{actionError()}}</p>}<footer><button class="secondary-button" type="button" (click)="closeDialog()">Cancelar</button><button class="primary-button" type="submit">Salvar</button></footer></form></section>
    }
  `,
})
export class WorkDetailPage {
  readonly store = inject(AppStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly Math = Math;
  readonly contributionPaid = contributionPaid;
  readonly contributionRemaining = contributionRemaining;
  readonly shareRemaining = shareRemaining;
  readonly workId = this.route.snapshot.paramMap.get('id') || '';
  readonly work = computed(() => this.store.works().find((item) => item.id === this.workId));
  readonly detail = computed(() => this.store.workDetails()[this.workId] ?? { activities: [], team: [], suppliers: [], partners: [], contributions: [], financialEntries: [], journal: [], pendingItems: [] });
  readonly tab = signal<WorkTab>('Resumo');
  readonly dialog = signal<WorkDialog>(null);
  readonly actionError = signal('');
  readonly targetActivity = signal<WorkActivity | null>(null);
  readonly selectedSupplier = signal<WorkSupplier | null>(null);
  readonly selectedContribution = signal<WorkContribution | null>(null);
  readonly tabs: WorkTab[] = ['Resumo', 'Planejamento', 'Equipe', 'Fornecedores', 'Sócios', 'Financeiro', 'Diário'];
  readonly actionForm = this.fb.group({
    name: [''], role: [''], description: [''], mode: ['Horas'], quantity: [1], amount: [0], supplyType: ['Serviço'], date: ['2026-08-24'], endDate: ['2026-08-24'], stage: ['Execução'], percent: [0], party: [''], kind: ['Atualização'], files: [''], progress: [0], status: ['Em andamento'],
  });

  constructor() {
    const work = this.work();
    if (work) this.store.ensureWorkDetail(work);
  }

  go(url: string): void { void this.router.navigateByUrl(url); }
  money(value: number): string { return brl.format(value); }
  format(value: string): string { return formatDate(value); }
  slug(value: string): string { return normalizeSearch(value).replace(/\s+/g, '-'); }
  initials(value: string): string { return value.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase(); }
  riskClass(work: WorkRecord): string { return work.risk === 'Em atraso' ? 'danger' : work.risk === 'Atenção' ? 'warning' : 'ok'; }
  image(work: WorkRecord): string { const property = this.store.properties().find((item) => item.name === work.property); return property ? PROPERTY_IMAGES[property.id] ?? FALLBACK_PROPERTY_IMAGE : FALLBACK_PROPERTY_IMAGE; }
  budgetUse(work: WorkRecord): number { return Math.round(work.spent / Math.max(1, work.budget) * 100); }
  teamCost(): number { return this.detail().team.reduce((sum, person) => sum + person.quantity * person.unitRate, 0); }
  supplierContracted(): number { return this.detail().suppliers.reduce((sum, supplier) => sum + supplier.contractedAmount, 0); }
  supplierPaid(): number { return this.detail().suppliers.reduce((sum, supplier) => sum + supplier.paidAmount, 0); }
  participation(): number { return participationTotal(this.detail().partners); }
  contributionTotal(): number { return this.detail().contributions.reduce((sum, contribution) => sum + contribution.amount, 0); }
  contributionPaidTotal(): number { return this.detail().contributions.reduce((sum, contribution) => sum + contributionPaid(contribution), 0); }
  contributionPending(): number { return this.detail().contributions.reduce((sum, contribution) => sum + contributionRemaining(contribution), 0); }
  partnerValue(partner: WorkPartner) { return partnerTotals(partner.id, this.detail().contributions); }
  journalFiles(): string[] { return this.detail().journal.flatMap((entry) => entry.files).slice(0, 8); }
  tabCount(tab: WorkTab): number { if (tab === 'Planejamento') return this.detail().pendingItems.length; if (tab === 'Equipe') return this.detail().team.length; if (tab === 'Fornecedores') return this.detail().suppliers.length; if (tab === 'Sócios') return this.detail().partners.length; if (tab === 'Diário') return this.detail().journal.length; return 0; }

  resolvePending(id: string): void {
    this.store.updateWorkDetail(this.workId, { pendingItems: this.detail().pendingItems.filter((item) => item.id !== id) });
    this.toast.show('Pendência resolvida', id);
  }

  completeActivity(activity: WorkActivity): void {
    const activities = this.detail().activities.map((item) => item.id === activity.id ? { ...item, status: 'Concluída' as const, blockedReason: undefined } : item);
    this.store.updateWorkDetail(this.workId, { activities });
    const progress = Math.round(activities.filter((item) => item.status === 'Concluída').length / Math.max(1, activities.length) * 100);
    const work = this.work();
    if (work) this.store.saveWork({ ...work, progress, nextActivity: activities.find((item) => item.status !== 'Concluída')?.title ?? 'Entrega concluída', lastUpdateLabel: 'Atualizada agora', updatedAtIso: new Date().toISOString() });
    this.appendJournal('Atualização', 'Atividade concluída', activity.title);
    this.toast.show('Atividade concluída', activity.id);
  }

  removeTeam(id: string): void { this.store.updateWorkDetail(this.workId, { team: this.detail().team.filter((person) => person.id !== id) }); this.toast.show('Alocação removida', id); }
  removePartner(id: string): void { if (this.detail().contributions.some((contribution) => contribution.shares.some((share) => share.partnerId === id))) { this.toast.show('Sócio possui aportes vinculados', 'Remoção não permitida'); return; } this.store.updateWorkDetail(this.workId, { partners: this.detail().partners.filter((partner) => partner.id !== id) }); this.toast.show('Sócio removido', id); }

  openDialog(dialog: WorkDialog): void {
    const work = this.work();
    if (!work) return;
    this.actionError.set('');
    this.targetActivity.set(null);
    this.selectedSupplier.set(null);
    this.selectedContribution.set(null);
    this.actionForm.reset({ mode: 'Horas', quantity: 1, amount: 0, supplyType: 'Serviço', date: '2026-08-24', endDate: work.endDateIso, stage: 'Execução', percent: 0, kind: 'Atualização', progress: work.progress, status: work.status });
    this.dialog.set(dialog);
  }

  openActivityDialog(dialog: 'block' | 'reprogram', activity: WorkActivity): void { this.openDialog(dialog); this.targetActivity.set(activity); this.actionForm.patchValue({ endDate: activity.endDateIso }); }
  openSupplierPayment(supplier: WorkSupplier): void { this.openDialog('supplierPayment'); this.selectedSupplier.set(supplier); this.actionForm.patchValue({ amount: this.supplierPaymentLimit() }); }
  openPartnerPayment(contribution: WorkContribution): void { this.openDialog('partnerPayment'); this.selectedContribution.set(contribution); const share = this.pendingShares()[0]; this.actionForm.patchValue({ party: share?.partnerId ?? '', amount: share ? shareRemaining(share) : 0 }); }
  closeDialog(): void { this.dialog.set(null); this.actionError.set(''); this.targetActivity.set(null); this.selectedSupplier.set(null); this.selectedContribution.set(null); }
  supplierPaymentLimit(): number { const supplier = this.selectedSupplier(); return supplier ? Math.max(0, supplier.contractedAmount - supplier.paidAmount) : 0; }
  pendingShares(): WorkContributionShare[] { return (this.selectedContribution()?.shares ?? []).filter((share) => shareRemaining(share) > 0); }
  selectedShare(): WorkContributionShare | undefined { return this.pendingShares().find((share) => share.partnerId === this.actionForm.value.party); }
  partnerPaymentLimit(): number { const share = this.selectedShare(); return share ? shareRemaining(share) : 0; }
  syncPartnerPaymentAmount(): void { this.actionForm.patchValue({ amount: this.partnerPaymentLimit() }); }

  dialogTitle(): string {
    const titles: Record<Exclude<WorkDialog, null>, string> = { progress: 'Atualizar progresso', activity: 'Adicionar atividade', block: 'Bloquear atividade', reprogram: 'Reprogramar atividade', team: 'Alocar profissional', supplier: 'Cadastrar fornecedor', supplierPayment: 'Registrar pagamento do fornecedor', partner: 'Cadastrar sócio', contribution: 'Registrar aporte', partnerPayment: 'Registrar pagamento do sócio', cash: 'Realizar ajuste de caixa', journal: 'Registrar no diário' };
    return this.dialog() ? titles[this.dialog() as Exclude<WorkDialog, null>] : 'Gestão de obra';
  }

  saveAction(): void {
    const dialog = this.dialog();
    const work = this.work();
    if (!dialog || !work) return;
    const value = this.actionForm.getRawValue();
    try {
      if (dialog === 'progress') {
        const progress = Math.max(0, Math.min(100, Number(value.progress) || 0));
        const status = (value.status || 'Em andamento') as WorkStatus;
        this.store.saveWork({ ...work, progress: status === 'Concluída' ? 100 : progress, status, risk: status === 'Concluída' ? 'Concluída' : work.risk, nextActivity: value.description || work.nextActivity, lastUpdateLabel: 'Atualizada agora', updatedAtIso: new Date().toISOString() });
        this.appendJournal('Atualização', `Situação alterada para ${status}`, value.description || work.nextActivity);
      } else if (dialog === 'activity') {
        if (!value.name || !value.role || !value.date || !value.endDate) throw new Error('Informe atividade, responsável e período.');
        if (value.endDate < value.date) throw new Error('A conclusão não pode ser anterior ao início.');
        const activity: WorkActivity = { id: nextRecordId('ATV', this.detail().activities), stage: (value.stage || 'Execução') as WorkActivity['stage'], title: value.name, manager: value.role, startDateIso: value.date, endDateIso: value.endDate, status: 'Não iniciada' };
        this.store.updateWorkDetail(this.workId, { activities: [...this.detail().activities, activity] });
        this.appendJournal('Atualização', 'Atividade adicionada', activity.title);
      } else if (dialog === 'block') {
        const activity = this.targetActivity();
        if (!activity || !value.description) throw new Error('Informe o motivo do bloqueio.');
        this.store.updateWorkDetail(this.workId, { activities: this.detail().activities.map((item) => item.id === activity.id ? { ...item, status: 'Bloqueada' as const, blockedReason: value.description || undefined } : item) });
        this.appendJournal('Pendência', 'Atividade bloqueada', `${activity.title} · ${value.description}`);
      } else if (dialog === 'reprogram') {
        const activity = this.targetActivity();
        if (!activity || !value.endDate || !value.description) throw new Error('Informe a nova data e a justificativa.');
        if (value.endDate < activity.startDateIso) throw new Error('A conclusão não pode ser anterior ao início.');
        this.store.updateWorkDetail(this.workId, { activities: this.detail().activities.map((item) => item.id === activity.id ? { ...item, endDateIso: value.endDate || item.endDateIso } : item) });
        this.appendJournal('Atualização', 'Atividade reprogramada', `${activity.title} · ${formatDate(value.endDate)} · ${value.description}`);
      } else if (dialog === 'team') {
        if (!value.name || !value.role || Number(value.quantity) <= 0) throw new Error('Informe profissional, função e quantidade.');
        const person: WorkTeamAllocation = { id: nextRecordId('EQP', this.detail().team), name: value.name, role: value.role, startDateIso: work.startDateIso, endDateIso: work.endDateIso, workMode: value.mode === 'Diárias' ? 'Diárias' : 'Horas', quantity: Number(value.quantity) || 1, unitRate: Number(value.amount) || 0, activityIds: [] };
        this.store.updateWorkDetail(this.workId, { team: [...this.detail().team, person] });
      } else if (dialog === 'supplier') {
        if (!value.name || !value.description || Number(value.amount) <= 0) throw new Error('Informe fornecedor, objeto e valor contratado.');
        const supplier: WorkSupplier = { id: nextRecordId('FOR', this.detail().suppliers), name: value.name, supplyType: value.supplyType === 'Produto' ? 'Produto' : value.supplyType === 'Material' ? 'Material' : 'Serviço', description: value.description, contractedAmount: Number(value.amount), paidAmount: 0, status: this.supplierStatus(0, Number(value.amount), value.date || work.endDateIso), contractDateIso: '2026-08-24', dueDateIso: value.date || work.endDateIso, documents: [], payments: [] };
        this.store.updateWorkDetail(this.workId, { suppliers: [...this.detail().suppliers, supplier] });
        this.appendJournal('Atualização', 'Fornecedor adicionado', `${supplier.name} · ${supplier.description}`);
      } else if (dialog === 'supplierPayment') {
        this.saveSupplierPayment(Number(value.amount), value.date || '', value.description || undefined, value.files || undefined);
      } else if (dialog === 'partner') {
        if (!value.name || Number(value.percent) <= 0) throw new Error('Informe o nome e a participação.');
        if (this.participation() + Number(value.percent) > 100.001) throw new Error('A participação total não pode superar 100%.');
        const partner: WorkPartner = { id: nextPartnerRecordId('SOC', this.detail().partners.map((item) => item.id)), name: value.name, participationPercent: Number(value.percent) };
        this.store.updateWorkDetail(this.workId, { partners: [...this.detail().partners, partner] });
        this.appendJournal('Atualização', 'Sócio adicionado à obra', `${partner.name} · ${partner.participationPercent}%`);
      } else if (dialog === 'contribution') {
        if (!value.description || Number(value.amount) <= 0) throw new Error('Informe descrição e valor do aporte.');
        const contribution: WorkContribution = { id: nextRecordId('APT', this.detail().contributions), dateIso: value.date || '2026-08-24', description: value.description, amount: Number(value.amount), shares: createContributionShares(this.detail().partners, Number(value.amount)) };
        this.store.updateWorkDetail(this.workId, { contributions: [contribution, ...this.detail().contributions] });
        this.appendJournal('Atualização', 'Novo aporte solicitado', `${contribution.description} · ${this.money(contribution.amount)}`);
      } else if (dialog === 'partnerPayment') {
        this.savePartnerPayment(Number(value.amount), value.date || '', value.description || undefined);
      } else if (dialog === 'cash') {
        if (!value.description || !value.date || !Number.isFinite(Number(value.amount)) || Number(value.amount) === 0) throw new Error('Informe data, descrição e valor diferente de zero.');
        const entry: WorkFinancialEntry = { id: nextRecordId('FIN', this.detail().financialEntries), kind: 'Ajuste', description: value.description, party: 'Caixa administrativo', amount: Number(value.amount), dateIso: value.date, status: 'Registrado' };
        this.store.updateWorkDetail(this.workId, { financialEntries: [entry, ...this.detail().financialEntries] });
        this.appendJournal('Atualização', 'Ajuste de caixa registrado', `${entry.description} · ${this.money(entry.amount)}`);
      } else {
        if (!value.name || !value.description) throw new Error('Informe título e descrição.');
        this.appendJournal((value.kind || 'Atualização') as WorkJournalEntry['kind'], value.name, value.description, (value.files || '').split(',').map((file) => file.trim()).filter(Boolean));
      }
      this.toast.show('Registro da obra atualizado', work.id);
      this.closeDialog();
    } catch (error) {
      this.actionError.set(error instanceof Error ? error.message : 'Não foi possível salvar.');
    }
  }

  private saveSupplierPayment(amount: number, dateIso: string, note?: string, document?: string): void {
    const supplier = this.selectedSupplier();
    if (!supplier || !dateIso || amount <= 0 || amount > this.supplierPaymentLimit() + 0.009) throw new Error('Informe um valor válido, dentro do saldo do fornecedor.');
    const paidAmount = Math.min(supplier.contractedAmount, supplier.paidAmount + amount);
    const payment = { id: nextRecordId('PAG-FOR', supplier.payments), amount, dateIso, note, document };
    const updated: WorkSupplier = { ...supplier, paidAmount, status: this.supplierStatus(paidAmount, supplier.contractedAmount, supplier.dueDateIso), lastPaymentDateIso: dateIso, documents: document && !supplier.documents.includes(document) ? [...supplier.documents, document] : supplier.documents, payments: [payment, ...supplier.payments] };
    this.store.updateWorkDetail(this.workId, { suppliers: this.detail().suppliers.map((item) => item.id === supplier.id ? updated : item) });
    this.appendJournal('Atualização', 'Pagamento de fornecedor registrado', `${supplier.name} · ${this.money(amount)}`, document ? [document] : []);
  }

  private savePartnerPayment(amount: number, dateIso: string, note?: string): void {
    const contribution = this.selectedContribution();
    const share = this.selectedShare();
    if (!contribution || !share || !dateIso || amount <= 0 || amount > shareRemaining(share) + 0.009) throw new Error('Informe um pagamento válido, dentro do saldo do sócio.');
    const paymentId = nextPartnerRecordId('PAG-APT', this.detail().contributions.flatMap((item) => item.shares.flatMap((entry) => entry.payments.map((payment) => payment.id))));
    const payment = { id: paymentId, amount, dateIso, note };
    const updated: WorkContribution = { ...contribution, shares: contribution.shares.map((item) => item.partnerId === share.partnerId ? { ...item, payments: [...item.payments, payment] } : item) };
    const entry: WorkFinancialEntry = { id: nextRecordId('FIN', this.detail().financialEntries), kind: 'Aporte', description: `${contribution.description} · pagamento recebido`, party: share.partnerName, amount, dateIso, status: 'Registrado', sourceId: contribution.id };
    this.store.updateWorkDetail(this.workId, { contributions: this.detail().contributions.map((item) => item.id === contribution.id ? updated : item), financialEntries: [entry, ...this.detail().financialEntries] });
    this.appendJournal('Atualização', 'Aporte de sócio recebido', `${share.partnerName} · ${this.money(amount)} · ${contribution.id}`);
  }

  private supplierStatus(paid: number, contracted: number, dueDateIso: string): WorkSupplierStatus { if (paid >= contracted - 0.009) return 'Quitado'; if (paid > 0) return 'Parcialmente pago'; return dueDateIso < '2026-08-24' ? 'Vencido' : 'Pendente'; }
  private appendJournal(kind: WorkJournalEntry['kind'], title: string, description: string, files: string[] = []): void { const work = this.work(); if (!work) return; const entry: WorkJournalEntry = { id: nextRecordId('DIA', this.detail().journal), kind, title, description, author: work.manager, dateIso: '2026-08-24T12:00:00', progress: work.progress, files }; this.store.updateWorkDetail(this.workId, { journal: [entry, ...this.detail().journal] }); }
}
