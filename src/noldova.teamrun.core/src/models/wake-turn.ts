/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { ObservedSettings, PlanWindow, QuestionAnswer, ReplyUsage } from "@noldova/teamrun.protocol";

import type { ITurnListener } from "../interfaces/i-turn-listener.js";
import { Resources } from "../resources.js";
import type { ApprovalAsk } from "./approval-ask.js";
import type { QuestionAsk } from "./question-ask.js";
import type { SharedMcpFailure } from "./shared-mcp-failure.js";
import type { TaskEnd } from "./task-end.js";
import type { TaskStart } from "./task-start.js";
import type { TurnDetail } from "./turn-detail.js";
import type { TurnResult } from "./turn-result.js";
import type { TurnStart } from "./turn-start.js";
import type { TurnTools } from "./turn-tools.js";
import type { TurnWake } from "./turn-wake.js";

export class WakeTurn implements ITurnListener {
  public readonly environment: Readonly<Record<string, string>>;
  public readonly planFirst: boolean;
  public readonly mode: string | null;
  private readonly result: PromiseWithResolvers<TurnResult> = Promise.withResolvers<TurnResult>();
  private readonly queued: { readonly run: (target: ITurnListener) => Promise<void>; readonly fail?: (error: unknown) => void }[] = [];
  private readonly replay: PromiseWithResolvers<void> = Promise.withResolvers<void>();
  private replaying: boolean = false;
  private target: ITurnListener | null = null;
  private interrupt: (() => void) | null = null;
  private tools: TurnTools | null = null;
  private readonly toolsHandlers: ((tools: TurnTools) => Promise<void>)[] = [];
  private readonly followHandlers: (() => void)[] = [];
  private readonly senderAdopter: (token: string) => boolean;

  public constructor(environment: Readonly<Record<string, string>>, planFirst: boolean = false, adoptSender: (token: string) => boolean = () => false,
    mode: string | null = null) {
    this.environment = environment;
    this.planFirst = planFirst;
    this.mode = mode;
    this.senderAdopter = adoptSender;
  }

  public adoptSender(token: string): boolean {
    return this.senderAdopter(token);
  }

  public onInterrupt(interrupt: () => void): void {
    this.interrupt = interrupt;
  }

  public async onToolsAsync(handler: (tools: TurnTools) => Promise<void>): Promise<void> {
    if (Object.isNull(this.tools))
      this.toolsHandlers.push(handler);
    else
      await handler(this.tools);
  }

  public onFollowed(handler: () => void): void {
    if (Object.isNull(this.target))
      this.followHandlers.push(handler);
    else
      handler();
  }

  public async useToolsAsync(tools: TurnTools | null): Promise<void> {
    if (Object.isNull(tools))
      return;
    this.tools = tools;
    for (const handler of this.toolsHandlers.splice(0))
      await handler(tools);
  }

  public cancel(): void {
    this.interrupt?.();
  }

  public end(result: TurnResult): void {
    this.result.resolve(result);
  }

  public follow(target: ITurnListener, signal: AbortSignal): Promise<TurnResult> {
    this.target = target;
    this.replaying = true;
    const replayed = this.replayAsync(target);
    for (const handler of this.followHandlers.splice(0))
      handler();
    if (signal.aborted)
      this.interrupt?.();
    else
      signal.addEventListener(Resources.abortEvent, () => this.interrupt?.(), { once: true });

    return this.resultAfterAsync(replayed);
  }

  public onStartedAsync(start: TurnStart): Promise<void> {
    return this.forwardAsync(t => t.onStartedAsync(start));
  }

  public onDetailAsync(detail: TurnDetail): Promise<void> {
    return this.forwardAsync(t => t.onDetailAsync(detail));
  }

  public onThinking(): void {
    this.forward(t => t.onThinking());
  }

  public onApprovalRequested(ask: ApprovalAsk, signal?: AbortSignal): Promise<string> {
    return this.relayAsync(t => t.onApprovalRequested(ask, signal));
  }

  public onQuestionsAsked(ask: QuestionAsk, signal?: AbortSignal): Promise<readonly QuestionAnswer[] | null> {
    return this.relayAsync(t => t.onQuestionsAsked(ask, signal));
  }

  public onQuestionsPostedAsync(ask: QuestionAsk): Promise<void> {
    return this.forwardAsync(t => t.onQuestionsPostedAsync(ask));
  }

  public onObservedAsync(observed: ObservedSettings): Promise<void> {
    return this.forwardAsync(t => t.onObservedAsync(observed));
  }

  public onUsageAsync(usage: ReplyUsage): Promise<void> {
    return this.forwardAsync(t => t.onUsageAsync(usage));
  }

  public onPlanUsageAsync(windows: readonly PlanWindow[], readAt: string): Promise<void> {
    return this.forwardAsync(t => t.onPlanUsageAsync(windows, readAt));
  }

  public onTaskStartedAsync(start: TaskStart): Promise<void> {
    return this.forwardAsync(t => t.onTaskStartedAsync(start));
  }

  public onTaskOutput(taskId: string, text: string): void {
    this.forward(t => t.onTaskOutput(taskId, text));
  }

  public onTaskEndedAsync(end: TaskEnd): Promise<void> {
    return this.forwardAsync(t => t.onTaskEndedAsync(end));
  }

  public async onWakeAsync(wake: TurnWake): Promise<WakeTurn | null> {
    if (Object.isNull(this.target))
      return null;
    return await this.relayAsync(t => t.onWakeAsync(wake));
  }

  public onSharedServerFailedAsync(failure: SharedMcpFailure): Promise<void> {
    return this.forwardAsync(t => t.onSharedServerFailedAsync(failure));
  }

  private async resultAfterAsync(replayed: Promise<void>): Promise<TurnResult> {
    await replayed;
    return await this.result.promise;
  }

  private async replayAsync(target: ITurnListener): Promise<void> {
    try {
      for (let next = this.queued.shift(); !Object.isUndefined(next); next = this.queued.shift())
        await next.run(target);
    }
    catch (error) {
      for (const left of this.queued.splice(0))
        left.fail?.(error);
      throw error;
    }
    finally {
      this.replaying = false;
      this.replay.resolve();
    }
  }

  private forward(call: (target: ITurnListener) => void): void {
    const target = this.target;
    if (!Object.isNull(target) && !this.replaying) {
      call(target);
      return;
    }
    this.queued.push({
      run: t => {
        call(t);
        return Promise.resolve();
      }
    });
  }

  private forwardAsync(call: (target: ITurnListener) => Promise<void>): Promise<void> {
    const target = this.target;
    if (!Object.isNull(target) && !this.replaying)
      return call(target);
    if (Object.isNull(target)) {
      this.queued.push({ run: call });
      return Promise.resolve();
    }
    const done = Promise.withResolvers<void>();
    this.queued.push({
      run: t => {
        const outcome = call(t);
        done.resolve(outcome);
        return outcome;
      },
      fail: done.reject
    });
    return done.promise;
  }

  private async relayAsync<T>(call: (target: ITurnListener) => Promise<T>): Promise<T> {
    const target = this.target;
    if (!Object.isNull(target) && !this.replaying)
      return await call(target);

    const answer = Promise.withResolvers<T>();
    this.queued.push({
      run: t => {
        answer.resolve(call(t));
        return Promise.resolve();
      },
      fail: answer.reject
    });
    try {
      return await answer.promise;
    }
    finally {
      await this.replay.promise;
    }
  }
}
