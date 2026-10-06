/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { UpdateBarrierState } from "@noldova/teamrun-shell-runtime";

import type { IUpdateHost } from "../interfaces/i-update-host.js";
import { Resources } from "../resources.js";

export class UpdateBarrierWatch {
  private readonly updates: Pick<IUpdateHost, "processId" | "readBarrierAsync" | "hasUpdateEndedAsync" | "quit">;
  private readonly isConnected: () => boolean;
  private readonly interval: number;
  private timer: NodeJS.Timeout | null = null;
  private isChecking: boolean = false;

  public constructor(updates: Pick<IUpdateHost, "processId" | "readBarrierAsync" | "hasUpdateEndedAsync" | "quit">, isConnected: () => boolean, interval: number) {
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(interval, Resources.intervalParameter);

    this.updates = updates;
    this.isConnected = isConnected;
    this.interval = interval;
  }

  public start(): void {
    this.timer ??= setInterval(() => void this.checkAsync(), this.interval).unref();
  }

  public stop(): void {
    if (!Object.isNull(this.timer))
      clearInterval(this.timer);
    this.timer = null;
  }

  public async checkAsync(): Promise<boolean> {
    if (this.isChecking || this.isConnected())
      return false;
    this.isChecking = true;
    try {
      const barrier = await this.updates.readBarrierAsync().catch(() => null);
      if (barrier?.state !== UpdateBarrierState.Closing || barrier.holder.processId === this.updates.processId || await this.updates.hasUpdateEndedAsync().catch(() => true))
        return false;
      this.stop();
      this.updates.quit();
      return true;
    }
    finally {
      this.isChecking = false;
    }
  }
}
