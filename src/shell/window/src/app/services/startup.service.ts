/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { LiveAnnouncer } from "@angular/cdk/a11y";
import { DestroyRef, Injectable, type Signal, type WritableSignal, computed, inject, signal } from "@angular/core";

import { StartupStateKind } from "../enums/startup-state-kind";
import { StartupState } from "../models/startup-state";
import { Resources } from "../../resources";
import { DesktopBridgeService } from "./desktop-bridge.service";

@Injectable({ providedIn: "root" })
export class StartupService {
  private readonly bridge: DesktopBridgeService = inject(DesktopBridgeService);
  private readonly announcer: LiveAnnouncer = inject(LiveAnnouncer);
  private readonly stateValue: WritableSignal<StartupState> = signal(new StartupState(StartupStateKind.Connecting, []));
  private readonly isActingValue: WritableSignal<boolean> = signal(false);
  private readonly hasStartedValue: WritableSignal<boolean> = signal(false);

  public readonly state: Signal<StartupState> = this.stateValue.asReadonly();
  public readonly isActing: Signal<boolean> = this.isActingValue.asReadonly();
  public readonly hasStarted: Signal<boolean> = this.hasStartedValue.asReadonly();
  public readonly isReconnecting: Signal<boolean> = computed(() => this.hasStarted() && !this.stateValue().isReady);

  public constructor() {
    inject(DestroyRef).onDestroy(this.bridge.onStartup(t => this.follow(t)));
    void this.bridge.readStartupAsync().then(t => this.follow(t));
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

  private follow(state: StartupState): void {
    const previous = this.stateValue();
    this.stateValue.set(state);
    if (state.isReady)
      this.hasStartedValue.set(true);
    else if (state.kind === StartupStateKind.Updating) {
      if (previous.kind !== StartupStateKind.Updating)
        void this.announcer.announce(Resources.formatUpdatingTitle(state.details[0] ?? String.empty), Resources.politeAnnouncement);
    }
    else if (previous.canSave)
      void this.announcer.announce(Resources.startingTitle, Resources.politeAnnouncement);
  }
}
