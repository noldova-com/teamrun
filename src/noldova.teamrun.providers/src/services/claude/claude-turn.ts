/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {
  FastModeDisabledReason,
  FastModeState,
  PermissionResult,
  SDKAssistantMessage,
  SDKMessage,
  SDKPartialAssistantMessage,
  SDKRateLimitInfo,
  SDKResultMessage,
  SDKSystemMessage,
  SDKUserMessage,
  SDKUserMessageReplay
} from "@anthropic-ai/claude-agent-sdk";
import type { BetaContentBlock } from "@anthropic-ai/sdk/resources/beta/messages/messages.mjs";
import type { ContentBlockParam, ToolResultBlockParam } from "@anthropic-ai/sdk/resources";

import "@noldova/context.core";
import { type JsonObject, JsonReader, type JsonValue } from "@noldova/context.json";
import { ApprovalAsk, type ITurnListener, QuestionAsk, TimeoutException, TurnDetail, TurnOutcome, TurnResult, TurnStart, UsageLimit } from "@noldova/teamrun.core";
import { ApprovalKind, ApprovalOption, ApprovalOutcome, ApprovalScope, type ContextUsage, DetailKind, ObservedSettings, type PlanWindow, ReplyUsage }
  from "@noldova/teamrun.protocol";
import { ApprovalQuestion, type QuestionAnswer, QuestionOption, Resources as ProtocolResources } from "@noldova/teamrun.protocol";

import { ShellDialect } from "../../enums/shell-dialect.js";
import { TerminalToolCall } from "../../models/terminal-tool-call.js";
import { TerminalToolResult } from "../../models/terminal-tool-result.js";
import type { IClaudeQuery } from "../../interfaces/i-claude-query.js";
import { Resources } from "../../resources.js";
import type { RoleApplication } from "@noldova/teamrun.protocol";
import { CommandOutputDecoder } from "../command-output-decoder.js";
import { CommandTitleReader } from "../command-title.reader.js";
import type { IClaudeSubAgent } from "../../interfaces/i-claude-sub-agent.js";
import { ClaudePlan } from "./claude-plan.js";
import { ClaudeSubAgents } from "./claude-sub-agents.js";
import { ClaudeTasks } from "./claude-tasks.js";
import { ClaudeUsageReader } from "./claude-usage.reader.js";
import type { DeltaStream } from "../delta-stream.js";
import { FailureDescriber } from "../failure-describer.js";
import { TerminalToolReader } from "../terminal-tool.reader.js";
import { WriteTargetReader } from "../write-target.reader.js";

export class ClaudeTurn {
  private static readonly noReplyUsage: ReplyUsage = new ReplyUsage(null, null, null, null);

  private readonly listener: ITurnListener;
  private readonly resumeNativeSessionId: string | null;
  private currentSessionId: string | null = null;
  private lastEntryId: string | null = null;
  private currentObserved: ObservedSettings = new ObservedSettings(Resources.claudeKindId, null, null, null);
  private currentOutcome: TurnOutcome | null = null;
  private currentError: string | null = null;
  private rejected: UsageLimit | null = null;
  private limit: UsageLimit | null = null;
  private interrupted: boolean = false;
  private started: boolean = false;
  private billed: boolean = false;
  private approvalCounter: number = 0;
  private readonly stream: DeltaStream;
  private readonly streamBlockIds: Map<number, string> = new Map();
  private readonly denied: Set<string> = new Set();
  private readonly allowed: Set<string> = new Set();
  private readonly terminalCalls: Map<string, TerminalToolCall> = new Map();
  private streamOrdinal: number = 0;
  private deliveredBlocks: number = 0;
  private readonly roleApplied: RoleApplication | null;
  private readonly requestTimeout: number;
  private readonly tasks: ClaudeTasks;
  private readonly plan: ClaudePlan;
  private readonly subAgents: ClaudeSubAgents;
  private readonly leavePlan: (() => Promise<void>) | null;
  private leaving: Promise<void> = Promise.resolve();
  private planned: { readonly windows: readonly PlanWindow[]; readonly readAt: string } | null = null;
  private readonly notes: string[] = [];
  private readonly chosenWindow: number | null;
  private reportedWindow: number | null = null;
  private compactable: boolean = false;

  public constructor(listener: ITurnListener, resumeNativeSessionId: string | null, stream: DeltaStream, roleApplied: RoleApplication | null = null,
    tasks: ClaudeTasks = new ClaudeTasks(), requestTimeout: number = Resources.claudeUsageTimeout, plan: ClaudePlan = new ClaudePlan(),
    subAgents: ClaudeSubAgents = new ClaudeSubAgents(), leavePlan: (() => Promise<void>) | null = null, chosenWindow: number | null = null) {
    this.listener = listener;
    this.resumeNativeSessionId = resumeNativeSessionId;
    this.stream = stream;
    this.roleApplied = roleApplied;
    this.tasks = tasks;
    this.requestTimeout = requestTimeout;
    this.plan = plan;
    this.subAgents = subAgents;
    this.leavePlan = leavePlan;
    this.chosenWindow = chosenWindow;
  }

  public get turnListener(): ITurnListener {
    return this.listener;
  }

  public get sessionId(): string | null {
    return this.currentSessionId;
  }

  public get observed(): ObservedSettings {
    return this.currentObserved;
  }

  public get outcome(): TurnOutcome | null {
    return this.currentOutcome;
  }

  public get isInterrupted(): boolean {
    return this.interrupted;
  }

  public get modelWindow(): number | null {
    return this.reportedWindow;
  }

  public get compactsWhenIdle(): boolean {
    return this.compactable;
  }

  public get hasStarted(): boolean {
    return this.started;
  }

  public get error(): string | null {
    return this.currentError;
  }

  public async finishAsync(): Promise<void> {
    await this.stream.flushAsync();
    await this.leaving;
    await this.deliverNotesAsync();
    this.settle(TurnOutcome.Failed, Resources.claudeNoResult);
  }

  public async deliverNotesAsync(): Promise<void> {
    const planned = this.planned;
    this.planned = null;
    if (!Object.isNull(planned))
      try {
        await this.listener.onPlanUsageAsync(planned.windows, planned.readAt);
      }
      catch { }
    for (let note = this.notes.shift(); !Object.isUndefined(note); note = this.notes.shift())
      await this.listener.onDetailAsync(new TurnDetail(DetailKind.Note, note, null, null));
  }

  public markInterrupted(): void {
    this.interrupted = true;
  }

  public fail(error: string): void {
    this.settle(TurnOutcome.Failed, error);
  }

  public async endUnsentAsync(note: string | null): Promise<void> {
    this.currentSessionId ??= this.resumeNativeSessionId;
    if (Object.isNull(note))
      this.interrupted = true;
    else
      await this.listener.onDetailAsync(new TurnDetail(DetailKind.Note, note, null, null));
    this.settle(this.interrupted ? TurnOutcome.Interrupted : TurnOutcome.Completed, null);
  }

  public async endWithAsync(note: string): Promise<void> {
    await this.listener.onDetailAsync(new TurnDetail(DetailKind.Note, note, null, null));
    this.settle(this.interrupted ? TurnOutcome.Interrupted : TurnOutcome.Completed, null);
  }

  public async decide(toolName: string, input: Record<string, unknown>, signal: AbortSignal, toolUseId: string, subAgent: string | null = null,
    resultsIn: ClaudeTurn | null = null): Promise<PermissionResult> {
    const payload = JsonReader.toJsonValue(input, Resources.toolInputPath);
    this.approvalCounter += 1;
    const requestId = [this.currentSessionId ?? Resources.pendingSessionId, String(this.approvalCounter)].join(Resources.requestIdSeparator);
    if (toolName === Resources.claudeAskUserQuestionTool)
      return this.ask(requestId, input, payload, signal, subAgent);
    if (ClaudePlan.isPlanTool(toolName))
      return { behavior: Resources.allowBehavior, updatedInput: input };
    const summary = ClaudeTurn.summarize(toolName, payload);
    const ask = new ApprovalAsk(requestId, ClaudeTurn.classify(toolName), toolName, summary,
      { tool: toolName, input: payload, ...Object.isNull(subAgent) ? {} : { [Resources.subAgentField]: subAgent } }, ClaudeTurn.decisions());
    const decision = await this.listener.onApprovalRequested(ask, signal);
    if (decision === Resources.claudeAllowDecision) {
      (resultsIn ?? this).allowed.add(toolUseId);
      return { behavior: Resources.allowBehavior, updatedInput: input };
    }
    if (decision === Resources.claudeDenyDecision)
      (resultsIn ?? this).denied.add(toolUseId);

    return { behavior: Resources.denyBehavior, message: Resources.claudeDenied };
  }

  public toResult(): TurnResult {
    const outcome = this.currentOutcome ?? TurnOutcome.Failed;
    const error = outcome === TurnOutcome.Failed ? this.currentError ?? Resources.claudeNoResult : null;

    return new TurnResult(outcome, this.currentSessionId, this.currentObserved, error, this.lastEntryId, null, outcome === TurnOutcome.Failed ? this.limit : null);
  }

  public async handle(message: SDKMessage, query: IClaudeQuery): Promise<void> {
    await this.deliverNotesAsync();
    if (message.type === Resources.systemMessageType) {
      if (message.subtype === Resources.initSubtype)
        await this.handleInit(message, query);
      else if (message.subtype === Resources.thinkingTokensSubtype)
        this.listener.onThinking();
      else if (message.subtype === Resources.compactBoundarySubtype) {
        await this.stream.flushAsync();
        await this.listener.onDetailAsync(new TurnDetail(DetailKind.Note, Resources.formatContextCompacted(Resources.claudeDisplayName), Resources.compactionPayload,
          message.uuid));
      }
      return;
    }
    if (message.type === Resources.streamEventType) {
      this.handleStreamEvent(message);
      return;
    }
    if (message.type === Resources.rateLimitEventType) {
      this.rejected = ClaudeTurn.limitOf(message.rate_limit_info);
      return;
    }
    await this.stream.flushAsync();
    if ((message.type === Resources.assistantMessageType || message.type === Resources.userMessageType) && Object.isNull(message.parent_tool_use_id)
      && !Object.isUndefined(message.uuid))
      this.lastEntryId = message.uuid;
    if (message.type === Resources.assistantMessageType)
      await this.handleAssistantAsync(message);
    else if (message.type === Resources.userMessageType)
      await this.handleUserAsync(message);
    else if (message.type === Resources.resultMessageType)
      await this.handleResult(message, query);
  }

  private handleStreamEvent(message: SDKPartialAssistantMessage): void {
    if (!Object.isNull(message.parent_tool_use_id))
      return;

    const event = message.event;
    if (event.type === Resources.messageStartEventType) {
      this.streamOrdinal += 1;
      this.streamBlockIds.clear();
      this.deliveredBlocks = 0;
      return;
    }
    if (event.type !== Resources.contentBlockDeltaEventType)
      return;

    const separator = Resources.requestIdSeparator;
    const id = `${message.session_id}${separator}${Resources.streamIdPrefix}${this.streamOrdinal}${separator}${event.index}`;
    if (event.delta.type === Resources.textDeltaType) {
      this.streamBlockIds.set(event.index, id);
      this.stream.append(id, DetailKind.Text, event.delta.text);
    }
    else if (event.delta.type === Resources.thinkingDeltaType) {
      this.streamBlockIds.set(event.index, id);
      this.stream.append(id, DetailKind.Reasoning, event.delta.thinking);
    }
  }

  private async handleInit(message: SDKSystemMessage, query: IClaudeQuery): Promise<void> {
    if (this.started)
      return;
    this.started = true;
    this.currentSessionId = message.session_id;
    this.billed = message.apiKeySource !== Resources.claudeApiKeySourceNone;
    this.currentObserved = new ObservedSettings(Resources.claudeKindId, message.model, message.effort ?? null, message.claude_code_version, false,
      ClaudeTurn.speedOf(message), ClaudeTurn.speedUnavailableOf(message));
    await this.listener.onStartedAsync(new TurnStart(message.session_id, message.session_id === this.resumeNativeSessionId, this.roleApplied));
    await this.listener.onObservedAsync(this.currentObserved);
    if (Object.isNullOrUndefined(message.effort))
      await this.readEffort(query);
    this.readPlan(query);
  }

  private readPlan(query: IClaudeQuery): void {
    const readAt = new Date().toISOString();
    void Promise.resolve()
      .then(() => query.usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET({ skipBehaviors: true }))
      .then(response => {
        const windows = ClaudeUsageReader.readPlan(response);
        if (!Object.isNull(windows))
          this.planned = { windows, readAt };
      })
      .catch(() => undefined);
  }

  private async readEffort(query: IClaudeQuery): Promise<void> {
    const effort = await Promise.resolve().then(() => query.getSettings()).then(t => t.applied?.effort, () => null);
    if (typeof effort !== "string")
      return;
    const observed = this.currentObserved;
    this.currentObserved = new ObservedSettings(observed.kind, observed.model, effort, observed.harnessVersion, observed.unavailableModel,
      observed.speed, observed.speedUnavailable);
    await this.listener.onObservedAsync(this.currentObserved);
  }

  private async handleAssistantAsync(message: SDKAssistantMessage): Promise<void> {
    if (!Object.isNull(message.parent_tool_use_id)) {
      await this.handleNestedAsync(message, message.parent_tool_use_id);
      return;
    }
    if (message.error === Resources.rateLimitAssistantError && !Object.isNull(this.rejected))
      this.limit = this.rejected;

    for (const [index, block] of message.message.content.entries()) {
      const position = this.deliveredBlocks + index;
      const streamed = this.streamBlockIds.get(position);
      await this.handleBlockAsync(block, streamed ?? `${message.uuid}${Resources.requestIdSeparator}${index}`);
      if (!Object.isUndefined(streamed)) {
        this.stream.forget(streamed);
        this.streamBlockIds.delete(position);
      }
    }
    this.deliveredBlocks += message.message.content.length;
    if (message.message.model !== this.currentObserved.model) {
      const observed = this.currentObserved;
      this.currentObserved = new ObservedSettings(observed.kind, message.message.model, observed.effort, observed.harnessVersion,
        observed.unavailableModel, observed.speed, observed.speedUnavailable);
      await this.listener.onObservedAsync(this.currentObserved);
    }
  }

  private async handleNestedAsync(message: SDKAssistantMessage, parentToolUseId: string): Promise<void> {
    const parent = this.subAgents.of(parentToolUseId);
    if (Object.isUndefined(parent))
      return;
    await this.subAgents.noteModelAsync(parentToolUseId, message.message.model);
    for (const [index, block] of message.message.content.entries())
      await this.handleBlockAsync(block, `${message.uuid}${Resources.requestIdSeparator}${index}`, parent);
  }

  private async handleBlockAsync(block: BetaContentBlock, id: string, parent: IClaudeSubAgent | null = null): Promise<void> {
    if (block.type === Resources.textBlockType) {
      if (!String.isNullOrWhitespace(block.text))
        await this.listener.onDetailAsync(new TurnDetail(Object.isNull(parent) ? DetailKind.Text : DetailKind.Note, block.text, null, id, parent?.itemId ?? null));
      return;
    }
    if (block.type === Resources.thinkingBlockType) {
      if (Object.isNull(parent) && !String.isNullOrWhitespace(block.thinking))
        await this.listener.onDetailAsync(new TurnDetail(DetailKind.Reasoning, block.thinking.slice(0, Resources.maximumReasoningLength), null, id));
      return;
    }
    if (block.type === Resources.toolUseBlockType && ClaudePlan.tracks(block.name)) {
      await this.reportPlanAsync((parent?.plan ?? this.plan).noteToolUse(block.name, block.id, block.input), parent);
      return;
    }
    if (block.type === Resources.toolUseBlockType && ClaudeSubAgents.isAgentTool(block.name)) {
      await this.subAgents.startAsync(block.id, id, block.input, this, parent?.itemId ?? null);
      return;
    }
    if (block.type === Resources.toolUseBlockType) {
      const input = JsonReader.toJsonValue(block.input, Resources.toolInputPath);
      const parentItemId = parent?.itemId ?? null;
      const terminalTool = ClaudeTurn.terminalStepOf(block.name);
      if (!Object.isNull(terminalTool)) {
        this.terminalCalls.set(block.id, new TerminalToolCall(terminalTool, input, id, parentItemId));
        await this.listener.onDetailAsync(TerminalToolReader.read(terminalTool, input, null, { toolUseId: block.id }, id, parentItemId));
        return;
      }
      const kind = ClaudeTurn.classify(block.name) === ApprovalKind.Tool ? DetailKind.Note : ClaudeTurn.toDetailKind(block.name);
      const command = ClaudeTurn.commandOf(block.name, input);
      if (!Object.isNull(command))
        this.tasks.noteCommand(block.id, command);
      const title = Object.isNull(command) ? null : ClaudeTurn.titleOf(block.name, input, command);
      const writes = Object.isNull(command) ? null : WriteTargetReader.targetsOf(command, ClaudeTurn.dialectOf(block.name));
      const served = ClaudeTurn.servedToolOf(block.name);
      const payload = { tool: block.name, input, toolUseId: block.id, ...(Object.isNull(title) ? {} : { [Resources.titleField]: title }),
        ...(Object.isNull(writes) ? {} : writes.toJson()),
        ...(Object.isNull(served) ? {} : { [ProtocolResources.servedToolField]: served, [ProtocolResources.servedInputField]: input }) };
      await this.listener.onDetailAsync(new TurnDetail(kind, ClaudeTurn.summarize(block.name, input), payload, id, parentItemId));
    }
  }

  private async handleUserAsync(message: SDKUserMessage | SDKUserMessageReplay): Promise<void> {
    const parent = Object.isNull(message.parent_tool_use_id) ? null : this.subAgents.of(message.parent_tool_use_id);
    if (Object.isUndefined(parent))
      return;

    const content = message.message.content;
    if (Object.isString(content))
      return;

    for (const [index, block] of content.entries())
      await this.handleUserBlockAsync(block, Object.isUndefined(message.uuid) ? null : `${message.uuid}${Resources.requestIdSeparator}${index}`,
        message.tool_use_result, parent);
  }

  private async handleUserBlockAsync(block: ContentBlockParam, id: string | null, structured: unknown, parent: IClaudeSubAgent | null): Promise<void> {
    if (block.type !== Resources.toolResultBlockType)
      return;
    const plan = parent?.plan ?? this.plan;
    if (plan.owns(block.tool_use_id)) {
      const allowed = this.allowed.has(block.tool_use_id);
      const detail = plan.noteResult(block.tool_use_id, block.is_error ?? false, structured, this.denied.has(block.tool_use_id), allowed);
      await this.reportPlanAsync(detail, parent);
      if (allowed && !Object.isNull(detail) && Object.isNull(parent))
        this.leavePlanMode();
      return;
    }

    const call = this.terminalCalls.get(block.tool_use_id);
    if (!Object.isUndefined(call)) {
      this.terminalCalls.delete(block.tool_use_id);
      const ended = new TerminalToolResult(ClaudeTurn.structuredContentOf(structured), CommandOutputDecoder.decode(ClaudeTurn.readToolResult(block)),
        block.is_error ?? false);
      await this.listener.onDetailAsync(TerminalToolReader.read(call.tool, call.input, ended, { toolUseId: block.tool_use_id,
        ...this.denied.has(block.tool_use_id) ? { [Resources.deniedField]: true } : {} }, call.itemId, call.parentItemId));
      return;
    }

    const result = ClaudeTurn.readToolResult(block);
    await this.subAgents.noteResultAsync(block.tool_use_id, block.is_error ?? false, structured, this.interrupted, result);
    this.tasks.noteResult(block.tool_use_id, result);
    const text = CommandOutputDecoder.decode(result).slice(0, Resources.maximumToolResultLength);
    await this.listener.onDetailAsync(new TurnDetail(DetailKind.Note, String.isNullOrWhitespace(text) ? String.empty : text, { toolUseId: block.tool_use_id, isError: block.is_error ?? false,
      ...this.denied.has(block.tool_use_id) ? { [Resources.deniedField]: true } : {} }, id, parent?.itemId ?? null));
  }

  private async reportPlanAsync(plan: TurnDetail | null, parent: IClaudeSubAgent | null = null): Promise<void> {
    if (Object.isNull(plan))
      return;
    await this.listener.onDetailAsync(Object.isNull(parent) ? plan
      : new TurnDetail(plan.kind, plan.text, plan.payload, [plan.providerItemId, parent.itemId].join(Resources.requestIdSeparator), parent.itemId));
  }

  private leavePlanMode(): void {
    if (Object.isNull(this.leavePlan))
      return;
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new TimeoutException(Resources.formatClaudePlanModeTimedOut(this.requestTimeout))), this.requestTimeout);
    });
    this.leaving = Promise.race([this.leavePlan(), timeout]).then(() => undefined, (error: unknown) => {
      this.notes.push(Resources.formatClaudePlanModeKept(FailureDescriber.describe(error)));
    }).finally(() => clearTimeout(timer));
  }

  private async handleResult(message: SDKResultMessage, query: IClaudeQuery): Promise<void> {
    await this.leaving;
    await this.deliverNotesAsync();
    this.settleResult(message);
    await this.observeSpeedAsync(message);
    this.reportedWindow = ClaudeUsageReader.readWindow(message, this.currentObserved.model);
    const reply = ClaudeUsageReader.readReply(message, this.billed);
    const context = await this.readContext(query);
    this.compactable = !Object.isNull(context) && context.usedTokens >= Resources.idleCompactionTokens && ClaudeUsageReader.readsHourCache(message);
    const reported = Object.isNull(context) ? reply : (reply ?? ClaudeTurn.noReplyUsage).merge(new ReplyUsage(null, null, null, context));
    if (!Object.isNull(reported))
      await this.listener.onUsageAsync(reported);
  }

  private async readContext(query: IClaudeQuery): Promise<ContextUsage | null> {
    let timer: NodeJS.Timeout | undefined;
    try {
      const timeout = new Promise<null>(resolve => {
        timer = setTimeout(() => resolve(null), this.requestTimeout);
      });
      return ClaudeUsageReader.readContext(await Promise.race([query.getContextUsage({ detail: Resources.claudeContextDetail }), timeout]),
        this.chosenWindow);
    }
    catch {
      return null;
    }
    finally {
      clearTimeout(timer);
    }
  }

  private static limitOf(info: SDKRateLimitInfo): UsageLimit | null {
    if (info.status !== Resources.rejectedRateLimitStatus || Resources.allowedRateLimitStatuses.includes(info.overageStatus ?? String.empty))
      return null;
    return new UsageLimit(Object.isUndefined(info.resetsAt) ? null : new Date(info.resetsAt * Resources.millisecondsPerSecond).toISOString());
  }

  private async observeSpeedAsync(message: SDKResultMessage): Promise<void> {
    if (Object.isUndefined(message.fast_mode_state))
      return;
    const observed = this.currentObserved;
    this.currentObserved = new ObservedSettings(observed.kind, observed.model, observed.effort, observed.harnessVersion, observed.unavailableModel,
      ClaudeTurn.speedOf(message), ClaudeTurn.speedUnavailableOf(message));
    await this.listener.onObservedAsync(this.currentObserved);
  }

  private static speedOf(message: { fast_mode_state?: FastModeState }): string | null {
    return message.fast_mode_state === Resources.claudeFastModeOn ? Resources.claudeFastSpeed : null;
  }

  private static speedUnavailableOf(message: { fast_mode_state?: FastModeState; fast_mode_disabled_reason?: FastModeDisabledReason }): string | null {
    return message.fast_mode_state === Resources.claudeFastModeCooldown ? message.fast_mode_state : message.fast_mode_disabled_reason ?? null;
  }

  private settleResult(message: SDKResultMessage): void {
    this.currentSessionId = message.session_id;
    if (message.terminal_reason === Resources.promptTooLongReason) {
      this.settle(TurnOutcome.Failed, Resources.formatContextFull(Resources.claudeDisplayName));
      return;
    }
    if (!Object.isNull(this.limit)) {
      this.settle(TurnOutcome.Failed, Resources.formatUsageLimitReached(Resources.claudeDisplayName));
      return;
    }
    if (message.subtype === Resources.successSubtype) {
      this.settle(TurnOutcome.Completed, null);
      return;
    }

    this.settle(TurnOutcome.Failed, Resources.formatClaudeFailure(message.subtype, message.errors));
  }

  private settle(outcome: TurnOutcome, error: string | null): void {
    if (!Object.isNull(this.currentOutcome))
      return;
    if (outcome === TurnOutcome.Failed && this.interrupted) {
      this.currentOutcome = TurnOutcome.Interrupted;
      return;
    }

    this.currentOutcome = outcome;
    this.currentError = error;
  }

  private async ask(requestId: string, input: Record<string, unknown>, payload: JsonValue, signal: AbortSignal, subAgent: string | null): Promise<PermissionResult> {
    const questions = ClaudeTurn.readQuestions(payload);
    if (Object.isNull(questions))
      return { behavior: Resources.denyBehavior, message: Resources.claudeQuestionsUnreadable };
    let answers: readonly QuestionAnswer[] | null;
    try {
      answers = await this.listener.onQuestionsAsked(new QuestionAsk(requestId, Resources.claudeAskUserQuestionTool, questions, subAgent), signal);
    }
    catch {
      return { behavior: Resources.denyBehavior, message: Resources.claudeQuestionsUnanswered };
    }
    if (Object.isNull(answers))
      return { behavior: Resources.denyBehavior, message: Resources.claudeQuestionsSkipped };

    const answered = answers.map(t => [t.questionId, [...t.choices, ...(Object.isNull(t.text) ? [] : [t.text])].join(Resources.claudeAnswerSeparator)]);
    return { behavior: Resources.allowBehavior, updatedInput: { ...input, [Resources.answersField]: Object.fromEntries(answered) } };
  }

  private static readToolResult(block: ToolResultBlockParam): string {
    const content = block.content;
    if (Object.isUndefined(content))
      return String.empty;
    if (Object.isString(content))
      return content;

    return content.map(t => t.type === Resources.textBlockType ? t.text : String.empty).join(Resources.lineSeparator);
  }

  private static terminalStepOf(toolName: string): string | null {
    const tool = ClaudeTurn.servedToolOf(toolName);
    return !Object.isNull(tool) && TerminalToolReader.isStepTool(tool) ? tool : null;
  }

  private static servedToolOf(toolName: string): string | null {
    const prefix = `${Resources.claudeMcpToolKind}${Resources.claudeMcpNameSeparator}${ProtocolResources.mcpServerName}${Resources.claudeMcpNameSeparator}`;
    return toolName.startsWith(prefix) ? toolName.slice(prefix.length) : null;
  }

  private static structuredContentOf(structured: unknown): JsonObject | null {
    const content = Object.isObject(structured) && !Array.isArray(structured)
      ? (structured as Readonly<Record<string, unknown>>)[Resources.structuredContentField] : undefined;
    return Object.isObject(content) && !Array.isArray(content) ? JsonReader.toJsonValue(content, Resources.claudeStructuredContentPath) as JsonObject : null;
  }

  private static classify(toolName: string): ApprovalKind {
    if (Resources.claudeCommandTools.includes(toolName))
      return ApprovalKind.Command;

    return Resources.claudeEditToolPattern.test(toolName) ? ApprovalKind.FileChange : ApprovalKind.Tool;
  }

  private static commandOf(toolName: string, input: JsonValue): string | null {
    if (ClaudeTurn.classify(toolName) !== ApprovalKind.Command || !Object.isObject(input) || Array.isArray(input))
      return null;
    const reader = JsonReader.fromValue(input, Resources.toolInputPath);
    const command = reader.hasField(Resources.claudeInputCommandKey) ? reader.readValue(Resources.claudeInputCommandKey) : null;
    return Object.isString(command) && !String.isNullOrWhitespace(command) ? command : null;
  }

  private static titleOf(toolName: string, input: JsonValue, command: string): string | null {
    const reader = JsonReader.fromValue(input, Resources.toolInputPath);
    const description = reader.hasField(Resources.claudeInputDescriptionKey) ? reader.readValue(Resources.claudeInputDescriptionKey) : null;
    if (Object.isString(description) && !String.isNullOrWhitespace(description))
      return description.trim();
    return CommandTitleReader.titleOf(command, ClaudeTurn.dialectOf(toolName));
  }

  private static dialectOf(toolName: string): ShellDialect {
    return toolName === Resources.claudePowerShellTool ? ShellDialect.PowerShell : ShellDialect.Posix;
  }

  private static toDetailKind(toolName: string): DetailKind {
    return ClaudeTurn.classify(toolName) === ApprovalKind.Command ? DetailKind.Command : DetailKind.FileChange;
  }

  private static summarize(toolName: string, input: JsonValue): string {
    if (!Object.isObject(input) || Array.isArray(input))
      return toolName;

    const reader = JsonReader.fromValue(input, Resources.toolInputPath);
    const command = reader.hasField(Resources.claudeInputCommandKey) ? reader.readValue(Resources.claudeInputCommandKey) : null;
    if (Object.isString(command))
      return Resources.formatToolWithCommand(toolName, command.slice(0, Resources.maximumSummaryLength));

    for (const key of Resources.claudeInputPathKeys) {
      const path = reader.hasField(key) ? reader.readValue(key) : null;
      if (Object.isString(path))
        return Resources.formatToolWithCommand(toolName, path);
    }

    const keys = Object.keys(input).slice(0, Resources.maximumInputKeys).join(Resources.listSeparator);
    return keys.length === 0 ? toolName : Resources.formatToolWithKeys(toolName, keys);
  }

  private static readQuestions(payload: JsonValue): readonly ApprovalQuestion[] | null {
    try {
      return JsonReader.fromValue(payload, Resources.toolInputPath).readObjectArray(Resources.questionsField).map(t => new ApprovalQuestion(
        t.readNonBlankString(Resources.questionField), t.readString(Resources.headerField), t.readNonBlankString(Resources.questionField),
        t.readObjectArray(Resources.optionsField).map(u => new QuestionOption(u.readNonBlankString(Resources.labelField), u.readString(Resources.descriptionField))),
        t.readBoolean(Resources.multiSelectField), true, false));
    }
    catch {
      return null;
    }
  }

  private static decisions(): readonly ApprovalOption[] {
    return [
      new ApprovalOption(Resources.claudeAllowDecision, Resources.allowLabel, ApprovalOutcome.Approved, ApprovalScope.Once),
      new ApprovalOption(Resources.claudeDenyDecision, Resources.denyLabel, ApprovalOutcome.Denied, ApprovalScope.Once)
    ];
  }
}
