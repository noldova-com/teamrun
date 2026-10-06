/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IQuitPrompt, QuitQuestion } from "@noldova/teamrun-shell-desktop";

export class FakeQuitPrompt implements IQuitPrompt {
  public readonly shown: string[] = [];
  public canShow: boolean = true;

  public show(question: QuitQuestion | null): boolean {
    this.shown.push(question === null ? "none" : `${question.descriptions.join("+")}${question.isWaiting ? " waiting" : ""}${question.isUpdate ? " update" : ""}`);
    return this.canShow;
  }
}
