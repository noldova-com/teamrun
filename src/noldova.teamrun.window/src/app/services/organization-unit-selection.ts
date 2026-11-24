/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type FactoryProvider, inject, type Signal, signal, type WritableSignal } from "@angular/core";

export class OrganizationUnitSelection {
  public static readonly provider: FactoryProvider = {
    provide: OrganizationUnitSelection,
    useFactory: (): OrganizationUnitSelection => inject(OrganizationUnitSelection, { skipSelf: true, optional: true }) ?? new OrganizationUnitSelection()
  };

  private readonly selected: WritableSignal<string | null> = signal(null);

  public readonly unitId: Signal<string | null> = this.selected.asReadonly();

  public select(unitId: string | null): void {
    this.selected.set(unitId);
  }
}
