import { Injectable, signal } from '@angular/core';
import type { Contract, EntityKind, Portfolio, Property, Tenant, Unit } from '../models/domain.models';

export type EditableEntity = Portfolio | Property | Unit | Tenant | null;
export interface EntityModalState {
  kind: EntityKind;
  record: EditableEntity;
  sourceContract: Contract | null;
}

@Injectable({ providedIn: 'root' })
export class EntityModalService {
  readonly state = signal<EntityModalState | null>(null);

  open(kind: EntityKind, record: EditableEntity = null, sourceContract: Contract | null = null): void {
    this.state.set({ kind, record, sourceContract });
  }

  close(): void {
    this.state.set(null);
  }
}
