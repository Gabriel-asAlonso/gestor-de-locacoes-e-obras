import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="status status-{{ cssClass() }}"><i aria-hidden="true"></i>{{ value() }}</span>`,
})
export class StatusBadgeComponent {
  readonly value = input.required<string>();
  readonly cssClass = computed(() => this.value().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '-'));
}
