/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type {
  ApprovalAsk, ITurnListener, QuestionAsk, SharedMcpFailure, TaskEnd, TaskStart, TurnDetail, TurnStart, TurnSteer, TurnWake, WakeTurn
} from "@noldova/teamrun.core";
import type { ObservedSettings, PlanWindow, QuestionAnswer, ReplyUsage } from "@noldova/teamrun.protocol";

export class RecordingTurnListener implements ITurnListener {
  public readonly starts: TurnStart[] = [];
  public readonly titles: string[] = [];
  public readonly details: TurnDetail[] = [];
  public readonly observations: ObservedSettings[] = [];
  public readonly asks: ApprovalAsk[] = [];
  public readonly decisions: string[] = [];
  public readonly questionAsks: QuestionAsk[] = [];
  public readonly postedQuestions: QuestionAsk[] = [];
  public readonly answers: (readonly QuestionAnswer[] | null)[] = [];
  public readonly signals: (AbortSignal | undefined)[] = [];
  public readonly usages: ReplyUsage[] = [];
  public readonly planUsages: (readonly PlanWindow[])[] = [];
  public readonly taskStarts: TaskStart[] = [];
  public readonly taskOutputs: { readonly taskId: string; readonly text: string }[] = [];
  public readonly taskEnds: TaskEnd[] = [];
  public readonly wakes: TurnWake[] = [];
  public readonly sharedFailures: SharedMcpFailure[] = [];
  public wakeTurn: WakeTurn | null = null;
  public readonly wakeTurns: WakeTurn[] = [];
  public thinking: number = 0;
  public defaultDecision: string = "accept";
  public decisionFailure: Error | null = null;
  public heldDecision: Promise<string> | null = null;
  public readonly heldDecisions: Promise<string>[] = [];
  public heldAnswer: Promise<readonly QuestionAnswer[] | null> | null = null;
  public sharedFailureError: Error | null = null;
  public heldDetail: Promise<void> | null = null;
  public refusedDetail: string | null = null;
  public readonly finishedDetails: TurnDetail[] = [];

  public onSteerable?: (steer: ((steer: TurnSteer) => Promise<boolean>) | null) => void;

  public onTitleAsync(title: string): Promise<void> {
    this.titles.push(title);
    return Promise.resolve();
  }

  public get texts(): readonly string[] {
    return this.details.map(t => t.text);
  }

  public get lastObserved(): ObservedSettings | undefined {
    return this.observations.at(-1);
  }

  public onStartedAsync(start: TurnStart): Promise<void> {
    this.starts.push(start);
    return Promise.resolve();
  }

  public async onDetailAsync(detail: TurnDetail): Promise<void> {
    if (!Object.isNull(this.refusedDetail) && detail.text.startsWith(this.refusedDetail))
      throw new Error("The listener refused the detail.");
    this.details.push(detail);
    const held = this.heldDetail;
    this.heldDetail = null;
    if (!Object.isNull(held))
      await held;
    this.finishedDetails.push(detail);
  }

  public onThinking(): void {
    this.thinking += 1;
  }

  public onApprovalRequested(ask: ApprovalAsk, signal?: AbortSignal): Promise<string> {
    this.asks.push(ask);
    this.signals.push(signal);
    if (!Object.isNull(this.decisionFailure))
      return Promise.reject(this.decisionFailure);
    const held = this.heldDecisions.shift() ?? this.heldDecision;
    if (!Object.isNull(held))
      return held;

    return Promise.resolve(this.decisions.shift() ?? this.defaultDecision);
  }

  public onQuestionsPostedAsync(ask: QuestionAsk): Promise<void> {
    this.postedQuestions.push(ask);
    return Promise.resolve();
  }

  public onQuestionsAsked(ask: QuestionAsk, signal?: AbortSignal): Promise<readonly QuestionAnswer[] | null> {
    this.questionAsks.push(ask);
    this.signals.push(signal);
    if (!Object.isNull(this.decisionFailure))
      return Promise.reject(this.decisionFailure);

    return this.heldAnswer ?? Promise.resolve(this.answers.shift() ?? null);
  }

  public onObservedAsync(observed: ObservedSettings): Promise<void> {
    this.observations.push(observed);
    return Promise.resolve();
  }

  public onUsageAsync(usage: ReplyUsage): Promise<void> {
    this.usages.push(usage);
    return Promise.resolve();
  }

  public onPlanUsageAsync(windows: readonly PlanWindow[]): Promise<void> {
    this.planUsages.push(windows);
    return Promise.resolve();
  }

  public onTaskStartedAsync(start: TaskStart): Promise<void> {
    this.taskStarts.push(start);
    return Promise.resolve();
  }

  public onTaskOutput(taskId: string, text: string): void {
    this.taskOutputs.push({ taskId, text });
  }

  public onTaskEndedAsync(end: TaskEnd): Promise<void> {
    this.taskEnds.push(end);
    return Promise.resolve();
  }

  public onWakeAsync(wake: TurnWake): Promise<WakeTurn | null> {
    this.wakes.push(wake);
    return Promise.resolve(this.wakeTurns.shift() ?? this.wakeTurn);
  }

  public onSharedServerFailedAsync(failure: SharedMcpFailure): Promise<void> {
    if (!Object.isNull(this.sharedFailureError))
      return Promise.reject(this.sharedFailureError);
    this.sharedFailures.push(failure);
    return Promise.resolve();
  }
}
