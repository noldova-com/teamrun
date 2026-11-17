/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { SDKTaskNotificationMessage, SDKTaskProgressMessage, SDKTaskStartedMessage, SDKTaskUpdatedMessage } from "@anthropic-ai/claude-agent-sdk";
import { TaskEnd, TaskStart, TurnDetail } from "@noldova/teamrun.core";
import { type BackgroundTaskStatus, DetailKind, SubAgent, SubAgentStatus } from "@noldova/teamrun.protocol";

import type { IClaudeQuery } from "../../interfaces/i-claude-query.js";
import type { IClaudeSubAgent } from "../../interfaces/i-claude-sub-agent.js";
import { Resources } from "../../resources.js";
import { ClaudePlan } from "./claude-plan.js";
import type { ClaudeTurn } from "./claude-turn.js";

export class ClaudeSubAgents {
  private readonly agents: Map<string, IClaudeSubAgent> = new Map();
  private readonly tasks: Map<string, string> = new Map();
  private readonly endedTasks: Map<string, string> = new Map();
  private readonly ownedTasks: Set<string> = new Set();
  private readonly startedTasks: Set<string> = new Set();

  public static isAgentTool(name: string): boolean {
    return Resources.claudeAgentTools.includes(name);
  }

  public get hasRunning(): boolean {
    return [...this.agents.values()].some(t => t.agent.isRunning);
  }

  public of(toolUseId: string): IClaudeSubAgent | undefined {
    return this.agents.get(toolUseId);
  }

  public ofTask(taskId: string | undefined): IClaudeSubAgent | undefined {
    const toolUseId = Object.isUndefined(taskId) ? undefined : this.tasks.get(taskId);
    return Object.isUndefined(toolUseId) ? undefined : this.agents.get(toolUseId);
  }

  public async startAsync(toolUseId: string, itemId: string, input: unknown, owner: ClaudeTurn, parentItemId: string | null): Promise<void> {
    const agent = new SubAgent(toolUseId, ClaudeSubAgents.textOf(input, Resources.claudeSubagentTypeField),
      ClaudeSubAgents.textOf(input, Resources.descriptionField) ?? Resources.claudeSubAgentDescription, ClaudeSubAgents.textOf(input, Resources.modelField),
      SubAgentStatus.Running, ClaudeSubAgents.fieldOf(input, Resources.claudeRunInBackgroundField) === true);
    await this.reportAsync({ itemId, parentItemId, owner, plan: new ClaudePlan(), agent });
  }

  public async noteModelAsync(toolUseId: string, model: string): Promise<void> {
    const entry = this.agents.get(toolUseId);
    if (!Object.isUndefined(entry) && entry.agent.model !== model)
      await this.updateAsync(entry, { model });
  }

  public async noteResultAsync(toolUseId: string, isError: boolean, structured: unknown, interrupted: boolean, text: string): Promise<void> {
    const entry = this.agents.get(toolUseId);
    if (Object.isUndefined(entry))
      return;
    const status = ClaudeSubAgents.fieldOf(structured, Resources.statusField);
    if (isError)
      await this.updateAsync(entry, interrupted ? { status: SubAgentStatus.Stopped } : { status: SubAgentStatus.Failed, summary: String.isNullOrWhitespace(text) ? null : text });
    else if (status === Resources.claudeAgentCompletedStatus)
      await this.updateAsync(entry, { status: SubAgentStatus.Completed, toolUses: ClaudeSubAgents.countOf(structured, Resources.claudeTotalToolUseCountField),
        tokens: ClaudeSubAgents.countOf(structured, Resources.claudeTotalTokensField), durationMs: ClaudeSubAgents.countOf(structured, Resources.claudeTotalDurationField) });
    else if (status === Resources.claudeAgentLaunchedStatus) {
      const agentId = ClaudeSubAgents.textOf(structured, Resources.claudeAgentIdField);
      if (!Object.isNull(agentId))
        this.tasks.set(agentId, toolUseId);
      await this.updateAsync(entry, { isBackground: true });
    }
  }

  public async handleStartedAsync(message: SDKTaskStartedMessage, query: IClaudeQuery): Promise<boolean> {
    if (Resources.claudeOwnedBySubAgentField in message && message[Resources.claudeOwnedBySubAgentField] === true) {
      this.ownedTasks.add(message.task_id);
      return true;
    }
    const entry = Object.isUndefined(message.tool_use_id) ? undefined : this.agents.get(message.tool_use_id);
    if (Object.isUndefined(entry))
      return false;
    this.tasks.set(message.task_id, message.tool_use_id!);
    if (!this.startedTasks.has(message.task_id)) {
      this.startedTasks.add(message.task_id);
      await entry.owner.turnListener.onTaskStartedAsync(new TaskStart(message.task_id, entry.agent.description, () => query.stopTask(message.task_id), message.tool_use_id));
    }
    if (message.is_backgrounded === true && !entry.agent.isBackground)
      await this.updateAsync(entry, { isBackground: true });
    return true;
  }

  public async handleUpdatedAsync(message: SDKTaskUpdatedMessage): Promise<boolean> {
    if (this.ownedTasks.has(message.task_id))
      return true;
    const entry = this.ofTask(message.task_id);
    if (Object.isUndefined(entry))
      return false;
    if (message.patch.is_backgrounded === true && !entry.agent.isBackground)
      await this.updateAsync(entry, { isBackground: true });
    return true;
  }

  public async handleProgressAsync(message: SDKTaskProgressMessage): Promise<void> {
    const entry = this.ofTask(message.task_id);
    if (!Object.isUndefined(entry) && entry.agent.isRunning)
      await this.updateAsync(entry, { toolUses: message.usage.tool_uses, tokens: message.usage.total_tokens, durationMs: message.usage.duration_ms,
        summary: message.summary ?? null });
  }

  public endOwnedTask(taskId: string): boolean {
    return this.ownedTasks.delete(taskId);
  }

  public async handleNotificationAsync(message: SDKTaskNotificationMessage): Promise<string | null> {
    const entry = this.ofTask(message.task_id);
    if (Object.isUndefined(entry)) {
      const description = this.endedTasks.get(message.task_id) ?? null;
      this.endedTasks.delete(message.task_id);
      return description;
    }
    this.tasks.delete(message.task_id);
    await this.endTaskAsync(entry, message.task_id, Resources.claudeTaskStatuses[message.status]);
    const current = this.runningOf(entry);
    if (!Object.isUndefined(current))
      await this.updateAsync(current, { status: Resources.claudeSubAgentStatuses[message.status], toolUses: message.usage?.tool_uses ?? current.agent.toolUses,
        tokens: message.usage?.total_tokens ?? current.agent.tokens, durationMs: message.usage?.duration_ms ?? current.agent.durationMs, summary: message.summary });
    return entry.agent.description;
  }

  public async stopAllAsync(): Promise<void> {
    for (const entry of [...this.agents.values()]) {
      const current = this.runningOf(entry);
      if (!Object.isUndefined(current))
        await this.updateAsync(current, { status: SubAgentStatus.Stopped });
    }
  }

  public async noteUnaskedAsync(entry: IClaudeSubAgent, toolName: string, toolUseId: string): Promise<void> {
    await entry.owner.turnListener.onDetailAsync(new TurnDetail(DetailKind.Note, Resources.formatClaudeSubAgentUnasked(toolName), null,
      [entry.itemId, toolUseId].join(Resources.requestIdSeparator), entry.itemId));
  }

  private runningOf(entry: IClaudeSubAgent): IClaudeSubAgent | undefined {
    return [...this.agents.values()].find(t => t.itemId === entry.itemId && t.agent.isRunning);
  }

  private async endTaskAsync(entry: IClaudeSubAgent, taskId: string, status: BackgroundTaskStatus): Promise<void> {
    if (this.startedTasks.delete(taskId))
      await entry.owner.turnListener.onTaskEndedAsync(new TaskEnd(taskId, status));
  }

  private async updateAsync(entry: IClaudeSubAgent, changes: Parameters<SubAgent["with"]>[0]): Promise<void> {
    await this.reportAsync({ ...entry, agent: entry.agent.with(changes) });
  }

  private async reportAsync(entry: IClaudeSubAgent): Promise<void> {
    const toolUseId = entry.agent.toolUseId!;
    if (entry.agent.isRunning)
      this.agents.set(toolUseId, entry);
    else {
      this.agents.delete(toolUseId);
      for (const [task, id] of this.tasks)
        if (id === toolUseId) {
          this.tasks.delete(task);
          this.endedTasks.set(task, entry.agent.description);
          await this.endTaskAsync(entry, task, Resources.subAgentTaskStatuses[entry.agent.status]);
        }
    }
    await entry.owner.turnListener.onDetailAsync(new TurnDetail(DetailKind.SubAgent, entry.agent.description, entry.agent.toJson(), entry.itemId, entry.parentItemId));
  }

  private static fieldOf(value: unknown, field: string): unknown {
    return Object.isObject(value) && !Array.isArray(value) ? (value as Readonly<Record<string, unknown>>)[field] : undefined;
  }

  private static textOf(value: unknown, field: string): string | null {
    const text = ClaudeSubAgents.fieldOf(value, field);
    return Object.isString(text) && !String.isNullOrWhitespace(text) ? text : null;
  }

  private static countOf(value: unknown, field: string): number | null {
    const count = ClaudeSubAgents.fieldOf(value, field);
    return Number.isInteger(count) && (count as number) >= 0 ? count as number : null;
  }
}
