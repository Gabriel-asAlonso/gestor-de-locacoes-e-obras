import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-toast',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (toast.message(); as item) {
      <aside class="toast" role="status" aria-live="polite">
        <span class="toast-icon">✓</span>
        <div><strong>{{ item.message }}</strong><small>{{ item.reference }}</small></div>
        <button type="button" aria-label="Fechar aviso" (click)="toast.dismiss()">×</button>
      </aside>
    }
  `,
})
export class ToastComponent { readonly toast = inject(ToastService); }
