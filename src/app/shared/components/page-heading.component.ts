import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-page-heading',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="page-heading">
      <div>
        <p class="eyebrow">{{ eyebrow() }}</p>
        <h1>{{ title() }}</h1>
        <p>{{ description() }}</p>
      </div>
      @if (actionLabel()) {
        <button class="primary-button" type="button" (click)="action.emit()"><span aria-hidden="true">＋</span>{{ actionLabel() }}</button>
      }
    </header>
  `,
})
export class PageHeadingComponent {
  readonly eyebrow = input('Gestão patrimonial');
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly actionLabel = input('');
  readonly action = output<void>();
}
