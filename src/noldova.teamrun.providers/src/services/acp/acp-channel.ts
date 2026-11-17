/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonReader, JsonValue } from "@noldova/context.json";
import type { ITimer, ITurnListener, TurnResult, TurnWake, WakeTurn } from "@noldova/teamrun.core";
import type { ObservedSettings } from "@noldova/teamrun.protocol";

import type { IAcpClientListener } from "../../interfaces/i-acp-client-listener.js";
import { Resources } from "../../resources.js";
import type { AcpCommands } from "./acp-commands.js";
import { AcpTasks } from "./acp-tasks.js";
import type { AcpTerminals } from "./acp-terminals.js";
import type { AcpTurn } from "./acp-turn.js";

export class AcpChannel implements IAcpClientListener {
  private readonly turn: AcpTurn;
  private readonly listener: ITurnListener | null;
  private readonly timer: ITimer;
  private readonly wakeGrace: number;
  private readonly createTurn: (wake: WakeTurn, signal: AbortSignal) => Promise<AcpTurn>;
  private readonly cancel: (sessionId: string) => void;
  private readonly resultOf: (stopReason: string, sessionId: string, observed: ObservedSettings) => TurnResult;
  private readonly providerName: string;
  private readonly endTree: (processId: number, startedBy: number) => Promise<void>;
  private readonly cancelSubAgent: (subAgentId: string) => Promise<boolean>;
  private readonly idle: PromiseWithResolvers<void> = Promise.withResolvers<void>();
  private readonly expected: Map<string, { wake: TurnWake; waited: AbortController }> = new Map();
  private tasks: AcpTasks | null = null;
  private sessionId: string | null = null;
  private observed: ObservedSettings | null = null;
  private waking: { promptId: string; turn: AcpTurn; target: WakeTurn } | null = null;
  private released: boolean = false;
  private woken: AcpTurn[] = [];
  private readonly commands: AcpCommands;
  private readonly terminals: AcpTerminals | null;

  public constructor(turn: AcpTurn, listener: ITurnListener | null, timer: ITimer, wakeGrace: number, createTurn: (wake: WakeTurn, signal: AbortSignal) => Promise<AcpTurn>,
    cancel: (sessionId: string) => void, resultOf: (stopReason: string, sessionId: string, observed: ObservedSettings) => TurnResult,
    providerName: string, endTree: (processId: number, startedBy: number) => Promise<void>, cancelSubAgent: (subAgentId: string) => Promise<boolean>,
    commands: AcpCommands, terminals: AcpTerminals | null = null) {
    this.turn = turn;
    this.listener = listener;
    this.timer = timer;
    this.wakeGrace = wakeGrace;
    this.createTurn = createTurn;
    this.cancel = cancel;
    this.resultOf = resultOf;
    this.providerName = providerName;
    this.endTree = endTree;
    this.cancelSubAgent = cancelSubAgent;
    this.commands = commands;
    this.terminals = terminals;
  }

  public get isIdle(): boolean {
    return (this.tasks?.isIdle ?? true) && (this.terminals?.isIdle ?? true) && Object.isNull(this.waking) && this.expected.size === 0 && !this.turns.some(t => t.keepsSubAgents);
  }

  public async releaseAsync(): Promise<void> {
    this.released = true;
    await this.terminals?.followRunningAsync();
    this.settle();
  }

  public async whenIdle(): Promise<void> {
    await this.releaseAsync();
    await this.idle.promise;
  }

  public follow(sessionId: string, observed: ObservedSettings): void {
    this.sessionId = sessionId;
    this.observed = observed;
    this.terminals?.begin(sessionId, () => this.settle(), this.idle.reject);
    if (Object.isNull(this.listener))
      return;
    this.tasks = new AcpTasks(this.listener, sessionId, this.providerName, this.timer, this.endTree, t => this.expect(`${Resources.xaiWakePromptPrefix}${t.taskId}`, t));
    this.keep(this.turn);
  }

  public async stopTasks(): Promise<void> {
    await Promise.all([this.tasks?.stopAll(), this.terminals?.stopAll(), ...this.turns.map(t => t.stopSubAgents())]);
  }

  public async endAsync(): Promise<void> {
    await this.tasks?.endAllAsync();
    this.terminals?.endAll();
    for (const expected of this.expected.values())
      expected.waited.abort();
    this.expected.clear();
    const waking = this.waking;
    this.waking = null;
    if (!Object.isNull(waking)) {
      await waking.turn.finishAsync();
      waking.target.end(this.resultOf(Resources.acpCancelled, this.sessionId!, this.observed!));
    }
    for (const turn of this.turns)
      await turn.endSubAgentsAsync();
    this.settle();
  }

  public async onNotificationAsync(method: string, params: JsonReader): Promise<void> {
    this.commands.note(method, params);
    await this.terminals?.noteAsync(method, params);
    if (await this.tasks?.handleAsync(method, params) === true) {
      this.settle();
      return;
    }
    const keeper = this.turns.find(t => t.owns(method, params));
    if (!Object.isUndefined(keeper)) {
      await keeper.onNotificationAsync(method, params);
      return;
    }
    const promptId = AcpChannel.promptIdOf(params);
    const waking = this.waking ?? (Object.isNull(promptId) ? null : await this.wakeAsync(promptId));
    if (Object.isNull(waking) || (promptId !== waking.promptId && (this.turn.isActive || !Object.isNull(promptId)))) {
      await this.turn.onNotificationAsync(method, params);
      return;
    }
    await waking.turn.onNotificationAsync(method, params);
    if (Resources.xaiSessionNotificationMethods.includes(method) && promptId === waking.promptId
      && params.readObject(Resources.acpUpdateField).readOptionalString(Resources.acpSessionUpdateField) === Resources.xaiTurnCompleted)
      await this.finishWakeAsync(params.readObject(Resources.acpUpdateField).readOptionalString(Resources.xaiStopReasonField) ?? Resources.acpEndTurn);
  }

  public onRequest(id: string, method: string, params: JsonReader): Promise<JsonValue> {
    if (!Object.isNull(this.terminals) && this.terminals.handles(method))
      return this.terminals.request(method, params);
    return (this.turn.isActive || Object.isNull(this.waking) ? this.turn : this.waking.turn).onRequest(id, method, params);
  }

  public onResponseAsync(method: string, result: JsonReader | null): Promise<void> {
    return this.turn.onResponseAsync(method, result);
  }

  public async onExitAsync(): Promise<void> {
    await this.turn.onExitAsync();
    await this.endAsync();
  }

  private get turns(): AcpTurn[] {
    return [this.turn, ...this.woken];
  }

  private keep(turn: AcpTurn): void {
    turn.keepSubAgents(t => this.cancelSubAgent(t), t => {
      if (!Object.isNull(t))
        this.expect(`${Resources.xaiSubAgentWakePromptPrefix}${t.taskId}`, t);
      this.settle();
    });
  }

  private expect(promptId: string, wake: TurnWake): void {
    const waited = new AbortController();
    this.expected.set(promptId, { wake, waited });
    void this.timer.delayAsync(this.wakeGrace, waited.signal).then(() => {
      this.expected.delete(promptId);
      this.settle();
    }, () => undefined);
  }

  private async wakeAsync(promptId: string): Promise<{ promptId: string; turn: AcpTurn; target: WakeTurn } | null> {
    const expected = this.expected.get(promptId);
    if (Object.isUndefined(expected))
      return null;
    expected.waited.abort();
    const stopped = new AbortController();
    let waking: { promptId: string; turn: AcpTurn; target: WakeTurn } | null = null;
    try {
      const target = await this.listener!.onWakeAsync(expected.wake);
      if (!Object.isNull(target)) {
        target.onInterrupt(() => {
          stopped.abort();
          this.cancel(this.sessionId!);
        });
        waking = { promptId, turn: await this.createTurn(target, stopped.signal), target };
      }
    }
    finally {
      this.expected.delete(promptId);
    }
    if (Object.isNull(waking)) {
      this.cancel(this.sessionId!);
      this.settle();
      return null;
    }
    const { turn } = waking;
    this.waking = waking;
    await turn.beginAsync(this.sessionId!, true, this.observed!);
    this.keep(turn);
    this.woken.push(turn);
    return waking;
  }

  private async finishWakeAsync(stopReason: string): Promise<void> {
    const waking = this.waking!;
    this.waking = null;
    await waking.turn.finishAsync();
    this.woken = this.woken.filter(t => t.keepsSubAgents);
    waking.target.end(this.resultOf(stopReason, this.sessionId!, this.observed!));
    this.settle();
  }

  private settle(): void {
    if (this.released && this.isIdle)
      this.idle.resolve();
  }

  private static promptIdOf(params: JsonReader): string | null {
    const meta = params.hasField(Resources.acpMetaField) ? params.readNullableObject(Resources.acpMetaField) : null;
    const update = params.hasField(Resources.acpUpdateField) ? params.readNullableObject(Resources.acpUpdateField) : null;
    return meta?.readOptionalString(Resources.xaiPromptIdField) ?? update?.readOptionalString(Resources.xaiPromptIdSnakeField) ?? null;
  }
}
