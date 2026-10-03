/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ICloseGuard, type IQuitPrompt, QuitOutcome } from "@noldova/teamrun-shell-desktop";

export class FakeCloseGuard implements ICloseGuard {
  public readonly prompts: IQuitPrompt[] = [];
  public outcome: QuitOutcome = QuitOutcome.Quit;
  public stops: number = 0;
  public onStop?: () => void;

  public confirmAsync(prompt: IQuitPrompt): Promise<QuitOutcome> {
    this.prompts.push(prompt);
    return Promise.resolve(this.outcome);
  }

  public stopWorkAsync(): Promise<void> {
    this.stops++;
    this.onStop?.();
    return Promise.resolve();
  }
}
