/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import {
  ApprovalOutcome,
  BackgroundTaskStatus,
  DetailKind,
  type ObservedSettings,
  type PlanWindow,
  type QuestionAnswer,
  type ReplyUsage,
  SubAgent,
  SubAgentStatus
} from "@noldova/teamrun.protocol";

import { DenyingTurn } from "../../enums/denying-turn.js";
import { TurnOutcome } from "../../enums/turn-outcome.js";
import { ApprovalNotDeniableException } from "../../exceptions/approval-not-deniable.exception.js";
import type { IProviderAdapter } from "../../interfaces/i-provider-adapter.js";
import type { ITurnListener } from "../../interfaces/i-turn-listener.js";
import { ApprovalAsk } from "../../models/approval-ask.js";
import { QuestionAsk } from "../../models/question-ask.js";
import type { SharedMcpFailure } from "../../models/shared-mcp-failure.js";
import { TaskEnd } from "../../models/task-end.js";
import { TaskStart } from "../../models/task-start.js";
import { TurnDetail } from "../../models/turn-detail.js";
import type { TurnRequest } from "../../models/turn-request.js";
import type { WakeTurn } from "../../models/wake-turn.js";
import { Resources } from "../../resources.js";
import type { ReplyRun } from "./reply-run.js";

export class SubAgentRun implements ITurnListener {
  private static readonly toolKinds: ReadonlySet<DetailKind> = new Set([DetailKind.Command, DetailKind.FileChange, DetailKind.SubAgent]);

  private readonly controller: AbortController = new AbortController();
  private readonly ending: PromiseWithResolvers<SubAgent> = Promise.withResolvers();
  private readonly tools: Set<string> = new Set();
  private readonly startedAt: number = Date.now();
  private readonly parent: ReplyRun;
  private readonly readOnly: boolean;
  private row: SubAgent;
  private started: boolean = false;
  private begun: Promise<void> = Promise.resolve();
  private text: string | null = null;
  private session: string | null = null;
  private tokens: number | null = null;

  public readonly id: string;
  public readonly messageId: string;

  public constructor(id: string, type: string, description: string, model: string | null, messageId: string, parent: ReplyRun, readOnly: boolean) {
    this.row = new SubAgent(id, type, description, model, SubAgentStatus.Running, true, null, null, null, null, true);
    this.id = id;
    this.messageId = messageId;
    this.parent = parent;
    this.readOnly = readOnly;
  }

  public get current(): SubAgent {
    return this.row;
  }

  public get ended(): Promise<SubAgent> {
    return this.ending.promise;
  }

  public get wasStopped(): boolean {
    return this.controller.signal.aborted;
  }

  public get nativeSessionId(): string | null {
    return this.session;
  }

  public async beginAsync(): Promise<void> {
    this.begun = this.reportBeginAsync();
    await this.begun;
  }

  public async executeAsync(adapter: IProviderAdapter, request: () => Promise<TurnRequest>): Promise<void> {
    if (!this.row.isRunning)
      return;
    this.started = true;
    try {
      const result = await adapter.runTurn(await request(), this, this.controller.signal);
      this.session = result.nativeSessionId;
      if (result.outcome === TurnOutcome.Failed)
        await this.endAsync(SubAgentStatus.Failed, result.error);
      else
        await this.endAsync(result.outcome === TurnOutcome.Completed && !this.controller.signal.aborted ? SubAgentStatus.Completed : SubAgentStatus.Stopped,
          this.result());
    }
    catch (error) {
      await this.endAsync(this.controller.signal.aborted ? SubAgentStatus.Stopped : SubAgentStatus.Failed, error instanceof Error ? error.message : String(error));
    }
  }

  public async stopAsync(): Promise<void> {
    this.controller.abort();
    await Promise.allSettled([this.begun]);
    if (!this.started && this.row.isRunning)
      await this.endAsync(SubAgentStatus.Stopped, null);
    await this.ending.promise;
  }

  public onStartedAsync(): Promise<void> {
    return Promise.resolve();
  }

  public async onDetailAsync(detail: TurnDetail): Promise<void> {
    if (detail.kind === DetailKind.Text)
      this.text = detail.text;
    if (SubAgentRun.toolKinds.has(detail.kind) && !Object.isNull(detail.providerItemId))
      this.tools.add(detail.providerItemId);
    await this.parent.onDetailAsync(new TurnDetail(detail.kind === DetailKind.Text ? DetailKind.Note : detail.kind, detail.text, detail.payload,
      this.itemOf(detail.providerItemId), Object.isNull(detail.parentItemId) ? this.id : this.idOf(detail.parentItemId)));
  }

  public onThinking(): void { }

  public async onApprovalRequested(ask: ApprovalAsk, signal?: AbortSignal): Promise<string> {
    if (this.readOnly)
      return await this.denyAsync(ask);
    return await this.parent.onApprovalRequested(new ApprovalAsk(ask.providerRequestId, ask.kind, ask.nativeKind, ask.summary, this.named(ask.payload), ask.options),
      signal);
  }

  public onQuestionsAsked(ask: QuestionAsk, signal?: AbortSignal): Promise<readonly QuestionAnswer[] | null> {
    return this.parent.onQuestionsAsked(new QuestionAsk(ask.providerRequestId, ask.nativeKind, ask.questions, ask.subAgent ?? this.row.description), signal);
  }

  public onQuestionsPostedAsync(): Promise<void> {
    return Promise.resolve();
  }

  public onObservedAsync(observed: ObservedSettings): Promise<void> {
    this.row = this.row.with({ model: observed.model });
    return Promise.resolve();
  }

  public onUsageAsync(usage: ReplyUsage): Promise<void> {
    this.tokens = (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);
    return Promise.resolve();
  }

  public async onPlanUsageAsync(windows: readonly PlanWindow[], readAt: string): Promise<void> {
    await this.parent.onPlanUsageAsync(windows, readAt);
  }

  public async onTaskStartedAsync(start: TaskStart): Promise<void> {
    await this.parent.onTaskStartedAsync(new TaskStart(this.idOf(start.taskId), start.command, start.stop, this.itemOf(start.subAgentId), start.hasOwnStop));
  }

  public onTaskOutput(taskId: string, text: string): void {
    this.parent.onTaskOutput(this.idOf(taskId), text);
  }

  public async onTaskEndedAsync(end: TaskEnd): Promise<void> {
    await this.parent.onTaskEndedAsync(new TaskEnd(this.idOf(end.taskId), end.status, end.exitCode));
  }

  public onWakeAsync(): Promise<WakeTurn | null> {
    return Promise.resolve(null);
  }

  public async onSharedServerFailedAsync(failure: SharedMcpFailure): Promise<void> {
    await this.parent.onSharedServerFailedAsync(failure);
  }

  private async reportBeginAsync(): Promise<void> {
    await this.parent.onDetailAsync(new TurnDetail(DetailKind.SubAgent, this.row.description, this.row.toJson(), this.id));
    await this.parent.onTaskStartedAsync(new TaskStart(this.id, this.row.description, () => this.stopAsync(), this.id));
  }

  private async endAsync(status: SubAgentStatus, summary: string | null): Promise<void> {
    this.row = this.row.with({ status, summary, toolUses: this.tools.size, tokens: this.tokens, durationMs: Date.now() - this.startedAt });
    await this.parent.onDetailAsync(new TurnDetail(DetailKind.SubAgent, this.row.description, this.row.toJson(), this.id));
    await this.parent.onTaskEndedAsync(new TaskEnd(this.id, SubAgentRun.taskStatusOf(status)));
    this.ending.resolve(this.row);
  }

  private async denyAsync(ask: ApprovalAsk): Promise<string> {
    const option = ask.options.find(t => t.outcome === ApprovalOutcome.Denied);
    if (Object.isUndefined(option))
      throw new ApprovalNotDeniableException(DenyingTurn.Explorer, ask.summary);
    await this.parent.onDetailAsync(new TurnDetail(DetailKind.Note, Resources.formatExplorerDenied(ask.summary), null, null, this.id));
    return option.id;
  }

  private result(): string | null {
    if (Object.isNull(this.text) || this.text.length <= Resources.subAgentResultLimit)
      return this.text;
    return `${this.text.slice(0, Resources.subAgentResultLimit)}${Resources.formatSubAgentResultCut(this.text.length - Resources.subAgentResultLimit)}`;
  }

  private named(payload: JsonValue): JsonValue {
    return SubAgentRun.isJsonObject(payload) ? { [Resources.subAgentField]: this.row.description, ...payload } : payload;
  }

  private itemOf(id: string | null): string | null {
    return Object.isNull(id) ? null : this.idOf(id);
  }

  private idOf(id: string): string {
    return `${this.id}${Resources.subAgentItemSeparator}${id}`;
  }

  private static taskStatusOf(status: SubAgentStatus): BackgroundTaskStatus {
    return status === SubAgentStatus.Completed ? BackgroundTaskStatus.Completed
      : status === SubAgentStatus.Failed ? BackgroundTaskStatus.Failed : BackgroundTaskStatus.Stopped;
  }

  private static isJsonObject(value: JsonValue): value is JsonObject {
    return typeof value === "object" && !Object.isNull(value) && !Array.isArray(value);
  }
}
