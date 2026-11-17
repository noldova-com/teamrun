/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type JsonObject, JsonReader, type JsonValue } from "@noldova/context.json";
import { type ILog, type ITurnListener, TaskEnd, TaskStart, TurnDetail, TurnWake } from "@noldova/teamrun.core";
import { DetailKind, SubAgent, SubAgentStatus } from "@noldova/teamrun.protocol";

import { UnsupportedServerRequestException } from "../../exceptions/unsupported-server-request.exception.js";
import type { ICodexSubAgent } from "../../interfaces/i-codex-sub-agent.js";
import type { IExitHandler } from "../../interfaces/i-exit-handler.js";
import type { IOrphanSweep } from "../../interfaces/i-orphan-sweep.js";
import type { INotificationHandler } from "../../interfaces/i-notification-handler.js";
import type { IServerRequestHandler } from "../../interfaces/i-server-request-handler.js";
import { Resources } from "../../resources.js";
import { FailureDescriber } from "../failure-describer.js";
import { UsageValues } from "../usage-values.js";
import type { AppServerClient } from "./app-server-client.js";
import type { CodexItemReader } from "./codex-item.reader.js";
import type { CodexTurn } from "./codex-turn.js";

export class CodexSubAgents implements INotificationHandler, IExitHandler, IServerRequestHandler {
  private readonly client: AppServerClient;
  private readonly turn: CodexTurn;
  private readonly threadId: string;
  private readonly listener: ITurnListener;
  private readonly itemReader: CodexItemReader;
  private readonly requestTimeout: number;
  private readonly woken: (wake: TurnWake) => Promise<void>;
  private readonly sweep: IOrphanSweep | null;
  private readonly stops: Set<Promise<void>> = new Set();
  private readonly log: ILog | null;
  private readonly agents: Map<string, ICodexSubAgent> = new Map();
  private readonly children: Map<string, string> = new Map();
  private readonly threads: Map<string, JsonObject>;
  private readonly held: Map<string, { readonly method: string; readonly params: JsonReader }[]> = new Map();
  private readonly early: Map<string, { readonly method: string; readonly params: JsonReader }[]> = new Map();
  private readonly waiting: Map<string, PromiseWithResolvers<ICodexSubAgent | null>> = new Map();
  private readonly tasks: Set<string> = new Set();
  private readonly stopping: Set<string> = new Set();
  private readonly interrupted: Set<string> = new Set();
  private readonly idle: PromiseWithResolvers<void> = Promise.withResolvers<void>();
  private accepting: boolean = true;
  private closed: boolean = false;
  private stopped: boolean = false;

  public constructor(client: AppServerClient, turn: CodexTurn, threads: Map<string, JsonObject>, listener: ITurnListener, itemReader: CodexItemReader,
    requestTimeout: number, woken: (wake: TurnWake) => Promise<void>, platform: string = process.platform, sweep: IOrphanSweep | null = null, log: ILog | null = null) {
    this.client = client;
    this.turn = turn;
    this.threadId = turn.threadId;
    this.threads = threads;
    this.listener = listener;
    this.itemReader = itemReader;
    this.requestTimeout = requestTimeout;
    this.woken = woken;
    this.sweep = platform === Resources.linuxPlatform ? sweep : null;
    this.log = log;
  }

  public get isIdle(): boolean {
    return this.closed || (!this.accepting && ![...this.agents.values()].some(t => t.agent.isRunning));
  }

  public get isStopped(): boolean {
    return this.stopped;
  }

  public get isStopping(): boolean {
    return this.stops.size > 0;
  }

  public whenIdle(): Promise<void> {
    return this.idle.promise;
  }

  public whenStopped(): Promise<void> {
    return Promise.allSettled(this.stops).then(() => undefined);
  }

  public async handleNotificationAsync(method: string, params: JsonReader): Promise<void> {
    if (this.closed)
      return;
    if (method === Resources.threadStartedNotification) {
      await this.noteThreadAsync(params.readObject(Resources.threadField));
      return;
    }
    const threadId = params.hasField(Resources.threadIdField) ? params.readValue(Resources.threadIdField) : null;
    if (threadId === this.threadId) {
      if (method === Resources.itemStartedNotification || method === Resources.itemCompletedNotification)
        await this.noteCallAsync(params.readObject(Resources.itemField));
      return;
    }
    const entry = this.ofChild(threadId);
    if (Object.isUndefined(entry)) {
      this.hold(threadId, method, params);
      return;
    }

    switch (method) {
      case Resources.turnStartedNotification:
        await this.beginAsync(entry, params.readObject(Resources.turnField).readNonBlankString(Resources.idField));
        break;
      case Resources.itemStartedNotification:
        await this.nestAsync(entry, this.itemReader.readStarted(params.readObject(Resources.itemField)));
        break;
      case Resources.itemCompletedNotification:
        await this.noteChildItemAsync(entry, params.readObject(Resources.itemField));
        break;
      case Resources.tokenUsageUpdatedNotification:
        await this.updateAsync(entry, { tokens: UsageValues.count(UsageValues.fieldOf(params.toJson()[Resources.tokenUsageField], Resources.totalField,
          Resources.totalTokensField)) });
        break;
      case Resources.turnCompletedNotification:
        await this.endTurnAsync(entry, params.readObject(Resources.turnField).toJson());
        break;
      default:
        break;
    }
  }

  public follows(threadId: JsonValue | null): boolean {
    return !this.closed && Object.isString(threadId) && this.children.has(threadId);
  }

  public mayFollow(threadId: JsonValue | null): boolean {
    return !this.closed && Object.isString(threadId) && (this.held.has(threadId) || this.early.has(threadId));
  }

  public async whenNamed(threadId: JsonValue | null): Promise<boolean> {
    return !Object.isNull(await this.linkOf(threadId));
  }

  public async handleServerRequest(method: string, params: JsonReader, signal: AbortSignal): Promise<JsonValue> {
    const answers = Resources.codexChildRequestAnswers.get(method);
    if (Object.isUndefined(answers))
      throw new UnsupportedServerRequestException(method);
    const threadId = params.readValue(Resources.threadIdField);
    const entry = this.ofChild(threadId) ?? await this.linkOf(threadId);
    if (Object.isNull(entry) && this.stopped)
      return answers.cancel;
    if (Object.isNull(entry))
      throw new UnsupportedServerRequestException(method);
    const asked = await this.turn.ask(method, params, signal, entry.agent.description).catch((error: unknown) => {
      if (signal.aborted || !FailureDescriber.isClosedRun(error))
        throw error;
      return null;
    });
    if (!Object.isNull(asked))
      return asked;
    if (this.stopped)
      return answers.cancel;
    await this.nestAsync(entry, new TurnDetail(DetailKind.Note, answers.note, null, null));
    return answers.decline;
  }

  public async handleExitAsync(): Promise<void> {
    for (const entry of [...this.agents.values()].filter(t => t.agent.isRunning))
      await this.endAsync(entry, SubAgentStatus.Stopped, {});
    this.dropWaiting();
    this.closed = true;
    this.idle.resolve();
  }

  public async stopAll(settled: Promise<unknown>, timeout: number = this.requestTimeout): Promise<void> {
    const earlier = this.whenStopped();
    await this.track(this.stopEvery(settled, timeout));
    await earlier;
  }

  public finishTurn(): void {
    this.accepting = false;
    this.held.clear();
    this.early.clear();
    this.dropWaiting();
    this.settleIfIdle();
  }

  private linkOf(threadId: JsonValue | null): Promise<ICodexSubAgent | null> {
    if (!this.mayFollow(threadId))
      return Promise.resolve(null);
    const waiting = this.waiting.get(threadId as string) ?? Promise.withResolvers<ICodexSubAgent | null>();
    this.waiting.set(threadId as string, waiting);
    return waiting.promise;
  }

  private dropWaiting(): void {
    for (const waiting of this.waiting.values())
      waiting.resolve(null);
    this.waiting.clear();
  }

  private async noteThreadAsync(thread: JsonReader): Promise<void> {
    if (thread.toJson()[Resources.parentThreadIdField] !== this.threadId)
      return;
    const id = thread.readNonBlankString(Resources.idField);
    this.threads.set(id, thread.toJson());
    const entry = this.ofChild(id);
    if (Object.isUndefined(entry))
      this.held.set(id, []);
    else
      await this.linkAsync(entry, id);
  }

  private hold(threadId: JsonValue | null, method: string, params: JsonReader): void {
    if (!Resources.codexChildNotifications.includes(method))
      return;
    const held = this.held.get(threadId as string) ?? this.early.get(threadId as string);
    if (!Object.isUndefined(held))
      held.push({ method, params });
    else if (this.accepting && Object.isString(threadId) && method === Resources.turnStartedNotification)
      this.early.set(threadId, [{ method, params }]);
  }

  private async noteCallAsync(item: JsonReader): Promise<void> {
    const type = item.readNonBlankString(Resources.typeField);
    if (type === Resources.subAgentActivityItemType)
      await this.noteActivityAsync(item.readNonBlankString(Resources.idField), item.toJson());
    if (type !== Resources.collabAgentToolCallItemType)
      return;
    const json = item.toJson();
    if (json[Resources.toolField] === Resources.codexSpawnAgentTool)
      await this.noteSpawnAsync(item.readNonBlankString(Resources.idField), json);
    else if (Resources.codexFollowedAgentTools.includes(String(json[Resources.toolField])))
      await this.noteFollowUpAsync(item.readNonBlankString(Resources.idField), json);
    for (const [child, state] of Object.entries(UsageValues.objectOf(json[Resources.agentsStatesField]) ?? {}))
      await this.noteStateAsync(this.ofChild(child), state);
  }

  private async noteSpawnAsync(id: string, json: JsonObject): Promise<void> {
    const entry = this.agents.get(id) ?? await this.openAsync(id, json);
    const child = CodexSubAgents.receiverOf(json);
    if (Object.isString(child))
      await this.linkAsync(entry, child);
    else if (json[Resources.statusField] !== Resources.inProgressItemStatus)
      await this.endAsync(entry, json[Resources.statusField] === Resources.interruptedItemStatus ? SubAgentStatus.Stopped : SubAgentStatus.Failed, {});
  }

  private async noteFollowUpAsync(id: string, json: JsonObject): Promise<void> {
    const child = CodexSubAgents.receiverOf(json);
    if (!this.agents.has(id) && Object.isString(child) && !this.children.has(child) && this.threads.has(child))
      await this.linkAsync(await this.openAsync(id, json), child);
  }

  private async noteActivityAsync(id: string, json: JsonObject): Promise<void> {
    const child = json[Resources.agentThreadIdField];
    if (!Object.isString(child))
      return;
    switch (json[Resources.kindField]) {
      case Resources.codexStartedActivity:
        this.threads.set(child, json);
        if (!this.agents.has(id))
          await this.linkAsync(await this.openAsync(id, json), child);
        break;
      case Resources.codexInteractedActivity:
        if (!this.children.has(child) && this.threads.has(child))
          await this.linkAsync(await this.openAsync(id, json), child);
        break;
      case Resources.codexInterruptedActivity: {
        const entry = this.ofChild(child);
        if (Object.isUndefined(entry) || !entry.agent.isRunning)
          break;
        if (this.tasks.has(entry.itemId))
          this.interrupted.add(entry.itemId);
        await this.endAsync(entry, SubAgentStatus.Stopped, {});
        break;
      }
      default:
        break;
    }
  }

  private async openAsync(id: string, json: JsonObject): Promise<ICodexSubAgent> {
    await this.reportAsync({ itemId: id, childThreadId: null, turnId: null, agent: new SubAgent(id, null,
      CodexSubAgents.textOf(json, Resources.promptField) ?? CodexSubAgents.nameOf(json) ?? Resources.codexSubAgentDescription,
      CodexSubAgents.textOf(json, Resources.modelField),
      SubAgentStatus.Running, true) });
    return this.agents.get(id)!;
  }

  private async noteStateAsync(entry: ICodexSubAgent | undefined, state: JsonValue): Promise<void> {
    const status = Resources.codexAgentStatuses.get(String(UsageValues.fieldOf(state, Resources.statusField)));
    if (!Object.isUndefined(entry) && !Object.isUndefined(status) && entry.agent.isRunning)
      await this.endAsync(entry, status, { summary: CodexSubAgents.textOf(state, Resources.messageField) });
  }

  private async linkAsync(entry: ICodexSubAgent, child: string): Promise<void> {
    this.children.set(child, entry.itemId);
    const thread = this.threads.get(child);
    const agent = entry.agent;
    await this.reportAsync({ ...entry, childThreadId: child, agent: Object.isUndefined(thread) ? agent : new SubAgent(agent.toolUseId,
      CodexSubAgents.textOf(thread, Resources.agentRoleField) ?? CodexSubAgents.textOf(thread, Resources.agentNicknameField), agent.description,
      CodexSubAgents.textOf(thread, Resources.modelField) ?? agent.model, agent.status, agent.isBackground, agent.toolUses, agent.tokens, agent.durationMs,
      agent.summary) });
    const held = [...(this.early.get(child) ?? []), ...(this.held.get(child) ?? [])];
    this.held.delete(child);
    this.early.delete(child);
    this.waiting.get(child)?.resolve(this.agents.get(entry.itemId)!);
    this.waiting.delete(child);
    for (const notification of held)
      await this.handleNotificationAsync(notification.method, notification.params);
  }

  private async beginAsync(entry: ICodexSubAgent, turnId: string): Promise<void> {
    await this.reportAsync({ ...entry, turnId, agent: entry.agent.with({ status: SubAgentStatus.Running }) });
    this.interrupted.delete(entry.itemId);
    if (!this.tasks.has(entry.itemId)) {
      this.tasks.add(entry.itemId);
      await this.listener.onTaskStartedAsync(new TaskStart(entry.itemId, entry.agent.description, () => this.stop(entry.itemId), entry.itemId, false));
    }
    if (this.stopping.delete(entry.itemId))
      void this.stopQuietly(entry.itemId);
  }

  private async noteChildItemAsync(entry: ICodexSubAgent, item: JsonReader): Promise<void> {
    const type = item.readNonBlankString(Resources.typeField);
    await this.nestAsync(entry, this.itemReader.readCompleted(item, this.turn.hasDeclined(item.readNonBlankString(Resources.idField))));
    if (Resources.codexToolItemTypes.includes(type))
      await this.updateAsync(entry, { toolUses: (entry.agent.toolUses ?? 0) + 1 });
    else if (type === Resources.agentMessageItemType)
      await this.updateAsync(entry, { summary: CodexSubAgents.textOf(item.toJson(), Resources.textField) });
  }

  private async endTurnAsync(entry: ICodexSubAgent, turn: JsonObject): Promise<void> {
    const status = turn[Resources.statusField];
    const duration = UsageValues.count(turn[Resources.durationMsField]);
    const durationMs = Object.isNull(duration) ? null : (entry.agent.durationMs ?? 0) + duration;
    if (!entry.agent.isRunning) {
      if (this.interrupted.delete(entry.itemId))
        await this.updateAsync(entry, { durationMs });
      return;
    }
    if (status === Resources.completedTurnStatus)
      await this.endAsync(entry, SubAgentStatus.Completed, { durationMs });
    else if (status === Resources.interruptedTurnStatus)
      await this.endAsync(entry, SubAgentStatus.Stopped, { durationMs });
    else
      await this.endAsync(entry, SubAgentStatus.Failed, { durationMs, summary: CodexSubAgents.textOf(turn[Resources.errorField], Resources.messageField) });
  }

  private async stopEvery(settled: Promise<unknown>, timeout: number): Promise<void> {
    this.stopped = true;
    for (const entry of [...this.agents.values()].filter(t => t.agent.isRunning && !this.tasks.has(t.itemId)))
      this.stopping.add(entry.itemId);
    const stopping = [...this.tasks].map(t => this.agents.get(t)!);
    const idle = [...this.children].filter(([, t]) => !this.tasks.has(t) && !this.stopping.has(t)).map(([t]) => t);
    if (stopping.length === 0 && idle.length === 0)
      return;
    await Promise.all([...stopping.map(t => this.interrupt(t, timeout).catch(() => undefined)), settled]);
    await this.clean([...idle, ...stopping.map(t => t.childThreadId!)], timeout);
  }

  private stop(itemId: string): Promise<void> {
    return this.track(this.stopOne(itemId));
  }

  private track(work: Promise<void>): Promise<void> {
    this.stops.add(work);
    return work.finally(() => { this.stops.delete(work); });
  }

  private async stopOne(itemId: string): Promise<void> {
    const entry = this.agents.get(itemId)!;
    try {
      await this.interrupt(entry, this.requestTimeout);
    }
    finally {
      await this.clean([entry.childThreadId!], this.requestTimeout);
    }
  }

  private async interrupt(entry: ICodexSubAgent, timeout: number): Promise<void> {
    await this.client.request(Resources.turnInterruptMethod, { threadId: entry.childThreadId, turnId: entry.turnId }, timeout);
  }

  private async clean(threadIds: readonly string[], timeout: number): Promise<void> {
    const clean = async (): Promise<void> => {
      await Promise.all(threadIds.map(t => this.client.request(Resources.backgroundTerminalsCleanMethod, { threadId: t }, timeout)
        .then(() => undefined, () => undefined)));
    };
    const serverId = this.client.processId;
    if (Object.isNull(this.sweep) || Object.isNull(serverId)) {
      await clean();
      return;
    }
    const ended = await this.sweep.endOrphaned(serverId, () => this.client.processId === serverId, threadIds, clean).catch(() => []);
    if (ended.length > 0)
      this.log?.write(Resources.formatCodexOrphansEnded(threadIds.join(", "), ended));
  }

  private stopQuietly(itemId: string): Promise<void> {
    return this.stop(itemId).catch(() => undefined);
  }

  private async nestAsync(entry: ICodexSubAgent, detail: TurnDetail | null): Promise<void> {
    if (!Object.isNull(detail))
      await this.listener.onDetailAsync(new TurnDetail(detail.kind === DetailKind.Text ? DetailKind.Note : detail.kind, detail.text, detail.payload, detail.providerItemId,
        entry.itemId));
  }

  private async endAsync(entry: ICodexSubAgent, status: SubAgentStatus, changes: Parameters<SubAgent["with"]>[0]): Promise<void> {
    await this.updateAsync(entry, { ...changes, status });
    this.stopping.delete(entry.itemId);
    if (this.tasks.delete(entry.itemId))
      await this.listener.onTaskEndedAsync(new TaskEnd(entry.itemId, Resources.subAgentTaskStatuses[status]));
    if (!this.stopped && status !== SubAgentStatus.Stopped)
      await this.woken(new TurnWake(entry.itemId, entry.agent.description));
    this.settleIfIdle();
  }

  private async updateAsync(entry: ICodexSubAgent, changes: Parameters<SubAgent["with"]>[0]): Promise<void> {
    await this.reportAsync({ ...entry, agent: entry.agent.with(Object.fromEntries(Object.entries(changes).filter(([, t]) => !Object.isNull(t))) as Parameters<SubAgent["with"]>[0]) });
  }

  private async reportAsync(entry: ICodexSubAgent): Promise<void> {
    this.agents.set(entry.itemId, entry);
    await this.listener.onDetailAsync(new TurnDetail(DetailKind.SubAgent, entry.agent.description, entry.agent.toJson(), entry.itemId));
  }

  private ofChild(threadId: JsonValue | null): ICodexSubAgent | undefined {
    const itemId = Object.isString(threadId) ? this.children.get(threadId) : undefined;
    return Object.isUndefined(itemId) ? undefined : this.agents.get(itemId);
  }

  private settleIfIdle(): void {
    if (this.isIdle)
      this.idle.resolve();
  }

  private static receiverOf(json: JsonObject): JsonValue | undefined {
    const receivers = json[Resources.receiverThreadIdsField];
    return Array.isArray(receivers) ? receivers[0] : undefined;
  }

  private static nameOf(json: JsonObject): string | null {
    const path = json[Resources.agentPathField];
    const name = Object.isString(path) ? path.split(Resources.agentPathSeparator).at(-1)! : String.empty;
    return String.isNullOrWhitespace(name) ? null : name;
  }

  private static textOf(value: JsonValue | undefined, field: string): string | null {
    const text = UsageValues.fieldOf(value, field);
    return Object.isString(text) && !String.isNullOrWhitespace(text) ? text : null;
  }
}
