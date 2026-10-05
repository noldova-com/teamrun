/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, type Signal, type WritableSignal, computed, signal } from "@angular/core";

import type { ModuleStatus } from "@noldova/teamrun-shell-protocol";

import { Resources } from "../../resources";

@Injectable({ providedIn: "root" })
export class ModuleStatusService {
  private readonly reportedValue: WritableSignal<readonly ModuleStatus[]> = signal([]);
  private readonly modulesValue: WritableSignal<readonly ModuleStatus[]> = signal([]);

  public readonly modules: Signal<readonly ModuleStatus[]> = this.modulesValue.asReadonly();
  public readonly notifying: Signal<readonly ModuleStatus[]> = computed(() => this.reportedValue().filter(t => t.listContributions(Resources.notificationsKind).length > 0));

  public report(modules: readonly ModuleStatus[]): void {
    this.reportedValue.set([...modules]);
  }

  public set(modules: readonly ModuleStatus[]): void {
    this.report(modules);
    this.modulesValue.set([...modules]);
  }

  public nameOf(owner: string): string {
    return owner === Resources.shellOwner ? Resources.productName : this.reportedValue().find(t => t.id === owner)?.displayName ?? owner;
  }
}
