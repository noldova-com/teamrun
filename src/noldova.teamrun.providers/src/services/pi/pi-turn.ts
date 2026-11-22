/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type JsonObject, JsonReader, type JsonValue } from "@noldova/context.json";
import { ApprovalAsk, type ITurnListener, QuestionAsk, TurnDetail, TurnOutcome } from "@noldova/teamrun.core";
import { ApprovalKind, ApprovalOption, ApprovalOutcome, ApprovalQuestion, ApprovalScope, ContextUsage, DetailKind, type QuestionAnswer, QuestionOption,
  ReplyUsage, Resources as ProtocolResources } from "@noldova/teamrun.protocol";

import { InvalidOperationException } from "../../exceptions/invalid-operation.exception.js";
import { Resources } from "../../resources.js";
import type { DeltaStream } from "../delta-stream.js";
import { FailureDescriber } from "../failure-describer.js";
import { UsageValues } from "../usage-values.js";

export class PiTurn {
  private readonly listener: ITurnListener;
  private readonly stream: DeltaStream;
  private readonly reply: (message: JsonObject) => void;
  private readonly approvedTools: readonly string[];
  private readonly settled: PromiseWithResolvers<void> = Promise.withResolvers<void>();
  private readonly approvals: Map<string, AbortController> = new Map();
  private readonly toolInputs: Map<string, JsonValue> = new Map();
  private messages: number = 0;
  private inputTokens: number = 0;
  private outputTokens: number = 0;
  private cacheReadTokens: number = 0;
  private cacheWriteTokens: number = 0;
  private cost: number = 0;
  private billed: boolean = false;
  private currentOutcome: TurnOutcome | null = null;
  private currentError: string | null = null;
  private work: Promise<void> = Promise.resolve();
  private failures: unknown[] = [];

  public constructor(listener: ITurnListener, stream: DeltaStream, reply: (message: JsonObject) => void, approvedTools: readonly string[] = []) {
    this.listener = listener;
    this.stream = stream;
    this.reply = reply;
    this.approvedTools = approvedTools;
  }

  public get outcome(): TurnOutcome | null {
    return this.currentOutcome;
  }

  public get settledOutcome(): TurnOutcome {
    if (Object.isNull(this.currentOutcome))
      throw new InvalidOperationException(Resources.turnNotSettled);
    return this.currentOutcome;
  }

  public get error(): string | null {
    return this.currentError;
  }

  public get hasUsage(): boolean {
    return this.billed;
  }

  public waitForSettled(): Promise<void> {
    return this.settled.promise;
  }

  public settle(outcome: TurnOutcome, error: string | null = null): void {
    this.enqueue(() => this.settleAsync(outcome, error));
  }

  public async drainAsync(): Promise<void> {
    let work: Promise<void>;
    do {
      work = this.work;
      await work;
    } while (work !== this.work);
    const failures = this.failures;
    this.failures = [];
    if (failures.length > 0)
      throw failures[0];
  }

  public finishAsync(): Promise<void> {
    this.enqueue(() => this.stream.flushAsync());
    return this.drainAsync();
  }

  public usage(context: ContextUsage | null): ReplyUsage {
    return new ReplyUsage(this.inputTokens, this.outputTokens, this.cost, context, this.cacheReadTokens, this.cacheWriteTokens, null);
  }

  public handle(event: JsonReader): Promise<void> {
    return this.queue(() => this.handleAsync(event));
  }

  private queue(work: () => Promise<void>): Promise<void> {
    const done = this.work.then(work);
    this.work = done.catch(() => undefined);
    return done;
  }

  private enqueue(work: () => Promise<void>): void {
    this.work = this.work.then(work).catch((error: unknown) => {
      this.failures.push(error);
    });
  }

  private async settleAsync(outcome: TurnOutcome, error: string | null): Promise<void> {
    if (!Object.isNull(this.currentOutcome))
      return;
    try {
      await this.stream.flushAsync();
    }
    finally {
      for (const controller of this.approvals.values())
        controller.abort();
      this.approvals.clear();
      this.currentOutcome = outcome;
      this.currentError = outcome === TurnOutcome.Failed ? error ?? Resources.piNoResult : null;
      this.settled.resolve();
    }
  }

  private async handleAsync(event: JsonReader): Promise<void> {
    try {
      await this.dispatchAsync(event);
    }
    catch (error) {
      await this.noteAsync(Resources.formatPiEventFailed(String(PiTurn.field(event, Resources.typeField)), FailureDescriber.describe(error)));
    }
  }

  private async dispatchAsync(event: JsonReader): Promise<void> {
    switch (PiTurn.field(event, Resources.typeField)) {
      case Resources.piMessageStartEvent:
        this.messages += 1;
        break;
      case Resources.piMessageUpdateEvent:
        this.handleUpdate(event.readObject(Resources.piAssistantMessageEventField));
        break;
      case Resources.piMessageEndEvent:
        await this.handleMessageEndAsync(event.readObject(Resources.messageField));
        break;
      case Resources.piToolStartEvent:
        await this.listener.onDetailAsync(this.toolDetail(event, false, null));
        break;
      case Resources.piToolEndEvent:
        await this.listener.onDetailAsync(this.toolDetail(event, true, event.hasField(Resources.resultField) ? event.readValue(Resources.resultField) : null));
        break;
      case Resources.piCompactionEndEvent:
        await this.noteCompactionAsync(event);
        break;
      case Resources.piRetryStartEvent:
        await this.noteAsync(Resources.formatPiRetrying(PiTurn.text(event, Resources.piErrorMessageField)));
        break;
      case Resources.piExtensionErrorEvent:
        await this.noteAsync(Resources.formatPiExtensionFailed(PiTurn.text(event, Resources.errorField)));
        break;
      case Resources.piExtensionRequestType:
        await this.handleExtensionRequestAsync(event);
        break;
      case Resources.piSettledEvent:
        await this.settleAsync(event.hasField(Resources.piAbortedField) && event.readValue(Resources.piAbortedField) === true ? TurnOutcome.Interrupted
          : Object.isNull(this.currentError) ? TurnOutcome.Completed : TurnOutcome.Failed, this.currentError);
        break;
    }
  }

  private handleUpdate(update: JsonReader): void {
    const kind = PiTurn.field(update, Resources.typeField);
    const index = PiTurn.field(update, Resources.piContentIndexField);
    const id = [Resources.piItemPrefix, String(this.messages), String(index)].join(Resources.requestIdSeparator);
    if (kind === Resources.piTextDelta)
      this.stream.append(id, DetailKind.Text, update.readString(Resources.deltaField));
    else if (kind === Resources.piThinkingDelta) {
      this.listener.onThinking();
      this.stream.append(id, DetailKind.Reasoning, update.readString(Resources.deltaField));
    }
  }

  private async handleMessageEndAsync(message: JsonReader): Promise<void> {
    await this.stream.flushAsync();
    if (PiTurn.field(message, Resources.roleField) !== Resources.piAssistantRole)
      return;
    this.currentError = PiTurn.field(message, Resources.piStopReasonField) === Resources.piErrorStopReason ? PiTurn.text(message, Resources.piErrorMessageField) : null;
    const usage = message.hasField(Resources.usageField) ? message.readNullableObject(Resources.usageField) : null;
    if (Object.isNull(usage))
      return;
    this.billed = true;
    this.inputTokens += PiTurn.count(usage, Resources.inputField);
    this.outputTokens += PiTurn.count(usage, Resources.outputField);
    this.cacheReadTokens += PiTurn.count(usage, Resources.piCacheReadField);
    this.cacheWriteTokens += PiTurn.count(usage, Resources.piCacheWriteField);
    const cost = usage.hasField(Resources.costField) ? usage.readNullableObject(Resources.costField) : null;
    this.cost += Object.isNull(cost) ? 0 : PiTurn.count(cost, Resources.totalField);
  }

  private async noteCompactionAsync(event: JsonReader): Promise<void> {
    if (PiTurn.field(event, Resources.piAbortedField) === true)
      return;
    if (!Object.isNull(PiTurn.field(event, Resources.resultField)))
      await this.noteAsync(Resources.piCompacted);
    else if (PiTurn.field(event, Resources.piCompactionReasonField) !== Resources.piManualCompaction)
      await this.noteAsync(Resources.formatPiCompactionFailed(PiTurn.text(event, Resources.piErrorMessageField)));
  }

  private async handleExtensionRequestAsync(event: JsonReader): Promise<void> {
    const id = event.readNonBlankString(Resources.idField);
    const method = PiTurn.field(event, Resources.methodField);
    if (method === Resources.piNotifyMethod) {
      await this.noteAsync(PiTurn.text(event, Resources.messageField));
      return;
    }
    if (!Resources.piDialogMethods.includes(String(method)))
      return;
    if (!Object.isNull(this.currentOutcome)) {
      this.reply({ type: Resources.piExtensionResponseType, id, ...method === Resources.piConfirmMethod ? { confirmed: false } : { cancelled: true } });
      return;
    }
    if (method !== Resources.piConfirmMethod || PiTurn.field(event, Resources.titleField) !== Resources.piApprovalTitle) {
      this.handleDialog(id, String(method), event);
      return;
    }
    let call: JsonReader;
    try {
      call = JsonReader.parse(event.readString(Resources.messageField), Resources.messageField);
    }
    catch {
      this.reply({ type: Resources.piExtensionResponseType, id, confirmed: false });
      return;
    }
    const tool = PiTurn.text(call, Resources.piToolNameField);
    if (this.approvedTools.some(t => Resources.formatPiMcpToolName(ProtocolResources.mcpServerName, t) === tool)) {
      this.reply({ type: Resources.piExtensionResponseType, id, confirmed: true });
      return;
    }
    void this.ask(id, call).catch((error: unknown) => {
      this.approvals.delete(id);
      this.reply({ type: Resources.piExtensionResponseType, id, confirmed: false });
      return this.queueNoteAsync(Resources.formatPiApprovalFailed(FailureDescriber.describe(error)));
    }).catch(() => undefined);
  }

  private async ask(id: string, call: JsonReader): Promise<void> {
    const tool = PiTurn.text(call, Resources.piToolNameField);
    const input = call.hasField(Resources.inputField) ? call.readValue(Resources.inputField) : null;
    const controller = new AbortController();
    this.approvals.set(id, controller);
    const ask = new ApprovalAsk(id, PiTurn.classify(tool), tool, PiTurn.summarize(tool, input), { tool, input }, [
      new ApprovalOption(Resources.piAllowDecision, Resources.allowLabel, ApprovalOutcome.Approved, ApprovalScope.Once),
      new ApprovalOption(Resources.piDenyDecision, Resources.denyLabel, ApprovalOutcome.Denied, ApprovalScope.Once)]);
    let decision: string;
    try {
      decision = await this.listener.onApprovalRequested(ask, controller.signal);
    }
    catch (error) {
      await this.queueNoteAsync(Resources.formatPiApprovalFailed(FailureDescriber.describe(error)));
      decision = Resources.piDenyDecision;
    }
    if (controller.signal.aborted)
      return;
    this.approvals.delete(id);
    this.reply({ type: Resources.piExtensionResponseType, id, confirmed: decision === Resources.piAllowDecision });
  }

  private handleDialog(id: string, method: string, event: JsonReader): void {
    const question = PiTurn.question(id, method, event);
    if (Object.isNull(question)) {
      this.reply({ type: Resources.piExtensionResponseType, id, cancelled: true });
      return;
    }
    void this.askQuestion(id, method, question, PiTurn.count(event, Resources.piTimeoutField)).catch((error: unknown) => {
      this.approvals.delete(id);
      this.reply({ type: Resources.piExtensionResponseType, id, cancelled: true });
      return this.queueNoteAsync(Resources.formatPiQuestionFailed(FailureDescriber.describe(error)));
    }).catch(() => undefined);
  }

  private async askQuestion(id: string, method: string, question: ApprovalQuestion, timeout: number): Promise<void> {
    const controller = new AbortController();
    this.approvals.set(id, controller);
    const timer = timeout > 0 ? setTimeout(() => controller.abort(), Math.max(timeout - Resources.piDialogTimeoutMargin, 0)) : null;
    let answers: readonly QuestionAnswer[] | null;
    try {
      answers = await this.listener.onQuestionsAsked(new QuestionAsk(id, method, [question]), controller.signal);
    }
    catch (error) {
      if (!controller.signal.aborted)
        throw error;
      answers = null;
    }
    finally {
      if (!Object.isNull(timer))
        clearTimeout(timer);
    }
    if (this.approvals.get(id) !== controller)
      return;
    this.approvals.delete(id);
    if (controller.signal.aborted) {
      await this.queueNoteAsync(Resources.formatPiDialogTimedOut(question.header, question.text));
      return;
    }
    this.reply({ type: Resources.piExtensionResponseType, id, ...PiTurn.answerOf(method, answers?.[0] ?? null) });
  }

  private toolDetail(event: JsonReader, isEnd: boolean, result: JsonValue): TurnDetail {
    const tool = PiTurn.text(event, Resources.piToolNameField);
    const toolCallId = event.readNonBlankString(Resources.piToolCallIdField);
    const input = event.hasField(Resources.piArgsField) ? event.readValue(Resources.piArgsField) : this.toolInputs.get(toolCallId) ?? null;
    if (isEnd)
      this.toolInputs.delete(toolCallId);
    else
      this.toolInputs.set(toolCallId, input);
    const kind = PiTurn.classify(tool);
    const detailKind = kind === ApprovalKind.Command ? DetailKind.Command : kind === ApprovalKind.FileChange ? DetailKind.FileChange : DetailKind.Note;
    const ended = Object.isNull(result) ? {} : { output: PiTurn.outputOf(result), isError: event.hasField(Resources.piIsErrorField)
      && event.readValue(Resources.piIsErrorField) === true };
    return new TurnDetail(detailKind, PiTurn.summarize(tool, input), { tool, input, toolUseId: toolCallId, ...ended }, toolCallId);
  }

  private noteAsync(text: string): Promise<void> {
    return this.listener.onDetailAsync(new TurnDetail(DetailKind.Note, text, null, null));
  }

  private queueNoteAsync(text: string): Promise<void> {
    return this.queue(() => this.noteAsync(text));
  }

  private static question(id: string, method: string, event: JsonReader): ApprovalQuestion | null {
    const title = PiTurn.text(event, Resources.titleField).trim();
    const message = PiTurn.text(event, Resources.messageField).trim();
    const options = PiTurn.field(event, Resources.optionsField);
    try {
      if (method === Resources.piSelectMethod)
        return new ApprovalQuestion(id, String.empty, title, [...new Set((Array.isArray(options) ? options : []).filter(t => Object.isString(t)
          && !String.isNullOrWhitespace(t)))].map(t => new QuestionOption(String(t), String.empty)), false, false, false);
      if (method === Resources.piConfirmMethod)
        return new ApprovalQuestion(id, String.isNullOrWhitespace(message) ? String.empty : title, String.isNullOrWhitespace(message) ? title : message,
          [new QuestionOption(Resources.yesLabel, String.empty), new QuestionOption(Resources.noLabel, String.empty)], false, false, false);
      return new ApprovalQuestion(id, String.empty, title, [], false, true, false);
    }
    catch {
      return null;
    }
  }

  private static answerOf(method: string, answer: QuestionAnswer | null): JsonObject {
    if (Object.isNull(answer))
      return { cancelled: true };
    if (method === Resources.piConfirmMethod)
      return { confirmed: answer.choices[0] === Resources.yesLabel };
    const value = method === Resources.piSelectMethod ? answer.choices[0] ?? null : answer.text;
    return Object.isNull(value) ? { cancelled: true } : { value };
  }

  private static outputOf(result: JsonValue): string {
    const content = UsageValues.fieldOf(result, Resources.contentField);
    const text = Array.isArray(content) ? content.map(t => UsageValues.fieldOf(t, Resources.textField)).map(t => Object.isString(t) ? t : String.empty)
      .join(Resources.lineSeparator) : String.empty;
    return text.slice(0, Resources.maximumToolOutputLength);
  }

  private static classify(tool: string): ApprovalKind {
    if (Resources.piCommandTools.includes(tool))
      return ApprovalKind.Command;
    return Resources.piFileTools.includes(tool) ? ApprovalKind.FileChange : ApprovalKind.Tool;
  }

  private static summarize(tool: string, input: JsonValue): string {
    const target = [Resources.piCommandField, Resources.pathField].map(t => UsageValues.fieldOf(input, t)).find(t => Object.isString(t));
    return Object.isUndefined(target) ? tool : Resources.formatToolWithCommand(tool, String(target).slice(0, Resources.maximumSummaryLength));
  }

  private static field(reader: JsonReader, name: string): JsonValue {
    return reader.hasField(name) ? reader.readValue(name) : null;
  }

  private static text(reader: JsonReader, name: string): string {
    const value = PiTurn.field(reader, name);
    return Object.isString(value) ? value : String.empty;
  }

  private static count(reader: JsonReader, name: string): number {
    const value = PiTurn.field(reader, name);
    return Object.isNumber(value) && Number.isFinite(value) ? value : 0;
  }
}
