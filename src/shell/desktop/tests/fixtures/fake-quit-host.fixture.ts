/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { StopPolicy } from "@noldova/teamrun-shell-protocol";
import type { IQuitHost, IQuitPrompt } from "@noldova/teamrun-shell-desktop";

export class FakeQuitHost implements IQuitHost {
  public readonly calls: string[] = [];
  public readonly saves: boolean[] = [];
  public readonly busy: boolean[] = [];
  public prompt: IQuitPrompt | null = null;
  public isLastWindow: boolean = true;
  public keepsRunning: boolean = false;
  public hasExited: boolean = false;
  public saving: Promise<void> = Promise.resolve();

  public isExiting(): boolean {
    return this.hasExited;
  }

  public keepsRunningWithoutWindows(): boolean {
    return this.keepsRunning;
  }

  public isLast(): boolean {
    return this.isLastWindow;
  }

  public async saveAllAsync(): Promise<boolean> {
    this.calls.push("save");
    await this.saving;
    return this.saves.shift() ?? true;
  }

  public stopAsync(policy: StopPolicy): Promise<boolean> {
    this.calls.push(`stop ${policy}`);
    return Promise.resolve(this.busy.shift() ?? false);
  }

  public findPromptAsync(): Promise<IQuitPrompt | null> {
    this.calls.push("prompt");
    return Promise.resolve(this.prompt);
  }

  public quit(): void {
    this.calls.push("quit");
  }

  public exit(): void {
    this.calls.push("exit");
    this.hasExited = true;
  }
}
