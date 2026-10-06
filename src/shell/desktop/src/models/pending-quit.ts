/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { WorkReport } from "@noldova/teamrun-shell-protocol";

import type { QuitOutcome } from "../enums/quit-outcome.js";
import type { IQuitPrompt } from "../interfaces/i-quit-prompt.js";
import { QuitQuestion } from "./quit-question.js";

export class PendingQuit {
  public readonly prompt: IQuitPrompt;
  public readonly settle: (outcome: QuitOutcome) => void;
  public report: WorkReport;
  public isWaiting: boolean = false;

  public constructor(prompt: IQuitPrompt, report: WorkReport, settle: (outcome: QuitOutcome) => void) {
    this.prompt = prompt;
    this.report = report;
    this.settle = settle;
  }

  public get isAnswered(): boolean {
    return this.report.descriptions.length === 0;
  }

  public show(): boolean {
    return this.prompt.show(new QuitQuestion(this.report.descriptions, this.isWaiting, false));
  }
}
