import { Injectable, signal } from '@angular/core';
import type { ToastMessage } from '../models/domain.models';

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly message = signal<ToastMessage | null>(null);
  private timer: ReturnType<typeof setTimeout> | null = null;

  show(message: string, reference: string): void {
    if (this.timer) clearTimeout(this.timer);
    this.message.set({ message, reference });
    this.timer = setTimeout(() => this.dismiss(), 4200);
  }

  dismiss(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.message.set(null);
  }
}
