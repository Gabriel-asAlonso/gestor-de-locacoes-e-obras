import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface DetailRow { label: string; value: string }

@Component({
  selector: 'app-detail-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="drawer-layer" role="dialog" aria-modal="true" [attr.aria-label]="title()">
      <button class="drawer-backdrop" type="button" tabindex="-1" aria-label="Fechar detalhe" (click)="closed.emit()"></button>
      <aside class="drawer">
        <header class="drawer-header"><div><p class="eyebrow">{{ eyebrow() }}</p><h2>{{ title() }}</h2></div><button class="close-button" type="button" aria-label="Fechar" (click)="closed.emit()">×</button></header>
        <div class="drawer-body">
          @if (subtitle()) { <p class="app-detail-lead">{{ subtitle() }}</p> }
          <dl class="detail-list app-detail-list">
            @for (row of rows(); track row.label) { <div><dt>{{ row.label }}</dt><dd>{{ row.value || 'Não informado' }}</dd></div> }
          </dl>
          <ng-content />
        </div>
        <footer class="drawer-footer">
          <button class="secondary-button" type="button" (click)="closed.emit()">Fechar</button>
          @if (secondaryLabel()) { <button class="secondary-button" type="button" (click)="secondary.emit()">{{ secondaryLabel() }}</button> }
          @if (actionLabel()) { <button class="primary-button" type="button" (click)="action.emit()">{{ actionLabel() }}</button> }
        </footer>
      </aside>
    </section>
  `,
})
export class DetailDrawerComponent {
  readonly eyebrow = input('Detalhes do registro');
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly rows = input<DetailRow[]>([]);
  readonly actionLabel = input('');
  readonly secondaryLabel = input('');
  readonly closed = output<void>();
  readonly action = output<void>();
  readonly secondary = output<void>();
}
