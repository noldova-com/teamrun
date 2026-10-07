/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { INativeUpdater } from "@noldova/teamrun-shell-desktop";

export class FakeNativeUpdater implements INativeUpdater {
  public readonly listeners: Map<string, ((...values: unknown[]) => void)[]> = new Map();
  public checks: number = 0;
  public installs: number = 0;
  public onCheck: (updater: FakeNativeUpdater) => void = t => t.emit("update-downloaded");
  public onInstall: () => void = () => undefined;

  public checkForUpdates(): void {
    this.checks++;
    this.onCheck(this);
  }

  public on(event: string, listener: (...values: unknown[]) => void): this {
    this.listeners.set(event, [...this.listeners.get(event) ?? [], listener]);
    return this;
  }

  public once(event: string, listener: (...values: unknown[]) => void): this {
    const once = (...values: unknown[]): void => {
      this.removeListener(event, once);
      listener(...values);
    };
    return this.on(event, once);
  }

  public removeListener(event: string, listener: (...values: unknown[]) => void): this {
    this.listeners.set(event, (this.listeners.get(event) ?? []).filter(t => t !== listener));
    return this;
  }

  public quitAndInstall(): void {
    this.installs++;
    this.onInstall();
  }

  public emit(event: string, ...values: unknown[]): void {
    for (const listener of this.listeners.get(event) ?? [])
      listener(...values);
  }

  public get count(): number {
    return [...this.listeners.values()].flat().length;
  }
}
