import { ChangeDetectionStrategy, Component, HostListener, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AppStore } from '../../core/services/app-store.service';
import { EntityModalService } from '../../core/services/entity-modal.service';
import { ToastService } from '../../core/services/toast.service';
import type { Charge, Contract, Expense, Portfolio, Property, Tenant, Unit } from '../../core/models/domain.models';
import { buildChargeItemsFromContract, chargeStatusFromItems, formatDate, nextRecordId } from '../../core/utils/domain.utils';

const titleMap = {
  portfolio: 'carteira', property: 'imóvel', unit: 'unidade', tenant: 'locatário', contract: 'contrato', charge: 'cobrança', expense: 'despesa',
} as const;

const modalTitleMap: Record<keyof typeof titleMap, string> = {
  portfolio: 'Nova carteira', property: 'Novo imóvel', unit: 'Nova unidade', tenant: 'Novo locatário', contract: 'Novo contrato', charge: 'Nova cobrança', expense: 'Nova despesa',
};

const savedMessageMap: Record<keyof typeof titleMap, string> = {
  portfolio: 'Carteira salva com sucesso', property: 'Imóvel salvo com sucesso', unit: 'Unidade salva com sucesso', tenant: 'Locatário salvo com sucesso', contract: 'Contrato salvo com sucesso', charge: 'Cobrança salva com sucesso', expense: 'Despesa salva com sucesso',
};

@Component({
  selector: 'app-entity-modal',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (modal.state(); as state) {
      <section class="modal-layer" role="dialog" aria-modal="true" [attr.aria-labelledby]="'entity-title'">
        <button class="drawer-backdrop" type="button" tabindex="-1" aria-label="Fechar" (click)="modal.close()"></button>
        <form class="receipt-modal entity-modal" [formGroup]="form" (ngSubmit)="save()">
          <header class="entity-form-hero">
            <span class="entity-form-mark">{{ state.record ? '✎' : '+' }}</span>
            <div><p class="eyebrow">Cadastro operacional</p><h2 id="entity-title">{{ modalHeading(state.kind, !!state.record) }}</h2><span>Preencha os dados essenciais; os campos marcados são obrigatórios.</span></div>
            <b>{{ state.kind.toUpperCase() }}</b>
            <button class="close-button" type="button" aria-label="Fechar" (click)="modal.close()">×</button>
          </header>
          <div class="entity-grid">
            <section class="entity-form-section">
              <header><div><span>01</span><div><strong>Identificação e vínculo</strong><small>Informações usadas nas demais rotinas.</small></div></div></header>
              <div class="entity-form-section-fields form-grid">
                @switch (state.kind) {
                  @case ('portfolio') {
                    <label>Nome da carteira *<input formControlName="name" placeholder="Ex.: Carteira Atlas"></label>
                    <label>Titular *<input formControlName="holder" placeholder="Razão social ou pessoa"></label>
                    <label>CPF/CNPJ *<input formControlName="document" placeholder="Documento do titular"></label>
                    <label>Gestor<input formControlName="manager" placeholder="Responsável interno"></label>
                    <label class="full-field">Descrição<textarea formControlName="description" rows="3"></textarea></label>
                  }
                  @case ('property') {
                    <label>Carteira *<select formControlName="portfolio"><option value="">Selecione</option>@for (item of store.portfolios(); track item.id) { <option [value]="item.name">{{ item.name }}</option> }</select></label>
                    <label>Nome do imóvel *<input formControlName="name"></label>
                    <label>Tipo<select formControlName="propertyType"><option>Edifício comercial</option><option>Centro comercial</option><option>Complexo logístico</option><option>Outro</option></select></label>
                    <label>CEP<input formControlName="cep"></label>
                    <label class="full-field">Endereço *<input formControlName="address" placeholder="Logradouro, número · bairro"></label>
                    <label>Cidade<input formControlName="city"></label><label>UF<input formControlName="state" maxlength="2"></label>
                  }
                  @case ('unit') {
                    <label>Imóvel *<select formControlName="property" (change)="syncPortfolio()"><option value="">Selecione</option>@for (item of store.properties(); track item.id) { <option [value]="item.name">{{ item.name }}</option> }</select></label>
                    <label>Carteira<input formControlName="portfolio" readonly></label>
                    <label>Unidade *<input formControlName="name" placeholder="Ex.: Sala 101"></label>
                    <label>Tipo<select formControlName="unitType"><option>Sala comercial</option><option>Loja</option><option>Galpão</option><option>Módulo</option><option>Outro</option></select></label>
                    <label>Área privativa (m²) *<input type="number" min="0" formControlName="area"></label>
                    <label class="checkbox-label"><input type="checkbox" formControlName="occupied"> Unidade ocupada</label>
                  }
                  @case ('tenant') {
                    <label>Tipo *<select formControlName="type"><option value="PJ">Pessoa jurídica</option><option value="PF">Pessoa física</option></select></label>
                    <label>Nome / razão social *<input formControlName="name"></label>
                    <label>CPF/CNPJ *<input formControlName="document"></label>
                    <label>Nome fantasia<input formControlName="tradeName"></label>
                    <label>Contato<input formControlName="contactName"></label><label>Telefone<input formControlName="phone"></label>
                    <label>E-mail<input type="email" formControlName="email"></label>
                    <label>Imobiliária<select formControlName="responsibleAgencyId"><option value="">Sem imobiliária</option>@for (item of store.agencies(); track item.id) { <option [value]="item.id">{{ item.tradeName || item.name }}</option> }</select></label>
                  }
                  @case ('contract') {
                    <label>Carteira *<select formControlName="portfolio"><option value="">Selecione</option>@for (item of store.portfolios(); track item.id) { <option [value]="item.name">{{ item.name }}</option> }</select></label>
                    <label>Imóvel *<select formControlName="property"><option value="">Selecione</option>@for (item of store.properties(); track item.id) { <option [value]="item.name">{{ item.name }}</option> }</select></label>
                    <label class="full-field">Unidades *<input formControlName="units" placeholder="Sala 101, Sala 102"></label>
                    <label>Locatário *<select formControlName="tenant"><option value="">Selecione</option>@for (item of store.tenants(); track item.id) { <option [value]="item.name">{{ item.name }}</option> }</select></label>
                    <label>Aluguel mensal *<input type="number" min="0" formControlName="rent"></label>
                    <label>Início *<input type="date" formControlName="startIso"></label><label>Término *<input type="date" formControlName="endIso"></label>
                    <label>Dia de vencimento *<input type="number" min="1" max="31" formControlName="due"></label>
                    <label>Índice de reajuste<input formControlName="adjustmentIndex" placeholder="IPCA"></label>
                    <label class="full-field">Encargos<input formControlName="charges" placeholder="Aluguel, IPTU, Condomínio"></label>
                  }
                  @case ('charge') {
                    <label class="full-field">Contrato *<select formControlName="contract"><option value="">Selecione</option>@for (item of store.contracts(); track item.id) { <option [value]="item.id">{{ item.id }} · {{ item.tenant }}</option> }</select></label>
                    <label>Competência *<input type="month" formControlName="competence"></label>
                    <label>Forma de pagamento<select formControlName="paymentMethod"><option>Boleto bancário</option><option>Pix</option><option>Transferência bancária</option></select></label>
                    <p class="form-help full-field">Os itens, valores e vencimentos são gerados pelas regras do contrato e podem ser conferidos no detalhe da cobrança.</p>
                  }
                  @case ('expense') {
                    <label>Fornecedor *<input formControlName="supplier"></label>
                    <label>Categoria *<select formControlName="category"><option>Condomínio</option><option>Manutenção</option><option>Seguros</option><option>Tributos</option><option>Utilidades</option><option>Outros</option></select></label>
                    <label class="full-field">Descrição *<input formControlName="description"></label>
                    <label>Valor *<input type="number" min="0" step="0.01" formControlName="amount"></label>
                    <label>Vencimento *<input type="date" formControlName="dueIso"></label>
                    <label>Forma de pagamento<select formControlName="paymentMethod"><option>Boleto bancário</option><option>Pix</option><option>Transferência bancária</option></select></label>
                    <label>Conta financeira<input formControlName="financialAccount"></label>
                  }
                }
                <label class="full-field">Observações<textarea formControlName="notes" rows="3"></textarea></label>
              </div>
            </section>
          </div>
          @if (submitted() && form.invalid) { <p class="inline-field-error">Revise os campos obrigatórios antes de continuar.</p> }
          <footer class="entity-form-footer"><div><span>✓</span><small>Os dados serão aplicados imediatamente nesta sessão.</small></div><button class="secondary-button" type="button" (click)="modal.close()">Cancelar</button><button class="primary-button" type="submit">Salvar {{ entityTitle(state.kind) }}</button></footer>
        </form>
      </section>
    }
  `,
})
export class EntityModalComponent {
  readonly modal = inject(EntityModalService);
  readonly store = inject(AppStore);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  readonly submitted = signal(false);
  readonly form = this.fb.group({
    name: [''], holder: [''], document: [''], manager: [''], description: [''], notes: [''],
    portfolio: [''], property: [''], propertyType: ['Edifício comercial'], address: [''], cep: [''], city: [''], state: [''],
    unitType: ['Sala comercial'], area: [0], occupied: [false], type: ['PJ'], tradeName: [''], contactName: [''], phone: [''], email: [''], responsibleAgencyId: [''],
    units: [''], tenant: [''], rent: [0], startIso: [''], endIso: [''], due: [10], adjustmentIndex: ['IPCA'], charges: ['Aluguel, Condomínio'],
    contract: [''], competence: ['2026-08'], paymentMethod: ['Boleto bancário'], supplier: [''], category: ['Manutenção'], amount: [0], dueIso: [''], financialAccount: ['Banco Operacional'],
  });

  constructor() {
    effect(() => {
      const state = this.modal.state();
      if (!state) return;
      this.submitted.set(false);
      this.form.reset({ unitType: 'Sala comercial', propertyType: 'Edifício comercial', occupied: false, type: 'PJ', due: 10, adjustmentIndex: 'IPCA', charges: 'Aluguel, Condomínio', competence: '2026-08', paymentMethod: 'Boleto bancário', category: 'Manutenção', financialAccount: 'Banco Operacional', area: 0, rent: 0, amount: 0 });
      if (state.record) {
        const common = { name: state.record.name, notes: state.record.notes ?? '' };
        if (state.kind === 'portfolio') {
          const record = state.record as Portfolio;
          this.form.patchValue({ ...common, holder: record.holder, document: record.document, manager: record.manager ?? '', description: record.description ?? '' });
        } else if (state.kind === 'property') {
          const record = state.record as Property;
          this.form.patchValue({ ...common, portfolio: record.portfolio, address: record.address, propertyType: record.propertyType ?? 'Edifício comercial', cep: record.cep ?? '', city: record.city ?? '', state: record.state ?? '' });
        } else if (state.kind === 'unit') {
          const record = state.record as Unit;
          this.form.patchValue({ ...common, portfolio: record.portfolio, property: record.property, unitType: record.unitType ?? 'Sala comercial', area: record.area, occupied: record.occupied });
        } else if (state.kind === 'tenant') {
          const record = state.record as Tenant;
          this.form.patchValue({ ...common, type: record.type, document: record.document, tradeName: record.tradeName ?? '', contactName: record.contactName ?? '', phone: record.phone ?? '', email: record.email ?? '', responsibleAgencyId: record.responsibleAgencyId ?? '' });
        }
      }
      if (state.sourceContract) this.form.patchValue({ contract: state.sourceContract.id });
      this.applyValidators(state.kind);
    });
  }

  @HostListener('document:keydown.escape') onEscape(): void { if (this.modal.state()) this.modal.close(); }
  entityTitle(kind: keyof typeof titleMap): string { return titleMap[kind]; }
  modalHeading(kind: keyof typeof titleMap, editing: boolean): string {
    return editing ? `Editar ${titleMap[kind]}` : modalTitleMap[kind];
  }

  syncPortfolio(): void {
    const property = this.store.properties().find((item) => item.name === this.form.value.property);
    if (property) this.form.patchValue({ portfolio: property.portfolio });
  }

  save(): void {
    const state = this.modal.state();
    if (!state) return;
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    let reference = '';
    if (state.kind === 'portfolio') {
      const current = state.record as Portfolio | null;
      const item: Portfolio = { id: current?.id ?? nextRecordId('CAR', this.store.portfolios()), name: v.name || '', holder: v.holder || '', document: v.document || '', properties: current?.properties ?? 0, units: current?.units ?? 0, manager: v.manager || undefined, description: v.description || undefined, notes: v.notes || undefined };
      this.store.savePortfolio(item); reference = item.id;
    } else if (state.kind === 'property') {
      const current = state.record as Property | null;
      const item: Property = { id: current?.id ?? nextRecordId('IMO', this.store.properties()), portfolio: v.portfolio || '', name: v.name || '', address: v.address || '', units: current?.units ?? 0, propertyType: v.propertyType || undefined, cep: v.cep || undefined, city: v.city || undefined, state: v.state || undefined, notes: v.notes || undefined };
      this.store.saveProperty(item); reference = item.id;
    } else if (state.kind === 'unit') {
      const current = state.record as Unit | null;
      const item: Unit = { id: current?.id ?? nextRecordId('UNI', this.store.units()), portfolio: v.portfolio || '', property: v.property || '', name: v.name || '', area: Number(v.area) || 0, occupied: Boolean(v.occupied), unitType: v.unitType || undefined, notes: v.notes || undefined };
      this.store.saveUnit(item); reference = item.id;
    } else if (state.kind === 'tenant') {
      const current = state.record as Tenant | null;
      const item: Tenant = { id: current?.id ?? nextRecordId('LOC', this.store.tenants()), type: v.type === 'PF' ? 'PF' : 'PJ', name: v.name || '', document: v.document || '', contracts: current?.contracts ?? 0, tradeName: v.tradeName || undefined, contactName: v.contactName || undefined, phone: v.phone || undefined, email: v.email || undefined, responsibleAgencyId: v.responsibleAgencyId || undefined, notes: v.notes || undefined };
      this.store.saveTenant(item, current?.name); reference = item.id;
    } else if (state.kind === 'contract') {
      const unitNames = (v.units || '').split(',').map((value) => value.trim()).filter(Boolean);
      const item: Contract = { id: nextRecordId('CTR', this.store.contracts()), portfolio: v.portfolio || '', property: v.property || '', units: unitNames, tenant: v.tenant || '', period: `${formatDate(v.startIso || '')} — ${formatDate(v.endIso || '')}`, rent: Number(v.rent) || 0, due: Number(v.due) || 10, adjustment: v.startIso ? formatDate(v.startIso).split(' ')[1] || 'Anual' : 'Anual', charges: (v.charges || 'Aluguel').split(',').map(value => value.trim()).filter(Boolean), startIso: v.startIso || undefined, endIso: v.endIso || undefined, adjustmentIndex: v.adjustmentIndex || undefined, paymentMethod: v.paymentMethod || undefined, notes: v.notes || undefined };
      const unitIds = this.store.units().filter((unit) => unit.property === item.property && unitNames.includes(unit.name)).map((unit) => unit.id);
      const tenantId = this.store.tenants().find((tenant) => tenant.name === item.tenant)?.id ?? '';
      this.store.addContract(item, unitIds, tenantId); reference = item.id;
    } else if (state.kind === 'charge') {
      const contract = this.store.contracts().find((item) => item.id === v.contract);
      if (!contract) { this.form.controls.contract.setErrors({ required: true }); return; }
      const drafts = buildChargeItemsFromContract(contract, v.competence || '2026-08');
      const items = drafts.map((item) => ({ name: item.name, dueDate: formatDate(item.due), dueDateIso: item.due, amount: item.amount, received: 0, reference: item.reference }));
      const item: Charge = { id: nextRecordId('COB', this.store.charges(), 4), contract: contract.id, portfolio: contract.portfolio, property: contract.property, units: contract.units, tenant: contract.tenant, competence: (v.competence || '2026-08').split('-').reverse().join('/'), status: chargeStatusFromItems(items), items, paymentMethod: v.paymentMethod || undefined, notes: v.notes || undefined };
      this.store.addCharge(item); reference = item.id;
    } else {
      const date = v.dueIso || '';
      const status = date && date < '2026-08-12' ? 'Vencido' as const : 'Pendente' as const;
      const item: Expense = { id: nextRecordId('PAG', this.store.expenses(), 4), supplier: v.supplier || '', description: v.description || '', category: v.category || 'Outros', amount: Number(v.amount) || 0, dueDate: formatDate(date), dueIso: date, paidDate: null, status, paymentMethod: v.paymentMethod || undefined, financialAccount: v.financialAccount || undefined, notes: v.notes || undefined };
      this.store.addExpense(item); reference = item.id;
    }
    this.toast.show(savedMessageMap[state.kind], reference);
    this.modal.close();
  }

  private applyValidators(kind: keyof typeof titleMap): void {
    Object.values(this.form.controls).forEach((control) => control.clearValidators());
    const requiredByKind: Record<keyof typeof titleMap, string[]> = {
      portfolio: ['name', 'holder', 'document'], property: ['portfolio', 'name', 'address'], unit: ['property', 'name', 'area'], tenant: ['type', 'name', 'document'], contract: ['portfolio', 'property', 'units', 'tenant', 'rent', 'startIso', 'endIso', 'due'], charge: ['contract', 'competence'], expense: ['supplier', 'category', 'description', 'amount', 'dueIso'],
    };
    for (const name of requiredByKind[kind]) this.form.get(name)?.addValidators(Validators.required);
    this.form.updateValueAndValidity({ emitEvent: false });
  }
}
