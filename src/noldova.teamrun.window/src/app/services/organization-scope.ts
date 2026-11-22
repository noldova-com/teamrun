/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { computed, type FactoryProvider, inject, type Signal, signal, type WritableSignal } from "@angular/core";

import { Resources as ProtocolResources } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";

export class OrganizationScope {
  public static readonly provider: FactoryProvider =
    { provide: OrganizationScope, useFactory: (): OrganizationScope => inject(OrganizationScope, { skipSelf: true, optional: true }) ?? new OrganizationScope() };

  private readonly instance: WritableSignal<Signal<string>> = signal(signal(ProtocolResources.defaultOrganizationId));

  public readonly id: Signal<string> = computed(() => {
    const instance = this.instance()();
    return instance === Resources.organizationOldDocumentInstance ? ProtocolResources.defaultOrganizationId : instance;
  });

  public follow(instance: Signal<string>): void {
    this.instance.set(instance);
  }
}
