/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DestroyRef, Injectable, inject, signal } from "@angular/core";

import { AppUpdateCommand, AppUpdateState } from "@noldova/teamrun-protocol";

import { Resources } from "../resources";
import { BridgeService } from "./bridge.service";

@Injectable({ providedIn: "root" })
export class AppUpdatesService {
  private readonly bridge: BridgeService = inject(BridgeService);
  private revision: number = 0;
  private disposed: boolean = false;
  private readonly current = signal<AppUpdateState | null>(null);
  private readonly failure = signal<string | null>(null);
  private readonly pending = signal(false);

  public readonly state = this.current.asReadonly();
  public readonly error = this.failure.asReadonly();
  public readonly isPending = this.pending.asReadonly();

  public constructor() {
    const unsubscribe = this.bridge.subscribeUpdates(t => {
      this.revision += 1;
      this.current.set(t);
      this.failure.set(null);
    });
    inject(DestroyRef).onDestroy(() => {
      this.disposed = true;
      unsubscribe();
    });
    void this.execute(AppUpdateCommand.Status);
  }

  public async execute(command: AppUpdateCommand): Promise<void> {
    if (this.disposed || this.pending())
      return;
    const revision = this.revision;
    this.pending.set(true);
    this.failure.set(null);
    try {
      const state = await this.bridge.update(command);
      if (!this.disposed && this.revision === revision)
        this.current.set(state);
    }
    catch {
      if (!this.disposed)
        this.failure.set(Resources.updateBridgeFailed);
    }
    finally {
      if (!this.disposed)
        this.pending.set(false);
    }
  }
}
