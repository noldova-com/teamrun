/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { MessageBoxOptions, MessageBoxReturnValue } from "electron";

import type { IDialogHost } from "@noldova/teamrun-shell-desktop";

export class FakeDialogHost implements IDialogHost {
  public readonly answers: number[];
  public readonly boxes: { windowId: number | null; options: MessageBoxOptions }[] = [];

  public constructor(answers: readonly number[] = []) {
    this.answers = [...answers];
  }

  public showMessageBox(windowId: number | null, options: MessageBoxOptions): Promise<MessageBoxReturnValue> {
    this.boxes.push({ windowId, options });
    const answer = this.answers.shift();
    if (answer !== undefined)
      return Promise.resolve({ response: answer, checkboxChecked: false });
    return new Promise(resolve => options.signal?.addEventListener("abort", () => resolve({ response: options.cancelId ?? 0, checkboxChecked: false })));
  }
}
