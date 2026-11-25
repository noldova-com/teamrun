/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";

import type { PermissionMode, PermissionResult, SDKAssistantMessage, SDKMessage, SDKPartialAssistantMessage, SDKResultMessage, SDKSystemMessage, SDKUserMessage,
  SlashCommand } from "@anthropic-ai/claude-agent-sdk";

import "@noldova/context.core";
import { type ILog, type ITimer, type ITurnListener, NodeTimer, Resources as CoreResources, TimeoutException, TurnDetail, type TurnTools, TurnWake, type WakeTurn }
  from "@noldova/teamrun.core";
import { DetailKind, Resources as ProtocolResources } from "@noldova/teamrun.protocol";

import type { IClaudeQuery } from "../../interfaces/i-claude-query.js";
import { TailBuffer } from "../../models/tail-buffer.js";
import { Resources } from "../../resources.js";
import { Deadline } from "../deadline.js";
import { DeltaStream } from "../delta-stream.js";
import { FailureDescriber } from "../failure-describer.js";
import { ClaudeInput } from "./claude-input.js";
import { ClaudeModes } from "./claude-modes.js";
import { ClaudePlan } from "./claude-plan.js";
import { ClaudePrompt } from "./claude-prompt.js";
import { ClaudeSubAgents } from "./claude-sub-agents.js";
import { ClaudeTasks } from "./claude-tasks.js";
import { ClaudeTurn } from "./claude-turn.js";

export class ClaudeChat {
  public readonly key: string;
  public readonly input: ClaudeInput = new ClaudeInput();
  public readonly abort: AbortController = new AbortController();
  public readonly stderr: TailBuffer = new TailBuffer(Resources.maximumStderrChunks);
  public readonly tasks: ClaudeTasks;
  public readonly plan: ClaudePlan;
  public readonly subAgents: ClaudeSubAgents;
  private readonly wait: number;
  private readonly streamInterval: number;
  private readonly wakeGrace: number;
  private readonly onClosed: (chat: ClaudeChat) => void;
  private readonly live: Set<string> = new Set();
  private query: IClaudeQuery | null = null;
  private pumping: boolean = false;
  private pending: { turn: ClaudeTurn; uuid: string; done: PromiseWithResolvers<boolean>; environment: Readonly<Record<string, string>>;
    interrupted: () => void; held: SDKUserMessage | null; taken: boolean; } | null = null;
  private replying: ClaudeTurn | null = null;
  private applied: ClaudeTurn | null = null;
  private waking: boolean = false;
  private waker: { turn: ClaudeTurn; wake: WakeTurn } | null = null;
  private rateLimit: Extract<SDKMessage, { type: "rate_limit_event" }> | null = null;
  private ended: TurnWake[] = [];
  private notified: boolean = false;
  private stamped: boolean = false;
  private init: SDKSystemMessage | null = null;
  private commands: readonly string[] | null = null;
  private aliases: ReadonlyMap<string, readonly string[]> = new Map();
  private listener: ITurnListener | null = null;
  private currentSessionId: string | null = null;
  private closed: boolean = false;
  private retired: boolean = false;
  private graceTimer: NodeJS.Timeout | null = null;
  private reserved: boolean = false;
  private refused: boolean = false;
  private mode: PermissionMode | null = null;
  private leaveTo: PermissionMode | null = null;
  private readonly requestTimeout: number;
  private readonly token: string | null;
  private readonly log: ILog | null;
  private readonly ownServersStarted: ((query: IClaudeQuery, named: readonly string[]) => Promise<boolean>) | null;
  private readonly silence: Deadline;
  private readonly idle: Deadline;
  private readonly timer: ITimer;
  private compaction: Deadline | null = null;
  private compactsWhenIdle: boolean = false;
  private compactable: ITurnListener | null = null;
  private compactBy: number = 0;
  private stopping: Promise<void> | null = null;
  private stoppedAgents: Promise<void> = Promise.resolve();
  private compacting: Promise<void> = Promise.resolve();

  public constructor(key: string, wait: number, streamInterval: number, wakeGrace: number, onClosed: (chat: ClaudeChat) => void,
    tasks: ClaudeTasks = new ClaudeTasks(), plan: ClaudePlan = new ClaudePlan(), subAgents: ClaudeSubAgents = new ClaudeSubAgents(), token: string | null = null,
    log: ILog | null = null, requestTimeout: number = Resources.claudeUsageTimeout,
    ownServersStarted: ((query: IClaudeQuery, named: readonly string[]) => Promise<boolean>) | null = null, timer: ITimer = new NodeTimer(),
    silenceLimit: number = Resources.silenceLimit, idleLimit: number = Resources.idleLimit) {
    this.key = key;
    this.requestTimeout = requestTimeout;
    this.token = token;
    this.log = log;
    this.ownServersStarted = ownServersStarted;
    this.wait = wait;
    this.streamInterval = streamInterval;
    this.wakeGrace = wakeGrace;
    this.onClosed = onClosed;
    this.tasks = tasks;
    this.plan = plan;
    this.subAgents = subAgents;
    this.silence = new Deadline(timer, silenceLimit, () => void this.stop());
    this.idle = new Deadline(timer, idleLimit, () => this.close());
    this.timer = timer;
    tasks.watch(() => this.silence.extend());
  }

  public get sessionId(): string | null {
    return this.currentSessionId;
  }

  public get isClosed(): boolean {
    return this.closed || !Object.isNull(this.stopping);
  }

  public get closing(): Promise<void> {
    return this.stopping ?? Promise.resolve();
  }

  public get isServed(): boolean {
    return !Object.isNull(this.token);
  }

  public adopts(tools: TurnTools | null): boolean {
    if (this.refused)
      return false;
    return Object.isNull(this.token) ? Object.isNullOrUndefined(tools?.endpoint) : tools?.adopt(this.token) === true;
  }

  public get isPlanning(): boolean {
    return this.mode === Resources.planPermissionMode;
  }

  public allowIdleCompaction(allowed: boolean): void {
    this.compactsWhenIdle = allowed;
  }

  public get isRunningTasks(): boolean {
    return this.tasks.hasRunning || this.subAgents.hasRunning || this.live.size > 0;
  }

  public get isBusy(): boolean {
    return !Object.isNull(this.pending);
  }

  public attach(query: IClaudeQuery, mode: PermissionMode): void {
    this.query = query;
    this.mode = mode;
    this.rateLimit = null;
  }

  public async setPermissionMode(mode: PermissionMode): Promise<void> {
    this.leaveTo = mode;
    await this.switchTo(mode);
    this.leaveTo = null;
  }

  public async returnToPlan(): Promise<void> {
    this.leaveTo = this.mode ?? this.leaveTo;
    await this.switchTo(Resources.planPermissionMode);
  }

  public async ensureMode(mode: PermissionMode | null, listener: ITurnListener): Promise<void> {
    if (Object.isNull(mode))
      return;
    this.leaveTo = mode;
    try {
      if (this.mode !== mode)
        await this.switchTo(mode);
      this.leaveTo = null;
    }
    catch (error) {
      await listener.onDetailAsync(new TurnDetail(DetailKind.Note, Resources.formatClaudePlanModeStayed(FailureDescriber.describe(error)), null, null));
    }
  }

  public async prepare(environment: Readonly<Record<string, string>>, listener: ITurnListener): Promise<boolean> {
    this.reserved = true;
    this.clearGrace();
    this.keepOpen();
    if (this.waking)
      return true;
    const query = this.query!;
    try {
      await query.applyFlagSettings({ env: await this.checkedSenderOf(query, environment, listener) });
      return true;
    }
    catch {
      return false;
    }
  }

  public async listedCommands(signal: AbortSignal): Promise<readonly string[]> {
    const query = this.query;
    if (!Object.isNull(this.commands) || Object.isNull(query))
      return this.commands ?? [];
    const waited = new AbortController();
    try {
      const listed = await Promise.race([query.supportedCommands(),
        this.timer.delayAsync(this.requestTimeout, AbortSignal.any([signal, waited.signal])).then(() => null, () => null)]);
      if (Object.isNull(this.commands) && !Object.isNull(listed))
        this.commands = this.namesOf(listed);
    }
    catch { }
    finally {
      waited.abort();
    }
    return this.commands ?? [];
  }

  public endUnused(): void {
    this.reserved = false;
    if (Object.isNull(this.currentSessionId))
      this.close();
    else
      this.closeWhenIdle();
  }

  public async setSender(query: IClaudeQuery, environment: Readonly<Record<string, string>>, listener: ITurnListener): Promise<void> {
    await this.applySender(query, environment, listener);
  }

  public async run(turn: ClaudeTurn, message: SDKUserMessage, environment: Readonly<Record<string, string>>, interrupted: () => void): Promise<void> {
    const query = this.query!;
    const done = Promise.withResolvers<boolean>();
    const pending = { turn, uuid: message.uuid!, done, environment, interrupted, held: null as SDKUserMessage | null, taken: false };
    this.pending = pending;
    this.reserved = false;
    this.clearGrace();
    if (!this.pumping) {
      this.pumping = true;
      void this.pump(query);
    }
    if (!Object.isNull(this.init))
      await turn.handle(this.init, query);
    if (this.closed)
      await this.settleAsync(Resources.claudeNoResult);
    else if (this.waking && turn.isInterrupted)
      await this.settleAsync(null);
    else if (this.waking)
      pending.held = message;
    else {
      this.listener = turn.turnListener;
      this.applied = turn;
      this.rateLimit = null;
      this.input.push(message);
      if (turn.isInterrupted)
        this.stopPending();
    }
    if (await done.promise)
      await turn.finishAsync();
  }

  public async decide(toolName: string, input: Record<string, unknown>, signal: AbortSignal, toolUseId: string, agentId?: string): Promise<PermissionResult> {
    const subAgent = this.subAgents.ofTask(agentId);
    const owner = subAgent?.owner;
    const asked = new Set<ClaudeTurn>();
    for (;;) {
      const turn = this.askingTurn(owner, asked);
      if (Object.isUndefined(turn)) {
        if (!Object.isUndefined(subAgent))
          await this.subAgents.noteUnaskedAsync(subAgent, toolName, toolUseId);
        return { behavior: Resources.denyBehavior, message: Object.isUndefined(subAgent) ? Resources.claudeDenied : Resources.claudeSubAgentUnasked };
      }
      asked.add(turn);
      try {
        return await turn.decide(toolName, input, signal, toolUseId, subAgent?.agent.description ?? null, owner ?? null);
      }
      catch (error) {
        if (Object.isUndefined(subAgent) || signal.aborted || !FailureDescriber.isClosedRun(error))
          throw error;
      }
    }
  }

  public interrupt(turn: ClaudeTurn): void {
    turn.markInterrupted();
    const pending = this.pending;
    if (pending?.turn !== turn)
      return;
    if (!Object.isNull(pending.held))
      this.settleHeld(pending);
    else if (this.replying === turn || (Object.isNull(this.replying) && !this.waking && this.applied === turn))
      this.stopPending();
  }

  public stop(): Promise<void> {
    this.stopping ??= this.end();
    return this.stopping;
  }

  private async end(): Promise<void> {
    await this.closeStepAsync(this.tasks.endAllAsync(this.wait, this.log));
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([this.query?.interrupt(), new Promise<void>(resolve => timer = setTimeout(resolve, this.wait))]);
    }
    catch { }
    clearTimeout(timer);
    this.abort.abort();
    this.close();
  }

  public retire(): void {
    this.retired = true;
    this.closeWhenIdle();
  }

  public close(): void {
    if (this.closed)
      return;
    this.closed = true;
    this.clearGrace();
    this.keepOpen();
    this.stoppedAgents = this.closeStepAsync(this.subAgents.stopAllAsync());
    this.input.end();
    this.onClosed(this);
    try {
      this.query?.close();
    }
    catch { }
  }

  private askingTurn(owner: ClaudeTurn | undefined, asked: ReadonlySet<ClaudeTurn>): ClaudeTurn | undefined {
    return [owner, this.waking ? this.waker?.turn : this.pending?.turn].find(t => !Object.isUndefined(t) && (t === owner || Object.isNull(t.outcome)) && !asked.has(t));
  }

  private async pump(query: IClaudeQuery): Promise<void> {
    let failure: string | null = null;
    try {
      for await (const message of query)
        await this.route(message, query);
      await this.compacting;
    }
    catch (error) {
      failure = this.describe(error);
    }
    this.close();
    await this.stoppedAgents;
    await this.closeStepAsync(this.settleAsync(failure));
    await this.closeStepAsync(this.endWakeAsync(failure));
    await this.closeStepAsync(this.tasks.endAllAsync(this.wait, this.log));
  }

  private async closeStepAsync(step: Promise<void>): Promise<void> {
    try {
      await step;
    }
    catch (error) {
      this.log?.write(Resources.formatClaudeChatCloseFailed(this.currentSessionId, FailureDescriber.describe(error)));
    }
  }

  private async route(message: SDKMessage, query: IClaudeQuery): Promise<void> {
    await this.compacting;
    this.silence.extend();
    if (message.type === Resources.systemMessageType) {
      await this.routeSystem(message, query);
      this.closeWhenIdle();
      return;
    }
    if (message.type === Resources.rateLimitEventType) {
      const bound = this.waking ? this.waker?.turn : this.replying;
      if (Object.isNullOrUndefined(bound))
        this.rateLimit = message;
      else
        await bound.handle(message, query);
      return;
    }
    if (message.type !== Resources.streamEventType && message.type !== Resources.assistantMessageType && message.type !== Resources.userMessageType
      && message.type !== Resources.resultMessageType)
      return;
    this.clearGrace();
    const parent = message.type === Resources.resultMessageType ? null : message.parent_tool_use_id;
    if (!Object.isNull(parent)) {
      await this.subAgents.of(parent)?.owner.handle(message, query);
      return;
    }
    const wasWaking = this.waking;
    this.bind(message.type === Resources.userMessageType ? [] : ClaudeChat.stampsOf(message));
    if (this.waking && !wasWaking)
      await this.startWake(query);
    else if (!Object.isNull(this.replying) && this.applied !== this.replying)
      await this.resume(query);
    const turn = this.replying ?? this.waker?.turn ?? null;
    const rateLimit = this.rateLimit;
    this.rateLimit = null;
    if (!Object.isNull(turn) && !Object.isNull(rateLimit))
      await turn.handle(rateLimit, query);
    if (!Object.isNull(turn))
      await turn.handle(message, query);
    if (message.type !== Resources.resultMessageType)
      return;
    this.currentSessionId = message.session_id;
    this.compactable = this.compactsWhenIdle && turn?.compactsWhenIdle === true ? turn.turnListener : null;
    this.compactBy = this.timer.now() + Resources.idleCompactionDelay;
    if (this.waking)
      await this.endWakeAsync(null);
    else if (!Object.isNull(turn))
      await this.settleAsync(null);
    this.replying = null;
    this.waking = false;
    this.ended = [];
    this.rateLimit = null;
    if (!Object.isNullOrUndefined(this.pending?.held))
      await this.release(query);
    this.closeWhenIdle();
  }

  private async routeSystem(message: Extract<SDKMessage, { type: "system" }>, query: IClaudeQuery): Promise<void> {
    if (message.subtype === Resources.taskStartedSubtype) {
      if (await this.subAgents.handleStartedAsync(message, query))
        return;
      const listener = this.waking && Object.isNull(this.waker) ? null : this.listener;
      if (!Object.isNull(listener))
        await this.tasks.handleStartedAsync(message, query, listener);
      return;
    }
    if (message.subtype === Resources.taskUpdatedSubtype) {
      if (!await this.subAgents.handleUpdatedAsync(message))
        await this.tasks.handleUpdatedAsync(message, query);
      return;
    }
    if (message.subtype === Resources.taskProgressSubtype) {
      await this.subAgents.handleProgressAsync(message);
      return;
    }
    if (message.subtype === Resources.taskNotificationSubtype) {
      if (this.subAgents.endOwnedTask(message.task_id))
        return;
      this.ended.push(new TurnWake(message.task_id, await this.subAgents.handleNotificationAsync(message) ?? await this.tasks.handleNotificationAsync(message)));
      this.notified = true;
      return;
    }
    if (message.subtype === Resources.sessionStateChangedSubtype) {
      await this.followAsync(message.state);
      return;
    }
    if (message.subtype === Resources.backgroundTasksChangedSubtype) {
      this.live.clear();
      for (const task of message.tasks.filter(t => t.ambient !== true))
        this.live.add(task.task_id);
      return;
    }
    if (message.subtype === Resources.commandsChangedSubtype) {
      this.commands = this.namesOf(message.commands);
      return;
    }
    if (message.subtype === Resources.initSubtype) {
      this.init = message;
      this.commands = message.slash_commands.map(t => ClaudeChat.nameOf(t)).flatMap(t => [t, ...this.aliases.get(t) ?? []]);
      this.currentSessionId = message.session_id;
    }
    await (this.waking ? this.waker?.turn : this.pending?.turn)?.handle(message, query);
  }

  private async followAsync(state: string): Promise<void> {
    const pending = this.pending;
    if (Object.isNull(pending) || !Object.isNull(pending.held))
      return;
    if (state === Resources.runningSessionState)
      pending.taken = true;
    else if (state === Resources.idleSessionState && pending.taken) {
      await pending.turn.endWithAsync(Resources.claudeAnsweredInOwnTurn);
      await this.settleAsync(null);
    }
  }

  private async startWake(query: IClaudeQuery): Promise<void> {
    if (!Object.isNull(this.pending) && Object.isNull(this.pending.held))
      this.pending.taken = true;
    const ended = this.ended.length === 1 ? this.ended.at(0) : undefined;
    const wake = (Object.isNull(this.stopping) ? await this.listener?.onWakeAsync(ended ?? new TurnWake(null, null)) : null) ?? null;
    this.ended = [];
    this.notified = false;
    this.keepOpen();
    if (Object.isNull(wake) || !Object.isNull(this.stopping)) {
      if (!Object.isNull(wake))
        await this.endUnsentWakeAsync(wake);
      this.interruptQuery();
      return;
    }
    const planning = this.isPlanning;
    const asked = Object.isNull(wake.mode) ? null : ClaudeModes.of(wake.mode);
    const left = wake.planFirst ? asked ?? (planning ? this.leaveTo : this.mode ?? this.leaveTo) : null;
    const turn = this.beginWake(wake, Object.isNull(left) ? null : () => this.setPermissionMode(left));
    const token = this.token;
    if (!Object.isNull(token))
      await wake.onToolsAsync(async t => {
        if (!t.adopt(token))
          await this.refuseAsync(wake);
      });
    await turn.deliverNotesAsync();
    if (wake.planFirst && !planning)
      await this.planWake(turn, wake);
    else if (!wake.planFirst)
      await this.ensureMode(asked ?? this.leaveTo, wake);
    await this.applySender(query, wake.environment, wake);
    if (!Object.isNull(this.init))
      await turn.handle(this.init, query);
  }

  private async switchTo(mode: PermissionMode): Promise<void> {
    const query = this.query;
    if (Object.isNull(query))
      return;
    const timeout = Promise.withResolvers<never>();
    const timer = setTimeout(() => {
      this.mode = null;
      timeout.reject(new TimeoutException(Resources.formatClaudeModeSwitchTimedOut(mode, this.requestTimeout)));
    }, this.requestTimeout);
    try {
      await Promise.race([query.setPermissionMode(mode), timeout.promise]);
    }
    finally {
      clearTimeout(timer);
    }
    this.mode = mode;
  }

  private async planWake(turn: ClaudeTurn, wake: WakeTurn): Promise<void> {
    try {
      await this.returnToPlan();
    }
    catch (error) {
      await wake.onDetailAsync(new TurnDetail(DetailKind.Note, Resources.formatClaudeWakePlanModeRefused(FailureDescriber.describe(error)), null, null));
      turn.markInterrupted();
      this.interruptQuery();
    }
  }

  private async refuseAsync(wake: WakeTurn): Promise<void> {
    this.refused = true;
    this.log?.write(Resources.formatClaudeWakeTokenRefused(this.currentSessionId));
    await wake.onDetailAsync(new TurnDetail(DetailKind.Note, Resources.claudeWakeToolsRefused, null, null));
  }

  private async release(query: IClaudeQuery): Promise<void> {
    const pending = this.pending!;
    const message = pending.held!;
    pending.held = null;
    this.listener = pending.turn.turnListener;
    this.applied = pending.turn;
    await this.applySender(query, pending.environment, pending.turn.turnListener);
    this.rateLimit = null;
    if (!this.closed)
      this.input.push(message);
  }

  private async resume(query: IClaudeQuery): Promise<void> {
    const pending = this.pending!;
    this.applied = pending.turn;
    this.listener = pending.turn.turnListener;
    if (pending.turn.isInterrupted)
      this.stopPending();
    await this.applySender(query, pending.environment, pending.turn.turnListener);
  }

  private senderOf(environment: Readonly<Record<string, string>>): Record<string, string> {
    return Object.fromEntries(Object.entries(environment).filter(([name]) => !this.isServed || name !== ProtocolResources.senderTokenVariable));
  }

  private async checkedSenderOf(query: IClaudeQuery, environment: Readonly<Record<string, string>>, listener: ITurnListener): Promise<Record<string, string>> {
    const sender = this.senderOf(environment);
    if (!Object.hasOwn(sender, ProtocolResources.senderTokenVariable) || Object.isNull(this.ownServersStarted) || await this.ownServersStarted(query, this.init?.mcp_servers.map(t => t.name) ?? []))
      return sender;
    await listener.onDetailAsync(new TurnDetail(DetailKind.Note, Resources.claudeSenderLeftOut, null, null));
    return { ...sender, [ProtocolResources.senderTokenVariable]: String.empty };
  }

  private async applySender(query: IClaudeQuery, environment: Readonly<Record<string, string>>, listener: ITurnListener): Promise<void> {
    try {
      await query.applyFlagSettings({ env: await this.checkedSenderOf(query, environment, listener) });
    }
    catch (error) {
      await listener.onDetailAsync(new TurnDetail(DetailKind.Note, Resources.formatClaudeSenderRefused(FailureDescriber.describe(error)), null, null));
    }
  }

  private stopPending(): void {
    this.interruptQuery();
    this.pending!.interrupted();
  }

  private interruptQuery(): void {
    void this.query?.interrupt().catch(() => undefined);
  }

  private async endWakeAsync(failure: string | null): Promise<void> {
    const waker = this.waker;
    if (Object.isNull(waker))
      return;
    this.waker = null;
    this.rateLimit = null;
    if (!Object.isNull(failure))
      waker.turn.fail(failure);
    try {
      await waker.turn.finishAsync();
    }
    catch (error) {
      waker.turn.fail(FailureDescriber.describe(error));
      throw error;
    }
    finally {
      waker.wake.end(waker.turn.toResult());
    }
  }

  private namesOf(commands: readonly SlashCommand[]): readonly string[] {
    this.aliases = new Map(commands.map(t => [ClaudeChat.nameOf(t.name), (t.aliases ?? []).map(u => ClaudeChat.nameOf(u))]));
    return [...this.aliases].flatMap(([name, aliases]) => [name, ...aliases]);
  }

  private static nameOf(command: string): string {
    return command.replace(Resources.acpCommandPrefixPattern, String.empty);
  }

  private static stampsOf(message: SDKAssistantMessage | SDKPartialAssistantMessage | SDKResultMessage): readonly string[] {
    return message.user_message_uuids ?? (Object.isUndefined(message.user_message_uuid) ? [] : [message.user_message_uuid]);
  }

  private bind(stamps: readonly string[]): void {
    const pending = this.pending;
    if (stamps.length > 0) {
      this.stamped = true;
      this.replying = !Object.isNull(pending) && stamps.includes(pending.uuid) ? pending.turn : null;
      this.waking = Object.isNull(this.replying);
    }
    else if (Object.isNull(this.replying) && !this.waking) {
      this.waking = this.stamped || Object.isNull(pending);
      this.replying = this.waking ? null : pending!.turn;
    }
  }

  private async settleAsync(failure: string | null): Promise<void> {
    const pending = this.pending;
    if (Object.isNull(pending))
      return;
    this.pending = null;
    if (!Object.isNull(failure))
      pending.turn.fail(failure);
    try {
      await pending.turn.finishAsync();
    }
    catch (error) {
      pending.done.reject(error);
      return;
    }
    pending.done.resolve(false);
  }

  private settleHeld(pending: { done: PromiseWithResolvers<boolean> }): void {
    this.pending = null;
    pending.done.resolve(true);
  }

  private closeWhenIdle(): void {
    if (!Object.isNull(this.pending) || this.reserved || this.waking)
      return;
    if (this.isRunningTasks) {
      this.stopIdle();
      this.silence.start();
      return;
    }
    if (!this.notified) {
      this.silence.stop();
      if (this.retired)
        this.close();
      else
        this.waitToCompact();
      return;
    }
    this.graceTimer ??= setTimeout(() => {
      this.graceTimer = null;
      this.notified = false;
      this.closeWhenIdle();
    }, this.wakeGrace);
  }

  private keepOpen(): void {
    this.silence.stop();
    this.stopIdle();
  }

  private stopIdle(): void {
    this.idle.stop();
    this.compaction?.stop();
    this.compaction = null;
  }

  private waitToCompact(): void {
    const compactable = this.compactable;
    const left = this.compactBy - this.timer.now();
    if (Object.isNull(compactable) || left <= 0)
      this.idle.start();
    else if (Object.isNull(this.compaction)) {
      this.compaction = new Deadline(this.timer, left, () => this.compactIdle(compactable));
      this.compaction.start();
    }
  }

  private compactIdle(listener: ITurnListener): void {
    this.compactable = null;
    this.compacting = this.compactIdleAsync(listener);
  }

  private async compactIdleAsync(listener: ITurnListener): Promise<void> {
    let wake: WakeTurn | null;
    try {
      wake = await listener.onWakeAsync(new TurnWake(null, null, true));
    }
    catch (error) {
      this.log?.write(Resources.formatClaudeCompactionWakeFailed(this.currentSessionId, FailureDescriber.describe(error)));
      this.closeWhenIdle();
      return;
    }
    const taken = this.closed || this.reserved || !Object.isNull(this.pending);
    if (Object.isNull(wake)) {
      if (!taken)
        this.close();
      return;
    }
    if (taken) {
      await this.endUnsentWakeAsync(wake);
      return;
    }
    this.keepOpen();
    this.waking = true;
    this.beginWake(wake, null);
    this.input.push(ClaudePrompt.of(CoreResources.compactCommand, [], randomUUID()));
  }

  private async endUnsentWakeAsync(wake: WakeTurn): Promise<void> {
    const turn = new ClaudeTurn(wake, this.currentSessionId, new DeltaStream(wake, this.streamInterval));
    await turn.endUnsentAsync(null);
    wake.end(turn.toResult());
  }

  private beginWake(wake: WakeTurn, leave: (() => Promise<void>) | null): ClaudeTurn {
    const turn = new ClaudeTurn(wake, this.currentSessionId, new DeltaStream(wake, this.streamInterval), null, this.tasks, this.requestTimeout, this.plan,
      this.subAgents, leave);
    this.waker = { turn, wake };
    this.listener = wake;
    this.applied = turn;
    wake.onInterrupt(() => {
      turn.markInterrupted();
      if (this.waker?.turn === turn)
        this.interruptQuery();
    });
    return turn;
  }

  private clearGrace(): void {
    if (Object.isNull(this.graceTimer))
      return;
    clearTimeout(this.graceTimer);
    this.graceTimer = null;
  }

  private describe(error: unknown): string {
    const description = FailureDescriber.describe(error);
    const stderr = this.stderr;
    return stderr.isEmpty ? description : `${description}${Resources.lineSeparator}${Resources.stderrHeading}${Resources.lineSeparator}${stderr.toString()}`;
  }
}
