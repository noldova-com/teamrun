/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SDKTaskNotificationMessage, SDKTaskStartedMessage, SDKTaskUpdatedMessage } from "@anthropic-ai/claude-agent-sdk";

import "@noldova/context.core";
import { type ILog, type ITimer, type ITurnListener, NodeTimer, TaskEnd, TaskStart } from "@noldova/teamrun.core";
import { BackgroundTaskStatus } from "@noldova/teamrun.protocol";

import type { IClaudeQuery } from "../../interfaces/i-claude-query.js";
import { Resources } from "../../resources.js";
import { FailureDescriber } from "../failure-describer.js";
import { TaskOutputFollower } from "../task-output-follower.js";
import { TaskOutputReader } from "../task-output.reader.js";

export class ClaudeTasks {
  private readonly timer: ITimer;
  private readonly interval: number;
  private readonly commands: Map<string, string> = new Map();
  private readonly foreground: Map<string, { message: SDKTaskStartedMessage; listener: ITurnListener }> = new Map();
  private readonly running: Map<string, { command: string; toolUseId: string | undefined; stop: () => Promise<void>; listener: ITurnListener;
    follower: TaskOutputFollower | null }> = new Map();
  private activity: (() => void) | null = null;

  public constructor(timer: ITimer = new NodeTimer(), interval: number = Resources.taskOutputFollowInterval) {
    this.timer = timer;
    this.interval = interval;
  }

  public get hasRunning(): boolean {
    return this.running.size > 0;
  }

  public watch(activity: () => void): void {
    this.activity = activity;
  }

  public noteCommand(toolUseId: string, command: string): void {
    this.commands.set(toolUseId, command);
  }

  public noteResult(toolUseId: string, text: string): void {
    const path = Resources.claudeTaskOutputPattern.exec(text)?.[1];
    if (Object.isUndefined(path))
      return;
    for (const [taskId, task] of this.running) {
      if (task.toolUseId !== toolUseId || !Object.isNull(task.follower))
        continue;
      task.follower = new TaskOutputFollower(path, output => {
        this.activity?.();
        task.listener.onTaskOutput(taskId, output);
      }, this.timer, this.interval);
      task.follower.start();
    }
  }

  public async handleStartedAsync(message: SDKTaskStartedMessage, query: IClaudeQuery, listener: ITurnListener): Promise<void> {
    if (message.task_type !== Resources.claudeShellTaskType)
      return;
    if (message.is_backgrounded === true)
      await this.startAsync(message, query, listener);
    else
      this.foreground.set(message.task_id, { message, listener });
  }

  public async handleUpdatedAsync(message: SDKTaskUpdatedMessage, query: IClaudeQuery): Promise<void> {
    const started = this.foreground.get(message.task_id);
    if (Object.isUndefined(started) || message.patch.is_backgrounded !== true)
      return;
    this.foreground.delete(message.task_id);
    await this.startAsync(started.message, query, started.listener);
  }

  public async handleNotificationAsync(message: SDKTaskNotificationMessage): Promise<string | null> {
    this.foreground.delete(message.task_id);
    const task = this.running.get(message.task_id);
    if (Object.isUndefined(task))
      return null;
    this.running.delete(message.task_id);
    if (!Object.isNull(task.follower) && task.follower.reads(message.output_file))
      task.follower.finish();
    else {
      task.follower?.stop();
      const output = TaskOutputReader.readTail(message.output_file);
      if (output.length > 0)
        task.listener.onTaskOutput(message.task_id, output);
    }
    await task.listener.onTaskEndedAsync(new TaskEnd(message.task_id, Resources.claudeTaskStatuses[message.status]));
    return task.command;
  }

  public async endAllAsync(wait: number, log: ILog | null = null): Promise<void> {
    const stops = Promise.all([...this.running.values()].map(task => task.stop().catch(() => undefined)));
    let timer: NodeJS.Timeout | undefined;
    await Promise.race([stops, new Promise<void>(resolve => timer = setTimeout(resolve, wait))]);
    clearTimeout(timer);
    const running = [...this.running];
    this.running.clear();
    this.foreground.clear();
    for (const [, task] of running)
      task.follower?.finish();
    for (const [taskId, task] of running)
      try {
        await task.listener.onTaskEndedAsync(new TaskEnd(taskId, BackgroundTaskStatus.Ended));
      }
      catch (error) {
        log?.write(Resources.formatClaudeTaskEndUnrecorded(taskId, FailureDescriber.describe(error)));
      }
  }

  private async startAsync(message: SDKTaskStartedMessage, query: IClaudeQuery, listener: ITurnListener): Promise<void> {
    const command = Object.isUndefined(message.tool_use_id) ? undefined : this.commands.get(message.tool_use_id);
    const shown = command ?? message.description;
    if (String.isNullOrWhitespace(shown) || this.running.has(message.task_id))
      return;
    const stop = (): Promise<void> => query.stopTask(message.task_id);
    this.running.set(message.task_id, { command: shown, toolUseId: message.tool_use_id, stop, listener, follower: null });
    await listener.onTaskStartedAsync(new TaskStart(message.task_id, shown, stop));
  }
}
