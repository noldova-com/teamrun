/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException, type JsonObject, JsonReader, type JsonValue } from "@noldova/context.json";
import { ApprovalAsk, type ITurnListener, QuestionAsk, TurnDetail, TurnOutcome, TurnResult, UsageLimit } from "@noldova/teamrun.core";
import { ApprovalKind, ApprovalOption, ApprovalOutcome, type ApprovalQuestion, ApprovalScope, DetailKind, ObservedSettings, PlanStepStatus,
  type QuestionAnswer } from "@noldova/teamrun.protocol";

import { InvalidOperationException } from "../../exceptions/invalid-operation.exception.js";
import { UnsupportedServerRequestException } from "../../exceptions/unsupported-server-request.exception.js";
import type { INotificationHandler } from "../../interfaces/i-notification-handler.js";
import type { IServerRequestHandler } from "../../interfaces/i-server-request-handler.js";
import { Resources } from "../../resources.js";
import type { DeltaStream } from "../delta-stream.js";
import { FailureDescriber } from "../failure-describer.js";
import { PlanDetails } from "../plan-details.js";
import { UsageValues } from "../usage-values.js";
import type { CodexItemReader } from "./codex-item.reader.js";

export class CodexTurn implements INotificationHandler, IServerRequestHandler {
  public readonly threadId: string;
  private readonly listener: ITurnListener;
  private readonly declined: Set<string> = new Set();
  private readonly toolCalls: Map<string, string> = new Map();
  private readonly itemReader: CodexItemReader;
  private readonly stream: DeltaStream;
  private readonly completion: PromiseWithResolvers<void> = Promise.withResolvers<void>();
  private readonly start: PromiseWithResolvers<string> = Promise.withResolvers<string>();
  private currentObserved: ObservedSettings;
  private currentTurnId: string | null = null;
  private currentOutcome: TurnOutcome | null = null;
  private currentError: string | null = null;
  private streamFailure: string | null = null;
  private full: boolean = false;
  private limited: boolean = false;
  private approvalCounter: number = 0;
  private stopping: boolean = false;
  private interrupting: boolean = false;
  private followUps: number = 0;

  public constructor(threadId: string, listener: ITurnListener, observed: ObservedSettings, itemReader: CodexItemReader, stream: DeltaStream) {
    ArgumentException.throwIfNullOrWhitespace(threadId, Resources.threadIdParameterName);

    this.threadId = threadId;
    this.listener = listener;
    this.currentObserved = observed;
    this.itemReader = itemReader;
    this.stream = stream;
  }

  public get turnId(): string | null {
    return this.currentTurnId;
  }

  public get observed(): ObservedSettings {
    return this.currentObserved;
  }

  public get outcome(): TurnOutcome | null {
    return this.currentOutcome;
  }

  public get error(): string | null {
    return this.currentError;
  }

  public get isComplete(): boolean {
    return !Object.isNull(this.currentOutcome);
  }

  public get followUpItems(): number {
    return this.followUps;
  }

  public get stopsCodex(): boolean {
    return this.stopping;
  }

  public begin(turnId: string): void {
    ArgumentException.throwIfNullOrWhitespace(turnId, Resources.turnIdParameterName);

    this.currentTurnId = turnId;
    this.start.resolve(turnId);
  }

  public requestInterrupt(): Promise<string> | null {
    if (this.interrupting)
      return null;
    this.interrupting = true;
    return this.start.promise;
  }

  public waitForCompletion(): Promise<void> {
    return this.completion.promise;
  }

  public fail(error: string): void {
    this.settle(TurnOutcome.Failed, error);
  }

  public interrupt(): void {
    this.settle(TurnOutcome.Interrupted, null);
  }

  public toResult(aborted: boolean): TurnResult {
    if (Object.isNull(this.currentOutcome))
      throw new InvalidOperationException(Resources.turnNotSettled);

    const outcome = aborted && this.currentOutcome !== TurnOutcome.Completed ? TurnOutcome.Interrupted : this.currentOutcome;
    const failed = outcome === TurnOutcome.Failed;
    return new TurnResult(outcome, this.threadId, this.currentObserved, failed ? this.currentError : null, this.currentTurnId, null,
      failed && this.limited ? new UsageLimit(null) : null);
  }

  public async handleNotificationAsync(method: string, params: JsonReader): Promise<void> {
    if (!this.belongsToThread(params))
      return;

    switch (method) {
      case Resources.itemStartedNotification:
        await this.handleStartedAsync(params.readObject(Resources.itemField));
        break;
      case Resources.itemCompletedNotification:
        await this.flushAsync();
        await this.handleCompletedItemAsync(params.readObject(Resources.itemField));
        break;
      case Resources.agentMessageDeltaNotification:
        this.stream.append(params.readNonBlankString(Resources.itemIdField), DetailKind.Text, params.readString(Resources.deltaField));
        break;
      case Resources.modelReroutedNotification:
        await this.handleRerouteAsync(params);
        break;
      case Resources.errorNotification:
        await this.handleErrorAsync(params);
        break;
      case Resources.turnPlanUpdatedNotification:
        await this.flushAsync();
        await this.handlePlanAsync(params);
        break;
      case Resources.turnStartedNotification:
        this.begin(params.readObject(Resources.turnField).readNonBlankString(Resources.idField));
        break;
      case Resources.turnCompletedNotification:
        await this.flushAsync();
        this.handleCompleted(params.readObject(Resources.turnField));
        break;
      default:
        break;
    }
  }

  public handleServerRequest(method: string, params: JsonReader, signal: AbortSignal): Promise<JsonValue> {
    return this.ask(method, params, signal, null);
  }

  public async ask(method: string, params: JsonReader, signal: AbortSignal, subAgent: string | null): Promise<JsonValue> {
    switch (method) {
      case Resources.commandApprovalRequest:
        return { decision: await this.decide(params, this.createCommandAsk(params, subAgent), signal) };
      case Resources.fileChangeApprovalRequest:
        return { decision: await this.decide(params, this.createFileChangeAsk(params, subAgent), signal) };
      case Resources.userInputRequest:
        return this.askUser(params, signal, subAgent);
      case Resources.mcpElicitationRequest:
        return this.elicit(params, signal, subAgent);
      default:
        throw new UnsupportedServerRequestException(method);
    }
  }

  public hasDeclined(itemId: string): boolean {
    return this.declined.has(itemId);
  }

  private async flushAsync(): Promise<void> {
    try {
      await this.stream.flushAsync();
    }
    catch (error) {
      this.streamFailure ??= FailureDescriber.describe(error);
    }
  }

  private belongsToThread(params: JsonReader): boolean {
    return params.hasField(Resources.threadIdField) && params.readValue(Resources.threadIdField) === this.threadId;
  }

  private async handlePlanAsync(params: JsonReader): Promise<void> {
    const json = params.toJson();
    const steps = params.readObjectArray(Resources.planField).map(t => t.toJson())
      .map(t => PlanDetails.step(t[Resources.stepField], PlanDetails.statusOf(Resources.codexPlanStatuses, t[Resources.statusField], PlanStepStatus.Pending), undefined));
    await this.listener.onDetailAsync(PlanDetails.detail(steps, json[Resources.explanationField], Resources.planDetailId));
  }

  private async handleStartedAsync(item: JsonReader): Promise<void> {
    const type = item.readNonBlankString(Resources.typeField);
    if (type === Resources.mcpToolCallItemType)
      this.toolCalls.set(item.readNonBlankString(Resources.idField), item.readString(Resources.serverField));
    if (type === Resources.reasoningItemType)
      this.listener.onThinking();
    else
      await this.reportAsync(this.itemReader.readStarted(item));
  }

  private async handleCompletedItemAsync(item: JsonReader): Promise<void> {
    this.toolCalls.delete(item.readNonBlankString(Resources.idField));
    await this.reportAsync(this.itemReader.readCompleted(item, this.declined.has(item.readNonBlankString(Resources.idField))));
    const posted = await this.readPostedQuestionsAsync(item);
    if (posted.length > 0)
      await this.listener.onQuestionsPostedAsync(new QuestionAsk(item.readNonBlankString(Resources.idField), Resources.codexAsyncInputTool, posted));
    const json = item.toJson();
    if (Resources.codexFollowUpItemTypes.includes(item.readNonBlankString(Resources.typeField)))
      this.followUps += 1;
    const output = json[Resources.aggregatedOutputField];
    if (item.readNonBlankString(Resources.typeField) !== Resources.commandExecutionItemType || json[Resources.statusField] !== Resources.failedItemStatus
      || json[Resources.exitCodeField] !== Resources.codexSandboxExitCode || !Object.isString(output)
      || !output.startsWith(Resources.codexUnifiedExecFailure) || !output.includes(Resources.codexSandboxSetupFailure))
      return;
    this.stopping = true;
    this.settle(TurnOutcome.Failed, CodexTurn.hasSandboxFix(this.currentObserved.harnessVersion)
      ? Resources.codexSandboxSetupFailedOnFixedVersion : Resources.codexSandboxSetupFailed);
  }

  private static hasSandboxFix(version: string | null): boolean {
    const match = Resources.codexMinorVersionPattern.exec(version ?? String.empty);
    return !Object.isNull(match) && (Number(match[1]) > 0 || Number(match[2]) >= Resources.codexSandboxFixedMinor);
  }

  private async reportAsync(detail: TurnDetail | null): Promise<void> {
    if (!Object.isNull(detail))
      await this.listener.onDetailAsync(detail);
  }

  private async handleRerouteAsync(params: JsonReader): Promise<void> {
    const fromModel = params.readString(Resources.fromModelField);
    const toModel = params.readString(Resources.toModelField);
    const reason = params.readString(Resources.reasonField);
    const observed = this.currentObserved;
    this.currentObserved = new ObservedSettings(observed.kind, toModel, observed.effort, observed.harnessVersion, observed.unavailableModel,
      observed.speed, observed.speedUnavailable);
    await this.listener.onObservedAsync(this.currentObserved);
    await this.listener.onDetailAsync(new TurnDetail(DetailKind.Note, Resources.formatModelRerouted(fromModel, toModel, reason), null, null));
  }

  private async handleErrorAsync(params: JsonReader): Promise<void> {
    const error = params.readObject(Resources.errorField);
    this.full ||= CodexTurn.isContextFull(error);
    const message = error.readString(Resources.messageField);
    const willRetry = params.readBoolean(Resources.willRetryField);
    this.limited ||= !willRetry && CodexTurn.isUsageLimit(error);
    const text = `${willRetry ? Resources.retryableErrorPrefix : Resources.errorPrefix}${message}`;
    await this.listener.onDetailAsync(new TurnDetail(willRetry ? DetailKind.Note : DetailKind.Error, text, null, null));
  }

  private handleCompleted(turn: JsonReader): void {
    if (!Object.isNull(this.currentTurnId) && turn.readString(Resources.idField) !== this.currentTurnId)
      return;

    const status = turn.readString(Resources.statusField);
    if (status === Resources.completedTurnStatus) {
      this.settle(Object.isNull(this.streamFailure) ? TurnOutcome.Completed : TurnOutcome.Failed, this.streamFailure);
      return;
    }
    if (status === Resources.interruptedTurnStatus) {
      this.settle(TurnOutcome.Interrupted, null);
      return;
    }

    const error = turn.hasField(Resources.errorField) ? turn.readNullableObject(Resources.errorField) : null;
    this.limited ||= !Object.isNull(error) && CodexTurn.isUsageLimit(error);
    if (this.full || (!Object.isNull(error) && CodexTurn.isContextFull(error)))
      this.settle(TurnOutcome.Failed, Resources.formatContextFull(Resources.codexDisplayName));
    else
      this.settle(TurnOutcome.Failed, Object.isNull(error) ? Resources.formatTurnStatus(status) : error.readString(Resources.messageField));
  }

  private static isUsageLimit(error: JsonReader): boolean {
    return error.hasField(Resources.codexErrorInfoField) && error.readValue(Resources.codexErrorInfoField) === Resources.codexUsageLimitExceeded;
  }

  private static isContextFull(error: JsonReader): boolean {
    return error.hasField(Resources.codexErrorInfoField) && error.readValue(Resources.codexErrorInfoField) === Resources.codexContextWindowExceeded;
  }

  private settle(outcome: TurnOutcome, error: string | null): void {
    if (this.isComplete)
      return;

    this.currentOutcome = outcome;
    this.currentError = error;
    this.completion.resolve();
  }

  private async askUser(params: JsonReader, signal: AbortSignal, subAgent: string | null): Promise<JsonValue> {
    const questions = await this.readQuestionsAsync(params);
    const answers = questions.length === 0 ? null
      : await this.listener.onQuestionsAsked(new QuestionAsk(this.nextRequestId(params.readString(Resources.itemIdField)), Resources.userInputRequest, questions,
        subAgent), signal).catch((error: unknown) => {
          if (Object.isNull(subAgent))
            return null;
          throw error;
        });

    return { [Resources.answersField]: Object.fromEntries((answers ?? []).map(t => [t.questionId, { [Resources.answersField]: CodexTurn.answerList(t, questions) }])) };
  }

  private static answerList(answer: QuestionAnswer, questions: readonly ApprovalQuestion[]): readonly string[] {
    if (Object.isNull(answer.text))
      return answer.choices;
    const isOther = answer.choices.length === 0 && questions.some(t => t.id === answer.questionId && t.options.length > 0);
    return [...answer.choices, ...(isOther ? [Resources.codexOtherLabel] : []), `${Resources.codexNotePrefix}${answer.text}`];
  }

  private async elicit(params: JsonReader, signal: AbortSignal, subAgent: string | null): Promise<JsonValue> {
    const server = params.readNonBlankString(Resources.serverNameField);
    const request = params.toJson();
    const meta = UsageValues.objectOf(request[Resources.acpMetaField]);
    const approval = meta?.[Resources.codexApprovalKindField] === Resources.codexToolCallApprovalKind ? meta : null;
    const fields = UsageValues.objectOf(request[Resources.acpRequestedSchemaField])?.[Resources.acpPropertiesField];
    if (Object.isNull(approval) || request[Resources.acpModeField] !== Resources.acpFormMode || JSON.stringify(fields) !== JSON.stringify({})) {
      await this.listener.onDetailAsync(new TurnDetail(DetailKind.Note, Resources.formatCodexElicitationUnshown(server), null, null));
      return { [Resources.acpActionField]: Resources.acpCancelAction };
    }
    const persist = approval[Resources.codexPersistField];
    const forSession = persist === Resources.codexPersistSession || (Array.isArray(persist) && persist.includes(Resources.codexPersistSession));
    const call = Object.isNull(subAgent) ? this.runningCall(server) : null;
    const message = params.readString(Resources.messageField);
    const decision = await this.listener.onApprovalRequested(new ApprovalAsk(
      this.nextRequestId(call ?? server),
      ApprovalKind.Tool,
      Resources.codexElicitationKind,
      message.slice(0, Resources.maximumSummaryLength),
      { server, message, tool: approval[Resources.codexToolTitleField] ?? null, arguments: approval[Resources.codexToolParamsField] ?? null,
        ...CodexTurn.askerOf(subAgent) },
      CodexTurn.decisions().filter(t => forSession || t.scope === ApprovalScope.Once)), signal);
    if (decision !== Resources.declineDecision)
      return { [Resources.acpActionField]: Resources.acpAcceptAction, [Resources.contentField]: {},
        [Resources.acpMetaField]: decision === Resources.acceptForSessionDecision ? { [Resources.codexPersistField]: Resources.codexPersistSession } : null };
    const asker = Object.isNull(subAgent) ? call ?? this.runningCall(server) : null;
    if (!Object.isNull(asker))
      this.declined.add(asker);
    return { [Resources.acpActionField]: Resources.acpDeclineAction };
  }

  private runningCall(server: string): string | null {
    const calls = [...this.toolCalls].filter(([, t]) => t === server).map(([t]) => t);
    return calls.length === 1 ? calls[0]! : null;
  }

  private async decide(params: JsonReader, ask: ApprovalAsk, signal: AbortSignal): Promise<string> {
    const decision = await this.listener.onApprovalRequested(ask, signal);
    if (decision === Resources.declineDecision)
      this.declined.add(params.readString(Resources.itemIdField));
    return decision;
  }

  private createCommandAsk(params: JsonReader, subAgent: string | null): ApprovalAsk {
    const command = params.hasField(Resources.commandField) ? params.readNullableString(Resources.commandField) : null;
    const cwd = params.hasField(Resources.cwdField) ? params.readValue(Resources.cwdField) : null;
    const reason = params.hasField(Resources.reasonField) ? params.readNullableString(Resources.reasonField) : null;
    const summary = `${Resources.runCommandPrefix}${command ?? Resources.unknownCommand}`.slice(0, Resources.maximumSummaryLength);

    return new ApprovalAsk(
      this.nextRequestId(params.readString(Resources.itemIdField)),
      ApprovalKind.Command,
      Resources.codexCommandKind,
      summary,
      { command, cwd, reason, ...CodexTurn.askerOf(subAgent) },
      CodexTurn.decisions());
  }

  private createFileChangeAsk(params: JsonReader, subAgent: string | null): ApprovalAsk {
    const reason = params.hasField(Resources.reasonField) ? params.readNullableString(Resources.reasonField) : null;
    const grantRoot = params.hasField(Resources.grantRootField) ? params.readNullableString(Resources.grantRootField) : null;
    const summary = Resources.formatFileChangeApproval(reason, grantRoot).slice(0, Resources.maximumSummaryLength);

    return new ApprovalAsk(
      this.nextRequestId(params.readString(Resources.itemIdField)),
      ApprovalKind.FileChange,
      Resources.codexFileChangeKind,
      summary,
      { reason, grantRoot, ...CodexTurn.askerOf(subAgent) },
      CodexTurn.decisions());
  }

  private async readQuestionsAsync(params: JsonReader): Promise<readonly ApprovalQuestion[]> {
    const questions = params.toJson()[Resources.questionsField];
    if (!Array.isArray(questions))
      return [];

    const read: ApprovalQuestion[] = [];
    for (const question of questions)
      try {
        read.push(this.itemReader.readQuestion(JsonReader.fromValue(question)));
      }
      catch (error) {
        if (!(error instanceof JsonException || error instanceof ArgumentException))
          throw error;
        await this.listener.onDetailAsync(new TurnDetail(DetailKind.Note, Resources.formatCodexQuestionUnread(FailureDescriber.describe(error)), null, null));
      }
    return read;
  }

  private async readPostedQuestionsAsync(item: JsonReader): Promise<readonly ApprovalQuestion[]> {
    const json = item.toJson();
    const questions = json[Resources.questionsField];
    if (json[Resources.typeField] !== Resources.agentMessageItemType || json[Resources.deliveryField] !== Resources.codexAsyncDelivery || !Array.isArray(questions))
      return [];

    const read: ApprovalQuestion[] = [];
    for (const [index, question] of questions.entries())
      try {
        read.push(this.itemReader.readPostedQuestion(JsonReader.fromValue(question), index));
      }
      catch (error) {
        if (!(error instanceof JsonException || error instanceof ArgumentException))
          throw error;
        await this.listener.onDetailAsync(new TurnDetail(DetailKind.Note, Resources.formatCodexPostedQuestionUnread(FailureDescriber.describe(error)), null, null));
      }
    return read;
  }

  private static askerOf(subAgent: string | null): JsonObject {
    return Object.isNull(subAgent) ? {} : { [Resources.subAgentField]: subAgent };
  }

  private nextRequestId(key: string): string {
    this.approvalCounter += 1;

    return [this.threadId, key, String(this.approvalCounter)].join(Resources.requestIdSeparator);
  }

  private static decisions(): readonly ApprovalOption[] {
    return [
      new ApprovalOption(Resources.acceptDecision, Resources.allowLabel, ApprovalOutcome.Approved, ApprovalScope.Once),
      new ApprovalOption(Resources.acceptForSessionDecision, Resources.allowForSessionLabel, ApprovalOutcome.Approved, ApprovalScope.Session),
      new ApprovalOption(Resources.declineDecision, Resources.denyLabel, ApprovalOutcome.Denied, ApprovalScope.Once)
    ];
  }
}
