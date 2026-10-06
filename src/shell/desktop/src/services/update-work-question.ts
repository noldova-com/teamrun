/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { QuitChoice } from "../enums/quit-choice.js";
import type { IQuitPrompt } from "../interfaces/i-quit-prompt.js";
import { QuitQuestion } from "../models/quit-question.js";

export class UpdateWorkQuestion {
  private readonly prompt: IQuitPrompt;
  private readonly readWorkAsync: () => Promise<readonly string[]>;
  private readonly interval: number;
  private readonly wait: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  private readonly finished: AbortController = new AbortController();
  private readonly outcome: PromiseWithResolvers<boolean> = Promise.withResolvers<boolean>();
  private work: readonly string[] = [];
  private isWaiting: boolean = false;

  public constructor(prompt: IQuitPrompt, readWorkAsync: () => Promise<readonly string[]>, interval: number, wait: (milliseconds: number, signal: AbortSignal) => Promise<void>) {
    this.prompt = prompt;
    this.readWorkAsync = readWorkAsync;
    this.interval = interval;
    this.wait = wait;
  }

  private get isFinished(): boolean {
    return this.finished.signal.aborted;
  }

  public askAsync(work: readonly string[]): Promise<boolean> {
    this.work = work;
    this.present();
    return this.outcome.promise;
  }

  public answer(prompt: IQuitPrompt, choice: unknown): boolean {
    if (this.isFinished || prompt !== this.prompt)
      return false;
    if (choice === QuitChoice.Wait && !this.isWaiting) {
      this.isWaiting = true;
      this.present();
      void this.waitAsync();
    }
    else if (choice === QuitChoice.Stop)
      this.finish(true);
    else if (choice === QuitChoice.Cancel)
      this.finish(false);
    else
      return false;
    return true;
  }

  private async waitAsync(): Promise<void> {
    while (!this.isFinished) {
      try {
        await this.wait(this.interval, this.finished.signal);
        this.work = await this.readWorkAsync();
      }
      catch (error) {
        this.fail(error);
        return;
      }
      if (this.work.length === 0)
        this.finish(true);
      else
        this.present();
    }
  }

  private present(): void {
    if (!this.isFinished && !this.prompt.show(new QuitQuestion(this.work, this.isWaiting, true)))
      this.finish(false);
  }

  private finish(outcome: boolean): void {
    if (this.end())
      this.outcome.resolve(outcome);
  }

  private fail(error: unknown): void {
    if (this.end())
      this.outcome.reject(error);
  }

  private end(): boolean {
    if (this.isFinished)
      return false;
    this.finished.abort();
    this.prompt.show(null);
    return true;
  }
}
