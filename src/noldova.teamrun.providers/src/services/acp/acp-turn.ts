/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonException, JsonReader, type JsonObject, type JsonValue } from "@noldova/context.json";
import { ApprovalAsk, type ITurnListener, QuestionAsk, TurnDetail, TurnStart, type TurnWake } from "@noldova/teamrun.core";
import { ApprovalKind, ApprovalOption, ApprovalOutcome, ApprovalScope, DetailKind, ObservedSettings, type PlanStep, PlanStepStatus, ReplyUsage,
  Resources as ProtocolResources } from "@noldova/teamrun.protocol";
import type { ApprovalQuestion, QuestionAnswer } from "@noldova/teamrun.protocol";

import { AcpConnectionException } from "../../exceptions/acp-connection.exception.js";
import type { IAcpClientListener } from "../../interfaces/i-acp-client-listener.js";
import type { IAcpPlanReader } from "../../interfaces/i-acp-plan.reader.js";
import type { IAcpQuestionReader } from "../../interfaces/i-acp-question.reader.js";
import type { IAcpSubAgent } from "../../interfaces/i-acp-sub-agent.js";
import type { IAcpToDoListReader } from "../../interfaces/i-acp-to-do-list.reader.js";
import type { IAcpToolGate } from "../../interfaces/i-acp-tool-gate.js";
import { AcpField } from "../../models/acp-field.js";
import type { AcpMcpTool } from "../../models/acp-mcp-tool.js";
import { SavedImage } from "../../models/saved-image.js";
import type { WriteTargets } from "../../models/write-targets.js";
import { Resources } from "../../resources.js";
import type { RoleApplication } from "@noldova/teamrun.protocol";
import { DeltaStream } from "../delta-stream.js";
import { FailureDescriber } from "../failure-describer.js";
import { ImageDataReader } from "../image-data.reader.js";
import { PlanDetails } from "../plan-details.js";
import { UsageValues } from "../usage-values.js";
import { WriteTargetReader } from "../write-target.reader.js";
import { AcpBackgroundReplies } from "./acp-background-replies.js";
import { AcpSubAgents } from "./acp-sub-agents.js";

export class AcpTurn implements IAcpClientListener {
  private readonly kindId: string;
  private readonly providerName: string;
  private readonly toolTitle: string;
  private readonly listener: ITurnListener;
  private readonly signal: AbortSignal;
  private readonly stream: DeltaStream;
  private readonly subAgents: AcpSubAgents;
  private readonly background: AcpBackgroundReplies;
  private readonly savedImageOf: (tool: JsonReader, sessionId: string) => SavedImage | null;
  private readonly routedMcpTool: string | null;
  private readonly teamRunTools: (signal: AbortSignal) => Promise<readonly string[]>;
  private readonly toDosOf: (tool: JsonReader, sessionId: string) => readonly PlanStep[] | null;
  private readonly imageFailureOf: (tool: JsonReader) => JsonObject | null;
  private readonly questions: IAcpQuestionReader | null;
  private readonly plans: IAcpPlanReader | null;
  private readonly toDoList: IAcpToDoListReader | null;
  private readonly leavePlan: (sessionId: string) => Promise<void>;
  private readonly approvedTools: readonly string[];
  private readonly mcpToolOf: (tool: JsonReader) => AcpMcpTool | null;
  private readonly readOnlyTools: (signal: AbortSignal) => Promise<readonly string[]>;
  private readonly allowsAll: boolean;
  private planning: boolean;
  private leavingPlan: string | null = null;
  private readonly readOnlyChat: boolean;
  private readonly toolGate: IAcpToolGate | null;
  private refusesWrites: boolean = false;
  private restarting: boolean = false;
  private readonly asking: Map<string, AbortController> = new Map();
  private readonly cancelled: Set<string> = new Set();
  private readonly tools: Map<string, JsonObject> = new Map();
  private readonly images: Map<string, SavedImage> = new Map();
  private readonly unreadImages: Map<string, { readonly params: JsonReader; readonly sessionId: string }> = new Map();
  private readonly denied: Set<string> = new Set();
  private readonly parents: Map<string, IAcpSubAgent> = new Map();
  private sessionId: string | null = null;
  private active: boolean = false;
  private contentKind: string | null = null;
  private contentId: string | null = null;
  private ordinal: number = 0;
  private full: boolean = false;
  private readonly compactions: Set<string> = new Set();
  private lastCompaction: string | null | undefined = undefined;
  private compactedValue: boolean = false;
  private resumed: boolean = false;
  private promptIndex: string | null = null;
  private said: string = String.empty;
  private saidId: string | null = null;
  private sentText: string = String.empty;
  private notice: RegExp | null = null;
  private refusalOf: (text: string) => Error | null = () => null;
  private refused: Error | null = null;
  private modeSwitch: Promise<void> = Promise.resolve();

  public constructor(kindId: string, providerName: string, toolTitle: string, listener: ITurnListener, signal: AbortSignal, streamInterval: number,
    savedImageOf: (tool: JsonReader, sessionId: string) => SavedImage | null = () => null, routedMcpTool: string | null = null,
    teamRunTools: (signal: AbortSignal) => Promise<readonly string[]> = () => Promise.resolve([]),
    toDosOf: (tool: JsonReader, sessionId: string) => readonly PlanStep[] | null = () => null, imageFailureOf: (tool: JsonReader) => JsonObject | null = () => null,
    questions: IAcpQuestionReader | null = null, plans: IAcpPlanReader | null = null,
    leavePlan: (sessionId: string) => Promise<void> = () => Promise.resolve(), approvedTools: readonly string[] = [],
    mcpToolOf: (tool: JsonReader) => AcpMcpTool | null = () => null,
    readOnlyTools: (signal: AbortSignal) => Promise<readonly string[]> = () => Promise.resolve([]), allowsAll: boolean = false,
    planning: boolean = false, toDoList: IAcpToDoListReader | null = null, readOnlyChat: boolean = false, toolGate: IAcpToolGate | null = null) {
    this.kindId = kindId;
    this.providerName = providerName;
    this.toolTitle = toolTitle;
    this.listener = listener;
    this.signal = signal;
    this.stream = new DeltaStream(listener, streamInterval);
    this.subAgents = new AcpSubAgents(listener, kindId);
    this.background = new AcpBackgroundReplies(listener);
    this.savedImageOf = savedImageOf;
    this.routedMcpTool = routedMcpTool;
    this.teamRunTools = teamRunTools;
    this.toDosOf = toDosOf;
    this.imageFailureOf = imageFailureOf;
    this.questions = questions;
    this.plans = plans;
    this.leavePlan = leavePlan;
    this.approvedTools = approvedTools;
    this.mcpToolOf = mcpToolOf;
    this.readOnlyTools = readOnlyTools;
    this.allowsAll = allowsAll;
    this.planning = planning;
    this.toDoList = toDoList;
    this.readOnlyChat = readOnlyChat;
    this.toolGate = toolGate;
  }

  public async beginAsync(sessionId: string, resumed: boolean, observed: ObservedSettings, roleApplied: RoleApplication | null = null): Promise<void> {
    this.sessionId = sessionId;
    this.resumed = resumed;
    this.active = true;
    await this.listener.onStartedAsync(new TurnStart(sessionId, resumed, roleApplied));
    await this.listener.onObservedAsync(observed);
  }

  public restartAfterCancel(): void {
    this.restarting = true;
  }

  public switchingMode(settled: Promise<void>): void {
    this.modeSwitch = settled;
  }

  public afterModeSwitch(then: () => void): void {
    void this.modeSwitch.then(then);
  }

  public async finishAsync(): Promise<void> {
    await this.flushContentAsync();
    for (const [id, image] of this.unreadImages) {
      const read = this.savedImageOf(image.params, image.sessionId);
      await this.recordImageAsync(read, id, Object.isNull(read) ? { [Resources.messageField]: Resources.formatUnreadImage(this.providerName) } : null);
    }
    this.unreadImages.clear();
    if (this.signal.aborted)
      await this.subAgents.cancelKeptAsync();
    await this.subAgents.stopAllAsync();
    this.background.clear();
    this.active = false;
    if (!this.subAgents.isKeeping) {
      this.tools.clear();
      this.parents.clear();
      this.images.clear();
    }
    this.cancelled.clear();
  }

  public get isActive(): boolean {
    return this.active;
  }

  public get keepsSubAgents(): boolean {
    return this.subAgents.isKeeping;
  }

  public get subAgentStates(): string {
    return this.subAgents.states;
  }

  public keepSubAgents(cancel: (subAgentId: string) => Promise<boolean>, ended: (wake: TurnWake | null) => void): void {
    this.subAgents.keep(cancel, ended);
  }

  public owns(method: string, params: JsonReader): boolean {
    if (this.active || !this.subAgents.isKeeping || (method !== Resources.acpSessionUpdate && !Resources.xaiSessionNotificationMethods.includes(method))
      || !params.hasField(Resources.acpUpdateField))
      return false;
    const sessionId = params.readNullableString(Resources.sessionIdField);
    if (sessionId !== this.sessionId)
      return this.subAgents.keepsChild(sessionId);
    const update = params.readObject(Resources.acpUpdateField);
    return this.subAgents.keepsUpdate(update.readOptionalString(Resources.acpSessionUpdateField) ?? String.empty, update.toJson());
  }

  public stopSubAgents(): Promise<void> {
    return this.subAgents.stopKept();
  }

  public endSubAgentsAsync(): Promise<void> {
    return this.subAgents.endAllAsync();
  }

  private get canAsk(): boolean {
    return !Object.isNull(this.sessionId) && !(this.active && this.signal.aborted);
  }

  public get contextFull(): boolean {
    return this.full;
  }

  public get compacted(): boolean {
    return this.compactedValue;
  }

  public get nativeTurnId(): string | null {
    return this.promptIndex;
  }

  public get refusal(): Error | null {
    return this.refused;
  }

  public get lastText(): string {
    return this.said;
  }

  public async onNotificationAsync(method: string, params: JsonReader): Promise<void> {
    if (method === Resources.acpCancelRequest) {
      const requestId = String(params.toJson()[Resources.acpRequestIdField]);
      const asking = this.asking.get(requestId);
      if (Object.isUndefined(asking))
        this.cancelled.add(requestId);
      else
        asking.abort();
      return;
    }
    if (Resources.copilotSessionEventMethods.includes(method)) {
      if (params.readNullableString(Resources.sessionIdField) === this.sessionId)
        await this.subAgents.noteEventAsync(params.toJson());
      return;
    }
    const toDoList = this.toDoList;
    if (!Object.isNull(toDoList) && toDoList.methods.includes(method)) {
      if (params.toJson()[Resources.sessionIdField] === this.sessionId) {
        if (this.active)
          await this.showToDoListAsync(params, toDoList);
        else
          await this.readNotedAsync(() => toDoList.read(params), null);
      }
      return;
    }
    if (Resources.cursorGenerateImageMethods.includes(method)) {
      const sessionId = params.readNullableString(Resources.sessionIdField);
      if (this.active && !Object.isNull(sessionId) && sessionId === this.sessionId)
        this.unreadImages.set(`${this.kindId}-${++this.ordinal}`, { params, sessionId });
      return;
    }
    const extension = Resources.xaiSessionNotificationMethods.includes(method);
    if ((!this.active && !this.owns(method, params)) || (method !== Resources.acpSessionUpdate && !extension))
      return;
    const sessionId = params.readNullableString(Resources.sessionIdField);
    if (sessionId !== this.sessionId) {
      const child = this.subAgents.ofChild(sessionId);
      if (!Object.isUndefined(child))
        await this.onChildUpdateAsync(child, params.readObject(Resources.acpUpdateField));
      return;
    }
    const update = params.readObject(Resources.acpUpdateField);
    const kind = update.readNonBlankString(Resources.acpSessionUpdateField);
    if (kind === Resources.acpCompactionUpdate ? update.readOptionalString(Resources.statusField) === Resources.acpCompactionCompleted
      : extension && kind === Resources.xaiAutoCompactCompleted) {
      const id = kind === Resources.acpCompactionUpdate ? update.readOptionalString(Resources.acpCompactionIdField) ?? null : null;
      const shown = Object.isNull(id) ? !Object.isUndefined(this.lastCompaction) : this.compactions.has(id) || Object.isNull(this.lastCompaction);
      if (!shown) {
        await this.flushContentAsync();
        await this.listener.onDetailAsync(new TurnDetail(DetailKind.Note, Resources.formatContextCompacted(this.providerName), Resources.compactionPayload, `${this.kindId}-${++this.ordinal}`));
      }
      if (!Object.isNull(id))
        this.compactions.add(id);
      this.lastCompaction = id ?? this.lastCompaction ?? null;
      this.compactedValue = true;
    }
    else if (kind === Resources.acpSessionInfoUpdate) {
      const title = update.toJson()[Resources.titleField];
      if (Object.isString(title) && !String.isNullOrWhitespace(title) && !this.repeatsSentText(title))
        await this.listener.onTitleAsync?.(title);
    }
    else if (kind === Resources.acpUserChunk) {
      const meta = update.hasField(Resources.acpMetaField) ? update.readNullableObject(Resources.acpMetaField) : null;
      const index = meta?.toJson()[Resources.xaiPromptIndexField];
      if (Number.isSafeInteger(index) && Number(index) >= 0)
        this.promptIndex = String(index);
    }
    else if (extension && Resources.xaiSubAgentUpdates.includes(kind))
      await this.subAgents.handleAsync(kind, update.toJson());
    else if (extension)
      this.full ||= kind === Resources.xaiRetryState && update.readOptionalString(Resources.typeField) === Resources.xaiRetryFailed
        && update.readOptionalString(Resources.xaiErrorTypeField) === Resources.xaiContextLengthError;
    else if (kind === Resources.acpMessageChunk || kind === Resources.acpThoughtChunk) {
      this.lastCompaction = undefined;
      const speaker = this.subAgents.speaker();
      if (!Object.isNullOrUndefined(speaker)) {
        await this.onChildUpdateAsync(speaker, update);
        return;
      }
      if (Object.isNull(speaker) && kind === Resources.acpThoughtChunk)
        return;
      const content = update.readObject(Resources.contentField);
      if (this.notice?.test(String(content.toJson()[Resources.textField])) === true)
        return;
      const type = content.readNonBlankString(Resources.typeField);
      const image = type === Resources.imageInputType && kind === Resources.acpMessageChunk ? AcpTurn.blockImageOf(content.toJson()) : null;
      if (!Object.isNull(image))
        await this.recordImageAsync(image, `${this.kindId}-${++this.ordinal}`);
      if (type !== Resources.textInputType)
        return;
      const refusal = kind === Resources.acpMessageChunk && Object.isUndefined(speaker) ? this.refusalOf(content.readString(Resources.textField)) : null;
      if (!Object.isNull(refusal)) {
        this.refused = refusal;
        return;
      }
      if (this.contentKind !== kind) {
        await this.flushContentAsync();
        this.contentKind = kind;
        this.contentId = `${this.kindId}-${++this.ordinal}`;
      }
      const detailKind = kind === Resources.acpThoughtChunk ? DetailKind.Reasoning : Object.isNull(speaker) ? DetailKind.Note : DetailKind.Text;
      const text = content.readString(Resources.textField);
      this.stream.append(this.contentId!, detailKind, text);
      if (detailKind === DetailKind.Text) {
        this.said = this.saidId === this.contentId ? this.said + text : text;
        this.saidId = this.contentId;
      }
      if (detailKind === DetailKind.Text && this.kindId === Resources.copilotKindId)
        this.background.noteText(this.contentId!, text);
    }
    else if (kind === Resources.acpToolCall || kind === Resources.acpToolUpdate) {
      this.lastCompaction = undefined;
      await this.flushContentAsync();
      const owner = this.subAgents.ofTool(update.toJson());
      if (Object.isNullOrUndefined(owner))
        await this.recordToolAsync(update);
      else {
        if (kind === Resources.acpToolCall)
          await this.subAgents.countToolAsync(owner);
        await this.onChildUpdateAsync(owner, update);
      }
    }
    else if (kind === Resources.acpCurrentModeUpdate && !Object.isNull(this.leavingPlan)) {
      const leaving = this.leavingPlan;
      this.leavingPlan = null;
      void this.leavePlan(leaving).catch((error: unknown) => FailureDescriber.isClosedRun(error) ? undefined
        : this.listener.onDetailAsync(new TurnDetail(DetailKind.Note, Resources.formatChatModeKeptOut(this.providerName, FailureDescriber.describe(error)), null, null)));
    }
    else if (kind === Resources.acpPlanUpdate) {
      this.lastCompaction = undefined;
      await this.flushContentAsync();
      const steps = update.readObjectArray(Resources.acpEntriesField).map(t => t.toJson())
        .map(t => PlanDetails.step(t[Resources.contentField], PlanDetails.statusOf(Resources.acpPlanStatuses, t[Resources.statusField], PlanStepStatus.Pending), undefined));
      await this.listener.onDetailAsync(PlanDetails.detail(steps, undefined, Resources.planDetailId));
    }
    else if (kind === Resources.acpUsageUpdate) {
      this.lastCompaction = undefined;
      const json = update.toJson();
      const context = UsageValues.context(json[Resources.acpUsedField], json[Resources.acpSizeField]);
      const cost = this.replyCostOf(json[Resources.acpCostField]);
      if (!Object.isNull(context) || !Object.isNull(cost))
        await this.listener.onUsageAsync(new ReplyUsage(null, null, cost, context));
    }
  }

  private replyCostOf(value: JsonValue | undefined): number | null {
    const cost = UsageValues.objectOf(value);
    return this.resumed || cost?.[Resources.acpCurrencyField] !== Resources.acpUsdCurrency ? null : UsageValues.amount(cost[Resources.acpAmountField]);
  }

  public async onRequest(id: string, method: string, params: JsonReader): Promise<JsonValue> {
    if (method === Resources.acpElicitationCreate)
      return this.elicit(id, params);
    if (!Object.isNull(this.questions) && this.questions.methods.includes(method) && this.questions.claims(params))
      return this.askQuestions(id, params, this.questions);
    if (!Object.isNull(this.plans) && this.plans.methods.includes(method))
      return this.reviewPlan(id, params, this.plans);
    if (!Object.isNull(this.toolGate) && this.toolGate.methods.includes(method))
      return this.gateAsync(params, this.toolGate);
    if (method !== Resources.acpRequestPermission)
      throw new AcpConnectionException(Resources.acpUnsupportedRequest);
    if (!this.canAsk || params.readNonBlankString(Resources.sessionIdField) !== this.sessionId)
      return { outcome: { outcome: Resources.acpCancelled } };
    const tool = params.readObject(Resources.acpToolCallField);
    const requesting = AcpSubAgents.requestingSessionOf(tool.toJson());
    const asking = this.subAgents.ofChild(requesting) ?? this.subAgents.ofTool(tool.toJson());
    const scope = asking?.childSessionId ?? AcpSubAgents.agentIdOf(tool.toJson());
    if (!this.active && !Object.isNull(requesting ?? scope) && !this.subAgents.keepsChild(requesting))
      return { outcome: { outcome: Resources.acpCancelled } };
    const named = tool.readOptionalString(Resources.titleField);
    const call = AcpTurn.useToolCallOf(tool);
    const start = AcpSubAgents.startOf(tool.toJson(), this.kindId);
    const title = call?.summary ?? (Object.isNull(start) ? named : AcpTurn.cleaned(start)) ?? this.toolTitle;
    const kind = tool.readOptionalString(Resources.kindField) ?? Resources.acpOtherKind;
    const options = params.readObjectArray(Resources.optionsField).filter(t => {
      const kind = t.readNonBlankString(Resources.kindField);
      return kind === Resources.acpAllowOnce || kind === Resources.acpRejectOnce;
    }).map(t => new ApprovalOption(t.readNonBlankString(Resources.acpOptionIdField), t.readNonBlankString(Resources.nameField),
      t.readNonBlankString(Resources.kindField) === Resources.acpAllowOnce ? ApprovalOutcome.Approved : ApprovalOutcome.Denied, ApprovalScope.Once));
    if (options.length === 0)
      throw new AcpConnectionException(Resources.acpUnsupportedRequest);
    const routed = Object.isNull(this.routedMcpTool) ? null : AcpTurn.routedCallOf(tool, named, this.routedMcpTool);
    if (!Object.isNull(routed) && routed.shown.startsWith(Resources.routedTeamRunToolPrefix)) {
      const listed = this.active && await this.isTeamRunTool(routed.name);
      if (this.signal.aborted || !this.active)
        return { outcome: { outcome: Resources.acpCancelled } };
      if (!listed)
        return this.refuseAsync(tool, options, Resources.formatRoutedMcpToolRefused(this.providerName, AcpTurn.cleaned(routed.shown)), scope);
      const allow = options.find(t => t.outcome === ApprovalOutcome.Approved);
      if (this.approvedTools.includes(routed.shown.slice(Resources.routedTeamRunToolPrefix.length)) && !Object.isUndefined(allow))
        return { outcome: { outcome: Resources.acpSelected, optionId: allow.id } };
    }
    const mcp = this.mcpToolOf(tool);
    if (mcp?.server === ProtocolResources.mcpServerName) {
      const readOnly = (await this.readOnlyTools(this.signal).catch((): readonly string[] => [])).includes(mcp.tool);
      if (this.signal.aborted || !this.active)
        return { outcome: { outcome: Resources.acpCancelled } };
      const allow = options.find(t => t.outcome === ApprovalOutcome.Approved);
      if (readOnly && !Object.isUndefined(allow))
        return { outcome: { outcome: Resources.acpSelected, optionId: allow.id } };
    }
    if (this.refusesWrites)
      return this.refuseAsync(tool, options, Resources.formatReadOnlyChatRefused(this.providerName, title), scope);
    const allowed = this.allowsAll && !this.planning ? options.find(t => t.outcome === ApprovalOutcome.Approved) : undefined;
    if (!Object.isUndefined(allowed))
      return { outcome: { outcome: Resources.acpSelected, optionId: allowed.id } };
    const command = kind === Resources.acpExecuteKind ? AcpTurn.commandOf(tool) : null;
    const summary = Object.isNull(command) || title === command || title === Resources.formatGrokExecuteTitle(command) ? title
      : AcpTurn.cleaned(Resources.formatToolWithCommand(title, command));
    const choice = await this.listener.onApprovalRequested(new ApprovalAsk(`${this.sessionId}:${id}`,
      kind === Resources.acpExecuteKind ? ApprovalKind.Command : ApprovalKind.Tool, kind, summary, Object.isUndefined(asking) ? params.toJson()
        : { ...params.toJson(), [Resources.subAgentField]: asking?.agent.description ?? Resources.acpUnnamedSubAgent }, options)).catch((error: unknown) => {
      if (FailureDescriber.isClosedRun(error))
        return null;
      throw error;
    });
    if (!options.some(t => t.id === choice))
      return { outcome: { outcome: Resources.acpCancelled } };
    const toolCallId = tool.readOptionalString(Resources.acpToolCallIdField);
    if (options.some(t => t.id === choice && t.outcome === ApprovalOutcome.Denied) && !Object.isUndefined(toolCallId))
      await this.denyAsync(AcpTurn.keyOf(toolCallId, scope));
    return { outcome: { outcome: Resources.acpSelected, optionId: choice } };
  }

  private async elicit(id: string, params: JsonReader): Promise<JsonValue> {
    const sessionId = params.readOptionalString(Resources.sessionIdField) ?? null;
    if (this.cancelled.delete(id) || !this.canAsk || (!Object.isNull(sessionId) && sessionId !== this.sessionId))
      return { [Resources.acpActionField]: Resources.acpCancelAction };
    const fields = Object.isNull(sessionId) ? null : AcpTurn.readFields(params);
    if (Object.isNull(fields))
      return { [Resources.acpActionField]: Resources.acpDeclineAction };
    const answers = await this.ask(id, Resources.acpElicitationCreate, fields.map(t => t.question));
    if (Object.isUndefined(answers))
      return { [Resources.acpActionField]: Resources.acpCancelAction };
    const content = Object.isNull(answers) ? null : AcpTurn.toContent(fields, answers);
    if (Object.isNull(content))
      return { [Resources.acpActionField]: Resources.acpDeclineAction };

    return { [Resources.acpActionField]: Resources.acpAcceptAction, [Resources.contentField]: content };
  }

  private async askQuestions(id: string, params: JsonReader, reader: IAcpQuestionReader): Promise<JsonValue> {
    const questions = params.toJson()[Resources.sessionIdField] === this.sessionId ? reader.read(params) : null;
    if (this.cancelled.delete(id) || !this.canAsk || Object.isNull(questions))
      return reader.reply(params, null);

    return reader.reply(params, await this.ask(id, reader.nativeKind, questions) ?? null);
  }

  private async reviewPlan(id: string, params: JsonReader, reader: IAcpPlanReader): Promise<JsonValue> {
    const sessionId = params.toJson()[Resources.sessionIdField] === this.sessionId ? this.sessionId : null;
    if (this.cancelled.delete(id) || !this.canAsk || Object.isNull(sessionId))
      return reader.reply(params, null);
    const plan = await this.readPlanAsync(params, reader);
    const shown = Object.isNull(plan) ? null : PlanDetails.text(plan.text);
    if (Object.isNull(plan) || Object.isNull(shown))
      return reader.reply(params, null);
    await this.listener.onDetailAsync(shown);
    if (plan.steps.length > 0)
      await this.listener.onDetailAsync(PlanDetails.detail(plan.steps, undefined, Resources.planDetailId));
    if (this.cancelled.delete(id))
      return reader.reply(params, null);
    const cancel = new AbortController();
    this.asking.set(id, cancel);
    const choice = await this.listener.onApprovalRequested(new ApprovalAsk(`${this.sessionId}:${id}`, ApprovalKind.Tool, reader.nativeKind, shown.text,
      params.toJson(), AcpTurn.planDecisions()), cancel.signal).catch((error: unknown) => {
      if (FailureDescriber.isClosedRun(error) || cancel.signal.aborted)
        return null;
      throw error;
    }).finally(() => this.asking.delete(id));
    const approved = choice === Resources.acpApprovePlanOption ? true : choice === Resources.acpKeepPlanningOption ? false : null;
    if (Object.isNull(approved) || cancel.signal.aborted || this.signal.aborted)
      return reader.reply(params, null);
    const decided = PlanDetails.text(plan.text, !approved, approved);
    if (!Object.isNull(decided))
      await this.listener.onDetailAsync(decided);
    this.refusesWrites = approved && this.readOnlyChat;
    if (approved && reader.leavesPlan) {
      this.planning = false;
      this.leavingPlan = sessionId;
    }
    else if (approved)
      this.planning = await this.leavePlan(sessionId).then(() => false, async (error: unknown) => {
        await this.listener.onDetailAsync(new TurnDetail(DetailKind.Note, Resources.formatPlanModeKept(this.providerName, FailureDescriber.describe(error)), null, null));
        return true;
      });
    return reader.reply(params, approved);
  }

  private readPlanAsync(params: JsonReader, reader: IAcpPlanReader): Promise<{ readonly text: string; readonly steps: readonly PlanStep[] } | null> {
    return this.readNotedAsync(() => reader.read(params), Resources.formatPlanUnread);
  }

  private async showToDoListAsync(params: JsonReader, reader: IAcpToDoListReader): Promise<void> {
    const steps = await this.readNotedAsync(() => reader.read(params), Resources.formatToDoListUnread);
    if (Object.isNull(steps))
      return;
    this.lastCompaction = undefined;
    await this.flushContentAsync();
    await this.listener.onDetailAsync(PlanDetails.detail(steps, undefined, Resources.planDetailId));
  }

  private async readNotedAsync<T>(read: () => T, unread: ((provider: string, error: string) => string) | null): Promise<T | null> {
    try {
      return read();
    }
    catch (error) {
      if (!(error instanceof JsonException))
        throw error;
      if (!Object.isNull(unread))
        await this.listener.onDetailAsync(new TurnDetail(DetailKind.Note, unread(this.providerName, FailureDescriber.describe(error)), null, null));
      return null;
    }
  }

  private static planDecisions(): readonly ApprovalOption[] {
    return [new ApprovalOption(Resources.acpApprovePlanOption, Resources.approvePlanLabel, ApprovalOutcome.Approved, ApprovalScope.Once),
      new ApprovalOption(Resources.acpKeepPlanningOption, Resources.keepPlanningLabel, ApprovalOutcome.Denied, ApprovalScope.Once)];
  }

  private async ask(id: string, nativeKind: string, questions: readonly ApprovalQuestion[]): Promise<readonly QuestionAnswer[] | null | undefined> {
    const cancel = new AbortController();
    this.asking.set(id, cancel);
    try {
      return await this.listener.onQuestionsAsked(new QuestionAsk(`${this.sessionId}:${id}`, nativeKind, questions), cancel.signal);
    }
    catch {
      return undefined;
    }
    finally {
      this.asking.delete(id);
    }
  }

  public onExitAsync(): Promise<void> {
    return this.finishAsync();
  }

  public noteSent(text: string): void {
    this.sentText = AcpTurn.spaced(text);
  }

  public leaveOutNotices(notice: RegExp | null): void {
    this.notice = notice;
  }

  public watchRefusals(refusalOf: (text: string) => Error | null): void {
    this.refusalOf = refusalOf;
  }

  public async onResponseAsync(method: string, result: JsonReader | null = null): Promise<void> {
    if (method !== Resources.acpSessionPrompt)
      return;
    if (this.restarting && result?.readOptionalString(Resources.acpStopReasonField) === Resources.acpCancelled) {
      this.restarting = false;
      await this.flushContentAsync();
      return;
    }
    if (result?.readOptionalString(Resources.acpStopReasonField) === Resources.acpEndTurn)
      await this.subAgents.endWithTurnAsync();
    await this.finishAsync();
  }

  private static spaced(text: string): string {
    return text.replace(Resources.acpTitleSpaces, " ").trim();
  }

  private repeatsSentText(title: string): boolean {
    return this.sentText.includes(AcpTurn.spaced(title).replace(Resources.acpTitleCutEnd, String.empty));
  }

  private async flushContentAsync(): Promise<void> {
    await this.stream.flushAsync();
    if (!Object.isNull(this.contentId))
      this.stream.forget(this.contentId);
    this.contentKind = null;
    this.contentId = null;
  }

  private static readChange(diff: JsonReader): JsonObject {
    const before = diff.hasField(Resources.acpOldTextField) ? diff.readNullableString(Resources.acpOldTextField) : null;
    const after = diff.readString(Resources.acpNewTextField);
    const lines = [
      ...String.isNullOrEmpty(before) ? [] : before.split(Resources.lineSeparator).map(t => `${Resources.diffRemovedPrefix}${t}`),
      ...after.length === 0 ? [] : after.split(Resources.lineSeparator).map(t => `${Resources.diffAddedPrefix}${t}`)
    ];
    return {
      [Resources.pathField]: diff.readNonBlankString(Resources.pathField),
      [Resources.kindField]: String.isNullOrEmpty(before) ? Resources.addChangeKind : Resources.updateChangeKind,
      [Resources.diffField]: lines.join(Resources.lineSeparator)
    };
  }

  private async denyAsync(key: string): Promise<void> {
    this.denied.add(key);
    const known = this.tools.get(key);
    if (!Object.isUndefined(known))
      await this.recordToolAsync(JsonReader.fromValue(known), this.parents.get(key) ?? null);
  }

  private async onChildUpdateAsync(entry: IAcpSubAgent, update: JsonReader): Promise<void> {
    const kind = update.readNonBlankString(Resources.acpSessionUpdateField);
    if (kind === Resources.acpMessageChunk) {
      const content = update.readObject(Resources.contentField);
      if (content.readNonBlankString(Resources.typeField) === Resources.textInputType)
        this.subAgents.appendText(entry, content.readString(Resources.textField));
    }
    else if (kind === Resources.acpToolCall || kind === Resources.acpToolUpdate) {
      await this.subAgents.flushTextAsync(entry);
      await this.recordToolAsync(update, entry);
    }
  }

  private async recordToolAsync(update: JsonReader, parent: IAcpSubAgent | null = null): Promise<void> {
    const unnamed = Object.isNull(parent) ? AcpSubAgents.agentIdOf(update.toJson()) : null;
    const id = AcpTurn.keyOf(update.readNonBlankString(Resources.acpToolCallIdField), parent?.childSessionId ?? unnamed);
    const sent = AcpTurn.contentImageOf(update.toJson());
    if (!Object.isNull(sent))
      this.images.set(id, sent);
    const merged = AcpTurn.compact({ [Resources.statusField]: Resources.acpPendingStatus, ...this.tools.get(id), ...update.toJson() });
    this.tools.set(id, merged);
    if (!Object.isNull(parent))
      this.parents.set(id, parent);
    if (this.tools.size > Resources.acpMaximumPending) {
      const oldest = this.tools.keys().next().value!;
      this.tools.delete(oldest);
      this.images.delete(oldest);
      this.denied.delete(oldest);
      this.parents.delete(oldest);
    }
    if (Object.isNull(parent) && Object.isNull(unnamed) && (this.subAgents.has(id) || AcpSubAgents.isSpawn(merged, this.kindId))) {
      this.background.mark(id);
      await this.subAgents.noteToolAsync(id, `${this.kindId}-tool-${id}`, merged, this.denied.has(id));
      return;
    }
    await this.subAgents.noteStartAsync(id, merged);
    const reading = Object.isNull(parent) && Object.isNull(unnamed) ? AcpSubAgents.readAgentOf(merged, this.kindId) : null;
    if (!Object.isNull(reading))
      await this.readBackgroundAsync(id, reading, merged);
    const tool = JsonReader.fromValue(merged);
    const completed = tool.readOptionalString(Resources.statusField) === Resources.acpCompletedStatus;
    const generated = completed ? this.savedImageOf(tool, this.sessionId!) : null;
    if (!Object.isNull(generated)) {
      await this.recordImageAsync(generated, `${this.kindId}-tool-${id}`);
      return;
    }
    const failure = tool.readOptionalString(Resources.statusField) === Resources.acpFailedStatus ? this.imageFailureOf(tool) : null;
    if (!Object.isNull(failure)) {
      await this.recordImageAsync(null, `${this.kindId}-tool-${id}`, failure);
      return;
    }
    const image = completed ? this.images.get(id) : undefined;
    const kind = tool.readOptionalString(Resources.kindField) ?? Resources.acpOtherKind;
    const title = (tool.readOptionalString(Resources.titleField) ?? this.toolTitle).slice(0, Resources.maximumSummaryLength);
    const paths = tool.hasField(Resources.acpLocationsField)
      ? tool.readObjectArray(Resources.acpLocationsField).map(t => t.readNonBlankString(Resources.pathField)) : [];
    const changes = completed && tool.hasField(Resources.contentField)
      ? tool.readObjectArray(Resources.contentField).filter(t => t.readOptionalString(Resources.typeField) === Resources.acpDiffType).map(t => AcpTurn.readChange(t))
      : [];
    const served = this.teamRunToolOf(merged);
    const writes = kind === Resources.acpExecuteKind && Object.isNull(served) ? AcpTurn.writesOf(merged) : null;
    const payload = {
      ...merged, files: paths, tool: kind, ...(Object.isNull(served) ? {} : AcpTurn.servedFieldsOf(served)), ...(this.denied.has(id) ? { [Resources.deniedField]: true } : {}), ...(changes.length > 0 ? { [Resources.changesField]: changes } : {}),
      ...(Object.isNull(writes) ? {} : writes.toJson()),
      ...(Object.isUndefined(image) ? {} : { [Resources.imageDataField]: image.data, [Resources.mediaTypeField]: image.mediaType })
    };
    const detailKind = !Object.isNull(served) ? DetailKind.Note : kind === Resources.acpExecuteKind ? DetailKind.Command : kind === Resources.acpEditKind ? DetailKind.FileChange : DetailKind.Note;
    await this.listener.onDetailAsync(new TurnDetail(detailKind, title, payload, `${this.kindId}-tool-${id}`, parent?.itemId ?? null));
    const steps = completed && Object.isNull(parent) && Object.isNull(unnamed) ? this.toDosOf(tool, this.sessionId!) : null;
    if (!Object.isNull(steps))
      await this.listener.onDetailAsync(PlanDetails.detail(steps, undefined, Resources.planDetailId));
  }

  private async readBackgroundAsync(id: string, agentId: string, tool: JsonObject): Promise<void> {
    this.background.mark(id);
    const entry = this.subAgents.backgroundOf(agentId);
    const output = tool[Resources.statusField] === Resources.acpCompletedStatus ? AcpSubAgents.outputOf(tool) : null;
    const replies = Object.isNull(output) ? null : AcpBackgroundReplies.repliesOf(output);
    if (!Object.isUndefined(entry) && !Object.isNull(replies))
      await this.subAgents.endBackgroundAsync(entry, await this.background.takeAsync(entry.toolCallId, id, replies), replies);
  }

  private static keyOf(toolCallId: string, scope: string | null): string {
    return Object.isNull(scope) ? toolCallId : `${scope}${Resources.requestIdSeparator}${toolCallId}`;
  }

  private async recordImageAsync(image: SavedImage | null, id: string, failure: JsonObject | null = null): Promise<void> {
    await this.flushContentAsync();
    const payload = {
      itemType: Resources.imageGenerationItemType, status: Object.isNull(image) ? Resources.acpFailedStatus : Resources.acpCompletedStatus,
      savedPath: image?.path ?? null, revisedPrompt: null, failure, imageData: image?.data ?? null, mediaType: image?.mediaType ?? null
    };
    await this.listener.onDetailAsync(new TurnDetail(DetailKind.Note, Resources.formatGeneratedImage(image?.path ?? null), payload, id));
  }

  private static compact(tool: JsonObject): JsonObject {
    const content = tool[Resources.contentField];
    return {
      ...tool,
      ...(Array.isArray(content) ? { [Resources.contentField]: content.map(t => AcpTurn.withoutBytes(t)) } : {}),
      ...(Object.isUndefined(tool[Resources.acpRawInputField]) ? {} : { [Resources.acpRawInputField]: AcpTurn.capped(tool[Resources.acpRawInputField]!) }),
      ...(Object.isUndefined(tool[Resources.acpRawOutputField]) ? {} : { [Resources.acpRawOutputField]: AcpTurn.capped(tool[Resources.acpRawOutputField]!) })
    };
  }

  private static withoutBytes(item: JsonValue): JsonValue {
    const entry = AcpTurn.objectOf(item);
    const block = AcpTurn.objectOf(entry?.[Resources.contentField]);
    if (entry?.[Resources.typeField] !== Resources.acpContentBlockType || Object.isNull(block))
      return item;
    const type = block[Resources.typeField];
    const data = block[Resources.dataField];
    if ((type === Resources.imageInputType || type === Resources.acpAudioType) && Object.isString(data))
      return { ...entry, [Resources.contentField]: { ...AcpTurn.without(block, Resources.dataField), [Resources.sizeField]: AcpTurn.byteLengthOf(data) } };
    const resource = AcpTurn.objectOf(block[Resources.acpResourceField]);
    const blob = resource?.[Resources.acpBlobField];
    if (type !== Resources.acpResourceType || !Object.isString(blob))
      return item;
    const kept = { ...AcpTurn.without(resource!, Resources.acpBlobField), [Resources.sizeField]: AcpTurn.byteLengthOf(blob) };
    return { ...entry, [Resources.contentField]: { ...block, [Resources.acpResourceField]: kept } };
  }

  private static without(value: JsonObject, field: string): JsonObject {
    return Object.fromEntries(Object.entries(value).filter(([key]) => key !== field));
  }

  private static writesOf(tool: JsonObject): WriteTargets | null {
    const command = AcpTurn.objectOf(tool[Resources.acpRawInputField])?.[Resources.commandField];
    if (!Object.isString(command))
      return null;
    return WriteTargetReader.targetsOfCommand(command);
  }

  private static capped(value: JsonValue): JsonValue {
    if (Object.isString(value))
      return value.slice(0, Resources.maximumToolResultLength);
    if (Array.isArray(value))
      return value.map(t => AcpTurn.capped(t));
    const entries = AcpTurn.objectOf(value);
    return Object.isNull(entries) ? value : Object.fromEntries(Object.entries(entries).map(([key, item]) => [key, AcpTurn.capped(item)]));
  }

  private static byteLengthOf(data: string): number {
    return Math.floor(data.replace(Resources.base64PaddingPattern, String.empty).length * 3 / 4);
  }

  private static contentImageOf(tool: JsonObject): SavedImage | null {
    const content = tool[Resources.contentField];
    for (const item of Array.isArray(content) ? content : []) {
      const entry = AcpTurn.objectOf(item);
      const block = AcpTurn.objectOf(entry?.[Resources.contentField]);
      const image = entry?.[Resources.typeField] === Resources.acpContentBlockType && block?.[Resources.typeField] === Resources.imageInputType
        ? AcpTurn.blockImageOf(block) : null;
      if (!Object.isNull(image))
        return image;
    }
    return null;
  }

  private static blockImageOf(block: JsonObject): SavedImage | null {
    const data = block[Resources.dataField];
    const mediaType = ImageDataReader.mediaTypeOf(Object.isString(data) ? data : null);
    return Object.isNull(mediaType) ? null : new SavedImage(null, mediaType, data as string);
  }

  private async isTeamRunTool(name: string | null): Promise<boolean> {
    if (Object.isNull(name))
      return false;
    const listed = await this.teamRunTools(this.signal).catch((): readonly string[] => []);
    return listed.includes(name.slice(Resources.routedTeamRunToolPrefix.length));
  }

  private async gateAsync(params: JsonReader, gate: IAcpToolGate): Promise<JsonValue> {
    if (!this.readOnlyChat || this.planning)
      return gate.answer(null);
    try {
      return await this.readOnlyGateAsync(params, gate);
    }
    catch {
      return gate.answer(Resources.formatReadOnlyToolRefused(this.providerName, this.toolTitle));
    }
  }

  private async readOnlyGateAsync(params: JsonReader, gate: IAcpToolGate): Promise<JsonValue> {
    const gated = gate.read(params);
    const key = Object.isNull(gated) ? undefined
      : [...this.tools.keys()].find(t => t === gated.toolUseId || t.endsWith(`${Resources.requestIdSeparator}${gated.toolUseId}`));
    const call = Object.isUndefined(key) ? undefined : this.tools.get(key);
    const update = JsonReader.fromValue(call ?? {});
    if (!Object.isNull(gated) && (gate.readOnly(update) || await this.listsReadOnlyAsync(gated.mcp)))
      return gate.answer(null);
    const note = Resources.formatReadOnlyToolRefused(this.providerName, update.readOptionalString(Resources.titleField) ?? gated?.mcp?.tool ?? this.toolTitle);
    await this.listener.onDetailAsync(new TurnDetail(DetailKind.Note, note, null, null));
    if (!Object.isUndefined(key))
      await this.denyAsync(key);
    return gate.answer(note);
  }

  private async listsReadOnlyAsync(mcp: AcpMcpTool | null): Promise<boolean> {
    return mcp?.server === ProtocolResources.mcpServerName && (await this.readOnlyTools(this.signal).catch((): readonly string[] => [])).includes(mcp.tool);
  }

  private async refuseAsync(tool: JsonReader, options: readonly ApprovalOption[], note: string, scope: string | null): Promise<JsonValue> {
    await this.listener.onDetailAsync(new TurnDetail(DetailKind.Note, note, null, null));
    const toolCallId = tool.readOptionalString(Resources.acpToolCallIdField);
    if (!Object.isUndefined(toolCallId))
      await this.denyAsync(AcpTurn.keyOf(toolCallId, scope));
    const reject = options.find(t => t.outcome === ApprovalOutcome.Denied);
    return Object.isUndefined(reject) ? { outcome: { outcome: Resources.acpCancelled } } : { outcome: { outcome: Resources.acpSelected, optionId: reject.id } };
  }

  private teamRunToolOf(tool: JsonObject): { readonly name: string; readonly input: JsonValue } | null {
    const input = tool[Resources.acpRawInputField] ?? {};
    const mcp = this.mcpToolOf(JsonReader.fromValue(tool));
    if (!Object.isNull(mcp))
      return mcp.server === ProtocolResources.mcpServerName && Resources.teamRunToolNamePattern.test(mcp.tool) ? { name: mcp.tool, input } : null;
    const routed = Object.isNull(this.routedMcpTool) ? undefined : AcpTurn.objectOf(input)?.[Resources.useToolNameField];
    const name = Object.isString(routed) ? routed : tool[Resources.titleField];
    const found = Object.isString(name) ? Resources.acpTeamRunToolPattern.exec(name)?.[1] : undefined;
    if (Object.isUndefined(found))
      return null;
    return { name: found, input: Object.isString(routed) ? AcpTurn.objectOf(input)?.[Resources.useToolInputField] ?? {} : input };
  }

  private static servedFieldsOf(served: { readonly name: string; readonly input: JsonValue }): JsonObject {
    return { [Resources.toolField]: Resources.formatTeamRunToolName(served.name), [Resources.inputField]: served.input,
      [ProtocolResources.servedToolField]: served.name, [ProtocolResources.servedInputField]: served.input };
  }

  private static routedCallOf(tool: JsonReader, title: string | undefined, routedMcpTool: string): { readonly name: string | null; readonly shown: string } | null {
    const input = AcpTurn.objectOf(tool.toJson()[Resources.acpRawInputField]);
    const name = input?.[Resources.useToolNameField];
    const file = input?.[Resources.useToolFileFormField];
    if (Object.isUndefined(name) && Object.isUndefined(file) && title !== routedMcpTool)
      return null;
    return { name: Object.isString(name) && Object.isUndefined(file) ? name : null, shown: Object.isString(name) ? name : routedMcpTool };
  }

  private static useToolCallOf(tool: JsonReader): { readonly name: string; readonly summary: string } | null {
    const input = AcpTurn.objectOf(tool.toJson()[Resources.acpRawInputField]);
    const name = input?.[Resources.useToolNameField];
    const file = input?.[Resources.useToolFileField];
    if (!Object.isString(name) || (!Object.isUndefined(file) && !Object.isString(file)) || Object.keys(input!).some(t => !Resources.useToolFields.includes(t)))
      return null;
    const args = input![Resources.useToolInputField];
    const summary = Object.isString(file) ? Resources.formatToolArgumentsFile(name, file)
      : Object.isUndefined(args) ? name : Resources.formatToolWithCommand(name, JSON.stringify(args));
    return { name, summary: AcpTurn.cleaned(summary) };
  }

  private static commandOf(tool: JsonReader): string | null {
    const command = AcpTurn.objectOf(tool.toJson()[Resources.acpRawInputField])?.[Resources.commandField];
    return Object.isString(command) && !String.isNullOrWhitespace(command) ? command.trim() : null;
  }

  private static cleaned(text: string): string {
    const cleaned = text.replace(Resources.controlCharacters, " ");
    return cleaned.length > Resources.maximumSummaryLength ? `${cleaned.slice(0, Resources.maximumSummaryLength - 1)}${Resources.ellipsis}` : cleaned;
  }

  private static objectOf(value: JsonValue | undefined): JsonObject | null {
    return Object.isObject(value) && !Array.isArray(value) ? value as JsonObject : null;
  }

  private static readFields(params: JsonReader): readonly AcpField[] | null {
    try {
      if (params.readNonBlankString(Resources.acpModeField) !== Resources.acpFormMode)
        return null;
      const message = params.readNonBlankString(Resources.messageField);
      const properties = params.readObject(Resources.acpRequestedSchemaField).readObject(Resources.acpPropertiesField);
      const fields = Object.keys(properties.toJson()).map(t => AcpField.read(t, properties.readObject(t), message));
      return fields.length === 0 ? null : fields;
    }
    catch {
      return null;
    }
  }

  private static toContent(fields: readonly AcpField[], answers: readonly QuestionAnswer[]): JsonObject | null {
    const values = answers.map(t => [t.questionId, fields.find(u => u.question.id === t.questionId)?.toValue(t)] as const);
    if (values.some(t => Object.isUndefined(t[1])))
      return null;

    return Object.fromEntries(values) as JsonObject;
  }
}
