/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DestroyRef, Injectable, type Signal, type WritableSignal, computed, inject, linkedSignal, signal } from "@angular/core";

import { StartupStateKind } from "../enums/startup-state-kind";
import { StartupState } from "../models/startup-state";
import { DesktopBridgeService } from "./desktop-bridge.service";

@Injectable({ providedIn: "root" })
export class StartupService {
  private readonly bridge: DesktopBridgeService = inject(DesktopBridgeService);
  private readonly stateValue: WritableSignal<StartupState> = signal(new StartupState(StartupStateKind.Connecting, []));
  private readonly isActingValue: WritableSignal<boolean> = signal(false);

  public readonly state: Signal<StartupState> = this.stateValue.asReadonly();
  public readonly isActing: Signal<boolean> = this.isActingValue.asReadonly();
  public readonly hasStarted: Signal<boolean> = linkedSignal<boolean, boolean>({
    source: () => this.stateValue().isReady,
    computation: (isReady, previous) => isReady || (previous?.value ?? false)
  });
  public readonly isReconnecting: Signal<boolean> = computed(() => this.hasStarted() && !this.stateValue().isReady);

  public constructor() {
    inject(DestroyRef).onDestroy(this.bridge.onStartup(t => this.stateValue.set(t)));
    void this.bridge.readStartupAsync().then(t => this.stateValue.set(t));
  }

  public async actAsync(action: string): Promise<void> {
    this.isActingValue.set(true);
    try {
      await this.bridge.actOnStartupAsync(action);
    }
    finally {
      this.isActingValue.set(false);
    }
  }
}
