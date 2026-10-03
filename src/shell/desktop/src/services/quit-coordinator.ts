/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import type { WorkReport } from "@noldova/teamrun-shell-protocol";

import { QuitChoice } from "../enums/quit-choice.js";
import { QuitOutcome } from "../enums/quit-outcome.js";
import type { ICloseGuard } from "../interfaces/i-close-guard.js";
import type { IQuitPrompt } from "../interfaces/i-quit-prompt.js";
import { PendingQuit } from "../models/pending-quit.js";

export class QuitCoordinator implements ICloseGuard {
  private readonly isLast: (prompt: IQuitPrompt) => boolean;
  private readonly readWorkAsync: () => Promise<WorkReport | null>;
  private readonly stopAsync: () => Promise<void>;
  private isConfirming: boolean = false;
  private heard: WorkReport | null = null;
  private pending: PendingQuit | null = null;

  public constructor(isLast: (prompt: IQuitPrompt) => boolean, readWorkAsync: () => Promise<WorkReport | null>, stopAsync: () => Promise<void>) {
    this.isLast = isLast;
    this.readWorkAsync = readWorkAsync;
    this.stopAsync = stopAsync;
  }

  public async confirmAsync(prompt: IQuitPrompt): Promise<QuitOutcome> {
    if (this.isConfirming)
      return QuitOutcome.Stay;
    if (!this.isLast(prompt))
      return QuitOutcome.Quit;

    this.isConfirming = true;
    this.heard = null;
    const answered = await this.readWorkAsync();
    const heard = this.takeHeard();
    if (Object.isNull(answered))
      return this.quitNow();
    const report = !Object.isNull(heard) && heard.isNewerThan(answered) ? heard : answered;
    if (report.descriptions.length === 0)
      return this.quitNow();

    return await new Promise<QuitOutcome>(resolve => {
      this.pending = new PendingQuit(prompt, report, resolve);
      this.present(this.pending);
    });
  }

  public stopWorkAsync(): Promise<void> {
    return this.stopAsync();
  }

  public receive(report: WorkReport): void {
    if (!this.isConfirming)
      return;
    if (Object.isNull(this.pending)) {
      if (report.isNewerThan(this.heard))
        this.heard = report;
      return;
    }
    if (!report.isNewerThan(this.pending.report))
      return;
    this.pending.report = report;
    this.present(this.pending);
  }

  public answer(prompt: IQuitPrompt, choice: unknown): boolean {
    const pending = this.pending;
    if (Object.isNull(pending) || prompt !== pending.prompt)
      return false;
    switch (choice) {
      case QuitChoice.Wait:
        pending.isWaiting = true;
        this.present(pending);
        return true;
      case QuitChoice.Stop:
        this.finish(pending, QuitOutcome.StopWork);
        return true;
      case QuitChoice.Cancel:
        this.finish(pending, QuitOutcome.Stay);
        return true;
      default:
        return false;
    }
  }

  public release(): void {
    if (!Object.isNull(this.pending))
      this.finish(this.pending, QuitOutcome.Quit);
  }

  private takeHeard(): WorkReport | null {
    const heard = this.heard;
    this.heard = null;
    return heard;
  }

  private quitNow(): QuitOutcome {
    this.isConfirming = false;
    return QuitOutcome.Quit;
  }

  private present(pending: PendingQuit): void {
    if (pending.isAnswered || !pending.show())
      this.finish(pending, QuitOutcome.Quit);
  }

  private finish(pending: PendingQuit, outcome: QuitOutcome): void {
    this.pending = null;
    this.isConfirming = false;
    pending.prompt.show(null);
    pending.settle(outcome);
  }
}
