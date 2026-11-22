/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import { type ITurnListener, TaskEnd, TaskStart, TurnDetail, TurnWake } from "@noldova/teamrun.core";
import { DetailKind, SubAgent, SubAgentStatus } from "@noldova/teamrun.protocol";

import type { IAcpSubAgent } from "../../interfaces/i-acp-sub-agent.js";
import type { IAcpSubAgentKeeper } from "../../interfaces/i-acp-sub-agent-keeper.js";
import { Resources } from "../../resources.js";

export class AcpSubAgents {
  private readonly listener: ITurnListener;
  private readonly kindId: string;
  private readonly agents: Map<string, IAcpSubAgent> = new Map();
  private readonly children: Map<string, string> = new Map();
  private readonly texts: Map<string, { readonly text: string; readonly run: number }> = new Map();
  private readonly inline: Set<string> = new Set();
  private readonly withTurn: Set<string> = new Set();
  private readonly starts: Map<string, string> = new Map();
  private readonly candidates: Map<string, readonly string[]> = new Map();
  private readonly started: Map<string, string> = new Map();
  private readonly exact: Map<string, string> = new Map();
  private readonly kept: Map<string, { readonly subAgentId: string; readonly toolCallId: string; readonly keeper: IAcpSubAgentKeeper }> = new Map();
  private readonly cancelling: Set<Promise<void>> = new Set();
  private keeper: IAcpSubAgentKeeper | null = null;

  public constructor(listener: ITurnListener, kindId: string) {
    this.listener = listener;
    this.kindId = kindId;
  }

  public static isSpawn(tool: JsonObject, kindId: string): boolean {
    return AcpSubAgents.textOf(AcpSubAgents.fieldOf(tool[Resources.acpMetaField], Resources.xaiToolMetaField), Resources.nameField) === Resources.xaiSpawnSubAgentTool
      || AcpSubAgents.isCopilotSpawn(tool, kindId) || !Object.isUndefined(AcpSubAgents.antigravitySubAgentOf(tool, kindId));
  }

  public static agentIdOf(tool: JsonObject): string | null {
    return AcpSubAgents.textOf(AcpSubAgents.fieldOf(tool[Resources.acpMetaField], Resources.copilotMetaField), Resources.copilotAgentIdField);
  }

  public static requestingSessionOf(tool: JsonObject): string | null {
    return AcpSubAgents.textOf(tool[Resources.acpMetaField], Resources.xaiRequestingSessionField);
  }

  public static readAgentOf(tool: JsonObject, kindId: string): string | null {
    return kindId === Resources.copilotKindId && tool[Resources.kindField] === Resources.copilotReadKind
      ? AcpSubAgents.textOf(tool[Resources.acpRawInputField], Resources.copilotReadAgentIdField) : null;
  }

  public static startOf(tool: JsonObject, kindId: string): string | null {
    const input = tool[Resources.acpRawInputField];
    const agent = kindId === Resources.opencodeKindId ? AcpSubAgents.textOf(input, Resources.opencodeSubAgentTypeField) : null;
    return Object.isNull(agent) ? null : Resources.formatOpencodeSubAgentStart(agent, AcpSubAgents.textOf(input, Resources.descriptionField));
  }

  public static outputOf(tool: JsonObject): string | null {
    return AcpSubAgents.textOf(tool[Resources.acpRawOutputField], Resources.contentField);
  }

  public ofChild(sessionId: string | null): IAcpSubAgent | undefined {
    const toolCallId = Object.isNull(sessionId) ? undefined : this.children.get(sessionId);
    return Object.isUndefined(toolCallId) ? undefined : this.agents.get(toolCallId);
  }

  public ofTool(tool: JsonObject): IAcpSubAgent | null | undefined {
    const agentId = AcpSubAgents.agentIdOf(tool);
    if (Object.isNull(agentId))
      return undefined;
    return this.ofChild(agentId) ?? this.link(agentId);
  }

  public get states(): string {
    return [...this.agents.values()].map(t => Resources.formatSubAgentState(t.toolCallId, t.agent.status, t.agent.isBackground, this.isKept(t)))
      .join(Resources.listSeparator);
  }

  public get isKeeping(): boolean {
    return this.kept.size > 0 || this.cancelling.size > 0;
  }

  public keep(cancel: (subAgentId: string) => Promise<boolean>, ended: (wake: TurnWake | null) => void): void {
    this.keeper = { cancel, ended };
  }

  public keepsChild(sessionId: string | null): boolean {
    const entry = this.ofChild(sessionId);
    return !Object.isUndefined(entry) && this.isKept(entry);
  }

  public keepsUpdate(kind: string, update: JsonObject): boolean {
    return Resources.xaiSubAgentUpdates.includes(kind) && this.keepsChild(AcpSubAgents.textOf(update, Resources.xaiChildSessionField));
  }

  public has(toolCallId: string): boolean {
    return this.agents.has(toolCallId);
  }

  public backgroundOf(agentId: string): IAcpSubAgent | undefined {
    const entry = this.ofChild(agentId);
    return entry?.agent.isBackground === true && entry.agent.isRunning ? entry : undefined;
  }

  public async endBackgroundAsync(entry: IAcpSubAgent, moved: readonly string[], replies: readonly string[]): Promise<void> {
    for (const reply of moved) {
      this.appendText(entry, reply);
      await this.flushTextAsync(entry);
    }
    await this.endAsync(entry, { status: SubAgentStatus.Completed, summary: replies.length === 0 ? null : replies.join(Resources.copilotRepliesSeparator) });
  }

  public speaker(): IAcpSubAgent | null | undefined {
    const running = this.running().filter(t => !t.agent.isBackground);
    return running.length === 0 ? undefined : running.length === 1 ? running[0] : null;
  }

  public async countToolAsync(entry: IAcpSubAgent): Promise<void> {
    const current = this.agents.get(entry.toolCallId)!;
    await this.updateAsync(current, { toolUses: (current.agent.toolUses ?? 0) + 1 });
  }

  public async noteToolAsync(toolCallId: string, itemId: string, tool: JsonObject, denied: boolean): Promise<void> {
    if (!this.agents.has(toolCallId)) {
      const input = tool[Resources.acpRawInputField];
      const inline = AcpSubAgents.isCopilotSpawn(tool, this.kindId);
      const antigravity = AcpSubAgents.antigravitySubAgentOf(tool, this.kindId);
      if (inline)
        this.inline.add(toolCallId);
      if (!Object.isUndefined(antigravity))
        this.withTurn.add(toolCallId);
      const type = Object.isUndefined(antigravity) ? AcpSubAgents.textOf(input, Resources.copilotAgentTypeField) : AcpSubAgents.textOf(antigravity, Resources.antigravityTypeNameField);
      const description = Object.isUndefined(antigravity) ? AcpSubAgents.textOf(input, Resources.descriptionField) : AcpSubAgents.textOf(antigravity, Resources.antigravityRoleField);
      await this.reportAsync({ toolCallId, itemId, childSessionId: null, subAgentId: null, agent: new SubAgent(toolCallId, type,
        description ?? Resources.acpSubAgentDescription, null, SubAgentStatus.Running,
        [Resources.xaiBackgroundField, Resources.xaiRunInBackgroundField].some(t => AcpSubAgents.fieldOf(input, t) === true)
          || (inline && AcpSubAgents.textOf(input, Resources.copilotModeField) === Resources.copilotBackgroundMode)) });
      this.linkStarted(toolCallId);
    }
    const entry = this.agents.get(toolCallId)!;
    const status = tool[Resources.statusField];
    const output = tool[Resources.acpRawOutputField];
    if (!entry.agent.isRunning)
      return;
    if (this.withTurn.has(toolCallId)) {
      if (denied)
        await this.endAsync(entry, { status: SubAgentStatus.Stopped });
      return;
    }
    if (status === Resources.acpFailedStatus)
      await this.endAsync(entry, { status: denied ? SubAgentStatus.Stopped : SubAgentStatus.Failed, summary: AcpSubAgents.textOf(output, Resources.messageField) });
    else if (status === Resources.acpCompletedStatus && !entry.agent.isBackground)
      await this.endAsync(entry, { status: SubAgentStatus.Completed, toolUses: AcpSubAgents.countOf(output, Resources.xaiToolCallsField),
        durationMs: AcpSubAgents.countOf(output, Resources.xaiDurationField),
        summary: AcpSubAgents.textOf(output, Resources.outputField) ?? AcpSubAgents.textOf(output, Resources.contentField) });
  }

  public async noteStartAsync(toolCallId: string, tool: JsonObject): Promise<void> {
    if (tool[Resources.titleField] !== Resources.antigravityStartSubAgentTitle)
      return;
    const known = this.starts.get(toolCallId);
    const paired = new Set(this.starts.values());
    const entry = [...this.agents.values()].filter(t => this.withTurn.has(t.toolCallId))
      .find(t => Object.isUndefined(known) ? t.agent.isRunning && !paired.has(t.toolCallId) : t.toolCallId === known);
    if (Object.isUndefined(entry))
      return;
    this.starts.set(toolCallId, entry.toolCallId);
    if (tool[Resources.statusField] === Resources.acpFailedStatus && entry.agent.isRunning)
      await this.endAsync(entry, { status: SubAgentStatus.Failed, summary: AcpSubAgents.textOf(tool, Resources.acpRawOutputField) });
  }

  public async handleAsync(kind: string, update: JsonObject): Promise<void> {
    const child = AcpSubAgents.textOf(update, Resources.xaiChildSessionField);
    if (kind === Resources.xaiSubAgentSpawned) {
      const description = AcpSubAgents.textOf(update, Resources.descriptionField);
      const waiting = [...this.agents.values()].filter(t => t.agent.isRunning && Object.isNull(t.childSessionId));
      const entry = waiting.find(t => t.agent.description === description) ?? waiting[0];
      if (Object.isNull(child) || Object.isUndefined(entry))
        return;
      this.children.set(child, entry.toolCallId);
      const agent = entry.agent;
      const subAgentId = AcpSubAgents.textOf(update, Resources.xaiSubAgentIdField) ?? child;
      await this.reportAsync({ ...entry, childSessionId: child, subAgentId, agent: new SubAgent(agent.toolUseId, AcpSubAgents.textOf(update, Resources.xaiSubAgentTypeField),
        agent.description, AcpSubAgents.textOf(update, Resources.modelField), agent.status, agent.isBackground) });
      const keeper = agent.isBackground ? this.keeper : null;
      if (!Object.isNull(keeper)) {
        this.kept.set(subAgentId, { subAgentId, toolCallId: entry.toolCallId, keeper });
        await this.listener.onTaskStartedAsync(new TaskStart(subAgentId, agent.description, () => this.stopAsync(subAgentId, entry.toolCallId, keeper), entry.toolCallId));
      }
      return;
    }
    const entry = this.ofChild(child);
    if (Object.isUndefined(entry) || !entry.agent.isRunning)
      return;
    if (kind === Resources.xaiSubAgentProgress)
      await this.updateAsync(entry, { toolUses: AcpSubAgents.countOf(update, Resources.xaiToolCallCountField), tokens: AcpSubAgents.countOf(update, Resources.xaiTokensUsedField),
        durationMs: AcpSubAgents.countOf(update, Resources.xaiDurationField) });
    else {
      const status = AcpSubAgents.textOf(update, Resources.statusField);
      const kept = this.keptOf(entry);
      const ended = await this.endAsync(entry, { status: Resources.xaiSubAgentStatuses.get(status ?? "") ?? SubAgentStatus.Failed,
        toolUses: AcpSubAgents.countOf(update, Resources.xaiToolCallsField), tokens: AcpSubAgents.countOf(update, Resources.xaiTokensUsedField),
        durationMs: AcpSubAgents.countOf(update, Resources.xaiDurationField),
        summary: AcpSubAgents.textOf(update, Resources.outputField) ?? AcpSubAgents.textOf(update, Resources.errorField) });
      if (ended)
        kept?.keeper.ended(update[Resources.xaiWillWakeField] === true ? new TurnWake(kept.subAgentId, entry.agent.description) : null);
    }
  }

  public async noteEventAsync(event: JsonObject): Promise<void> {
    const type = AcpSubAgents.textOf(event, Resources.typeField);
    const data = event[Resources.dataField];
    const agentId = AcpSubAgents.textOf(event, Resources.copilotAgentIdField);
    const toolCallId = AcpSubAgents.textOf(data, Resources.acpToolCallIdField);
    if (type === Resources.copilotSubAgentCompleted && !Object.isNull(toolCallId))
      await this.noteCompletedAsync(toolCallId, data);
    if (type !== Resources.copilotSubAgentStarted || Object.isNull(agentId) || Object.isNull(toolCallId))
      return;
    await this.noteModelAsync(toolCallId, data);
    if (this.exact.has(agentId) || [...this.exact.values()].includes(toolCallId))
      return;
    this.started.set(toolCallId, agentId);
    this.linkStarted(toolCallId);
  }

  public appendText(entry: IAcpSubAgent, text: string): void {
    const kept = this.texts.get(entry.itemId);
    this.texts.set(entry.itemId, { text: (kept?.text ?? "") + text, run: kept?.run ?? 0 });
  }

  public async flushTextAsync(entry: IAcpSubAgent): Promise<void> {
    const kept = this.texts.get(entry.itemId);
    if (Object.isUndefined(kept) || String.isNullOrWhitespace(kept.text))
      return;
    this.texts.set(entry.itemId, { text: "", run: kept.run + 1 });
    await this.listener.onDetailAsync(new TurnDetail(DetailKind.Note, kept.text, null, `${entry.itemId}${Resources.requestIdSeparator}${kept.run}`, entry.itemId));
  }

  public async endWithTurnAsync(): Promise<void> {
    for (const entry of [...this.agents.values()].filter(t => t.agent.isRunning && this.withTurn.has(t.toolCallId)))
      await this.endAsync(entry, { status: SubAgentStatus.Completed });
  }

  public async stopAllAsync(): Promise<void> {
    for (const entry of [...this.agents.values()].filter(t => t.agent.isRunning && !this.isKept(t)))
      await this.endAsync(entry, { status: SubAgentStatus.Stopped });
  }

  public async stopKept(): Promise<void> {
    await Promise.all([...this.kept.values()].map(t => this.stopAsync(t.subAgentId, t.toolCallId, t.keeper).catch(() => undefined)));
  }

  public async cancelKeptAsync(): Promise<void> {
    for (const kept of [...this.kept.values()]) {
      const cancelling: Promise<void> = kept.keeper.cancel(kept.subAgentId).then(() => undefined, () => undefined).finally(() => {
        this.cancelling.delete(cancelling);
        kept.keeper.ended(null);
      });
      this.cancelling.add(cancelling);
    }
    const claimed = [...this.agents.values()].filter(t => this.isKept(t)).map(t => this.claim(t, { status: SubAgentStatus.Stopped }));
    for (const entry of claimed)
      if (!Object.isNull(entry))
        await this.finishEndAsync(entry);
  }

  public async endAllAsync(): Promise<void> {
    this.keeper = null;
    for (const entry of [...this.agents.values()].filter(t => t.agent.isRunning))
      await this.endAsync(entry, { status: SubAgentStatus.Stopped });
  }

  private async noteModelAsync(toolCallId: string, data: JsonValue | undefined): Promise<void> {
    const entry = this.agents.get(toolCallId);
    const model = AcpSubAgents.textOf(data, Resources.modelField);
    if (!Object.isUndefined(entry) && entry.agent.isRunning && !Object.isNull(model))
      await this.updateAsync(entry, { model });
  }

  private async noteCompletedAsync(toolCallId: string, data: JsonValue | undefined): Promise<void> {
    const entry = this.agents.get(toolCallId);
    if (Object.isUndefined(entry) || !entry.agent.isRunning)
      return;
    const toolUses = AcpSubAgents.countOf(data, Resources.copilotTotalToolCallsField);
    const changes = { model: AcpSubAgents.textOf(data, Resources.modelField), toolUses: Object.isNull(toolUses) ? null : Math.max(toolUses, entry.agent.toolUses ?? 0),
      tokens: AcpSubAgents.countOf(data, Resources.totalTokensField), durationMs: AcpSubAgents.countOf(data, Resources.durationMsField) };
    if (AcpSubAgents.fieldOf(data, Resources.copilotCancelledField) === true)
      await this.endAsync(entry, { ...changes, status: SubAgentStatus.Stopped });
    else
      await this.updateAsync(entry, changes);
  }

  private isKept(entry: IAcpSubAgent): boolean {
    return !Object.isUndefined(this.keptOf(entry));
  }

  private keptOf(entry: IAcpSubAgent): { readonly subAgentId: string; readonly toolCallId: string; readonly keeper: IAcpSubAgentKeeper } | undefined {
    return Object.isNull(entry.subAgentId) ? undefined : this.kept.get(entry.subAgentId);
  }

  private async stopAsync(subAgentId: string, toolCallId: string, keeper: IAcpSubAgentKeeper): Promise<void> {
    if (await keeper.cancel(subAgentId))
      return;
    for (const entry of [...this.agents.values()].filter(t => t.toolCallId === toolCallId && this.isKept(t)))
      if (await this.endAsync(entry, { status: SubAgentStatus.Stopped }))
        keeper.ended(null);
  }

  private link(agentId: string): IAcpSubAgent | null {
    if (this.exact.size > 0 && [...this.started.values()].includes(agentId))
      return null;
    const candidates = this.candidates.get(agentId) ?? this.running().map(t => t.toolCallId);
    this.candidates.set(agentId, candidates);
    const left = candidates.map(t => this.agents.get(t)).filter((t): t is IAcpSubAgent => !Object.isUndefined(t) && Object.isNull(t.childSessionId));
    const [only] = left;
    return left.length !== 1 || Object.isUndefined(only) ? null : this.bind(only, agentId);
  }

  private linkStarted(toolCallId: string): void {
    const agentId = this.started.get(toolCallId);
    const entry = this.agents.get(toolCallId);
    if (Object.isUndefined(agentId) || Object.isUndefined(entry) || this.exact.has(agentId))
      return;
    this.started.delete(toolCallId);
    const guessed = this.ofChild(agentId);
    if (!Object.isUndefined(guessed))
      this.agents.set(guessed.toolCallId, { ...guessed, childSessionId: null });
    if (!Object.isNull(entry.childSessionId))
      this.children.delete(entry.childSessionId);
    this.exact.set(agentId, toolCallId);
    this.bind(entry, agentId);
  }

  private bind(entry: IAcpSubAgent, agentId: string): IAcpSubAgent {
    const linked = { ...entry, childSessionId: agentId };
    this.candidates.delete(agentId);
    this.children.set(agentId, linked.toolCallId);
    this.agents.set(linked.toolCallId, linked);
    return linked;
  }

  private running(): IAcpSubAgent[] {
    return [...this.agents.values()].filter(t => t.agent.isRunning && this.inline.has(t.toolCallId));
  }

  private async endAsync(entry: IAcpSubAgent, changes: Parameters<SubAgent["with"]>[0]): Promise<boolean> {
    const claimed = this.claim(entry, changes);
    if (Object.isNull(claimed))
      return false;
    await this.finishEndAsync(claimed);
    return true;
  }

  private claim(entry: IAcpSubAgent, changes: Parameters<SubAgent["with"]>[0]): { readonly ended: IAcpSubAgent; readonly taskId: string | null } | null {
    const current = this.agents.get(entry.toolCallId);
    if (Object.isUndefined(current) || !current.agent.isRunning)
      return null;
    const ended = AcpSubAgents.changed(current, changes);
    this.agents.set(ended.toolCallId, ended);
    return { ended, taskId: !Object.isNull(ended.subAgentId) && this.kept.delete(ended.subAgentId) ? ended.subAgentId : null };
  }

  private async finishEndAsync(claimed: { readonly ended: IAcpSubAgent; readonly taskId: string | null }): Promise<void> {
    await this.flushTextAsync(claimed.ended);
    await this.reportAsync(claimed.ended);
    if (!Object.isNull(claimed.taskId))
      await this.listener.onTaskEndedAsync(new TaskEnd(claimed.taskId, Resources.subAgentTaskStatuses[claimed.ended.agent.status]));
  }

  private async updateAsync(entry: IAcpSubAgent, changes: Parameters<SubAgent["with"]>[0]): Promise<IAcpSubAgent> {
    const updated = AcpSubAgents.changed(entry, changes);
    await this.reportAsync(updated);
    return updated;
  }

  private static changed(entry: IAcpSubAgent, changes: Parameters<SubAgent["with"]>[0]): IAcpSubAgent {
    return { ...entry, agent: entry.agent.with(Object.fromEntries(Object.entries(changes).filter(([, t]) => !Object.isNull(t))) as Parameters<SubAgent["with"]>[0]) };
  }

  private async reportAsync(entry: IAcpSubAgent): Promise<void> {
    this.agents.set(entry.toolCallId, entry);
    await this.listener.onDetailAsync(new TurnDetail(DetailKind.SubAgent, entry.agent.description, entry.agent.toJson(), entry.itemId));
  }

  private static isCopilotSpawn(tool: JsonObject, kindId: string): boolean {
    const input = tool[Resources.acpRawInputField];
    return kindId === Resources.copilotKindId && tool[Resources.kindField] === Resources.acpOtherKind && !Object.isNull(AcpSubAgents.textOf(input, Resources.copilotAgentTypeField))
      && !Object.isNull(AcpSubAgents.textOf(input, Resources.promptField));
  }

  private static antigravitySubAgentOf(tool: JsonObject, kindId: string): JsonValue | undefined {
    const subAgents = AcpSubAgents.fieldOf(tool[Resources.acpRawInputField], Resources.antigravitySubagentsField);
    return kindId === Resources.antigravityKindId && tool[Resources.kindField] === Resources.acpOtherKind && Array.isArray(subAgents) ? subAgents[0] : undefined;
  }

  private static fieldOf(value: JsonValue | undefined, field: string): JsonValue | undefined {
    return Object.isObject(value) && !Array.isArray(value) ? (value as JsonObject)[field] : undefined;
  }

  private static textOf(value: JsonValue | undefined, field: string): string | null {
    const text = AcpSubAgents.fieldOf(value, field);
    return Object.isString(text) && !String.isNullOrWhitespace(text) ? text : null;
  }

  private static countOf(value: JsonValue | undefined, field: string): number | null {
    const count = AcpSubAgents.fieldOf(value, field);
    return Number.isInteger(count) && (count as number) >= 0 ? count as number : null;
  }
}
