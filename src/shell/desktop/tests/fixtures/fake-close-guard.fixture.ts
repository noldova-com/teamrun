/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ICloseGuard, IQuitPrompt } from "@noldova/teamrun-shell-desktop";

export class FakeCloseGuard implements ICloseGuard {
  public readonly prompts: IQuitPrompt[] = [];
  public canClose: boolean = true;

  public canCloseAsync(prompt: IQuitPrompt): Promise<boolean> {
    this.prompts.push(prompt);
    return Promise.resolve(this.canClose);
  }
}
