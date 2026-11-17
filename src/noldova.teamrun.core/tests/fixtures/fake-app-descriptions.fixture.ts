/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { AppLook, IAppDescriptions } from "@noldova/teamrun.core";

import { ChangeSignal } from "./change-signal.fixture.js";

export class FakeAppDescriptions implements IAppDescriptions {
  public readonly described: string[] = [];
  public readonly signals: (AbortSignal | undefined)[] = [];
  public readonly failing: Set<string> = new Set();
  public readonly unanswered: Set<string> = new Set();
  public readonly held: Set<string> = new Set();
  public looks: ReadonlyMap<string, AppLook> = new Map();
  private readonly gate: PromiseWithResolvers<void> = Promise.withResolvers<void>();
  private readonly answers: Promise<unknown>[] = [];

  public describeAsync(app: string, signal?: AbortSignal): Promise<AppLook | null> {
    const answer = this.answerAsync(app, signal);
    if (!this.unanswered.has(app) && !this.held.has(app))
      this.answers.push(answer.catch(() => null));
    return answer;
  }

  public async answeredAsync(): Promise<void> {
    await Promise.all(this.answers);
    await new Promise(resolve => setImmediate(resolve));
  }

  public release(): void {
    this.gate.resolve();
  }

  private async answerAsync(app: string, signal?: AbortSignal): Promise<AppLook | null> {
    this.described.push(app);
    this.signals.push(signal);
    ChangeSignal.notify();
    if (this.failing.has(app))
      throw new Error(`${app} couldn't be described.`);
    if (this.unanswered.has(app))
      return await Promise.withResolvers<never>().promise;
    if (this.held.has(app))
      await this.gate.promise;

    return this.looks.get(app) ?? null;
  }
}
