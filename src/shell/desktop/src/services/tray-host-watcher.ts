/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import type { IProgramHost } from "../interfaces/i-program-host.js";
import type { StartedProgram } from "../models/started-program.js";
import { Resources } from "../resources.js";

export class TrayHostWatcher {
  private readonly isLinux: boolean;
  private readonly programs: IProgramHost;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly delayAsync: (milliseconds: number) => Promise<void>;
  private readonly onChange: (isAvailable: boolean) => void;
  private monitor: StartedProgram | null = null;
  private isWatching: boolean = false;
  private isQuerying: boolean = false;
  private isStale: boolean = false;
  private retryDelay: number = Resources.trayMonitorFirstDelay;
  private available: boolean;

  public constructor(platform: string, programs: IProgramHost, environment: NodeJS.ProcessEnv, delayAsync: (milliseconds: number) => Promise<void>, onChange: (isAvailable: boolean) => void) {
    this.isLinux = platform === Resources.linuxPlatform;
    this.programs = programs;
    this.environment = environment;
    this.delayAsync = delayAsync;
    this.onChange = onChange;
    this.available = !this.isLinux;
  }

  public get isAvailable(): boolean {
    return this.available;
  }

  public start(): void {
    if (!this.isLinux || this.isWatching)
      return;
    this.isWatching = true;
    this.watch();
  }

  public stop(): void {
    this.isWatching = false;
    this.monitor?.stop();
    this.monitor = null;
  }

  private watch(): void {
    this.monitor = this.programs.start(Resources.gdbusPath, Resources.trayHostMonitorArguments, this.environment, () => this.hear(), () => void this.restartAsync());
    void this.queryAsync();
  }

  private hear(): void {
    this.retryDelay = Resources.trayMonitorFirstDelay;
    void this.queryAsync();
  }

  private async restartAsync(): Promise<void> {
    if (!this.isWatching)
      return;
    this.monitor = null;
    void this.queryAsync();
    const wait = this.retryDelay;
    this.retryDelay = Math.min(wait * Resources.trayMonitorDelayGrowth, Resources.trayMonitorLongestDelay);
    await this.delayAsync(wait);
    if (this.isWatching && Object.isNull(this.monitor))
      this.watch();
  }

  private async queryAsync(): Promise<void> {
    if (this.isQuerying) {
      this.isStale = true;
      return;
    }
    this.isQuerying = true;
    do {
      this.isStale = false;
      const isRegistered = await this.programs.runAsync(Resources.gdbusPath, Resources.trayHostQueryArguments, this.environment)
        .then(t => t.trim() === Resources.trayHostRegisteredAnswer, () => false);
      if (this.isWatching)
        this.set(isRegistered);
    } while (this.isStale && this.isWatching);
    this.isQuerying = false;
  }

  private set(isAvailable: boolean): void {
    if (isAvailable === this.available)
      return;
    this.available = isAvailable;
    this.onChange(isAvailable);
  }
}
