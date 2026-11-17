/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonReader } from "@noldova/context.json";
import { type ITimer, type ITurnListener, TaskEnd, TaskStart, TurnWake } from "@noldova/teamrun.core";
import { BackgroundTaskStatus } from "@noldova/teamrun.protocol";

import { TaskException } from "../../exceptions/task.exception.js";
import { Resources } from "../../resources.js";

export class AcpTasks {
  private readonly listener: ITurnListener;
  private readonly sessionId: string;
  private readonly providerName: string;
  private readonly timer: ITimer;
  private readonly endTree: (processId: number, startedBy: number) => Promise<void>;
  private readonly expectWake: (wake: TurnWake) => void;
  private readonly running: Map<string, { command: string; output: string; process: { id: number; startedBy: number } | null; listed: boolean;
    stopping: boolean; }> = new Map();
  private readonly toolCalls: Map<string, string> = new Map();

  public constructor(listener: ITurnListener, sessionId: string, providerName: string, timer: ITimer,
    endTree: (processId: number, startedBy: number) => Promise<void>, expectWake: (wake: TurnWake) => void) {
    this.listener = listener;
    this.sessionId = sessionId;
    this.providerName = providerName;
    this.timer = timer;
    this.endTree = endTree;
    this.expectWake = expectWake;
  }

  public get isIdle(): boolean {
    return this.running.size === 0;
  }

  public async handleAsync(method: string, params: JsonReader): Promise<boolean> {
    if (!params.hasField(Resources.sessionIdField) || params.readValue(Resources.sessionIdField) !== this.sessionId || !params.hasField(Resources.acpUpdateField))
      return false;
    const update = params.readObject(Resources.acpUpdateField);
    if (Resources.xaiTaskBackgroundedMethods.includes(method)) {
      await this.startAsync(update);
      return true;
    }
    if (Resources.xaiTaskCompletedMethods.includes(method)) {
      await this.completeAsync(update);
      return true;
    }
    const kind = update.readOptionalString(Resources.acpSessionUpdateField);
    if (Resources.xaiSessionNotificationMethods.includes(method) && kind === Resources.xaiBackgroundTasks) {
      this.list(update);
      return true;
    }
    if (method !== Resources.acpSessionUpdate || kind !== Resources.acpToolUpdate)
      return false;
    const taskId = this.toolCalls.get(update.readNonBlankString(Resources.acpToolCallIdField));
    if (Object.isUndefined(taskId))
      return false;
    if (update.hasField(Resources.statusField)) {
      this.readProcess(taskId, update);
      return false;
    }
    this.write(taskId, AcpTasks.textOf(update));
    return true;
  }

  public async stopAll(): Promise<void> {
    await Promise.all([...this.running.keys()].map(t => this.stop(t).catch(() => undefined)));
  }

  public async endAllAsync(): Promise<void> {
    for (const taskId of [...this.running.keys()]) {
      const task = this.running.get(taskId);
      if (!Object.isUndefined(task))
        await this.endAsync(taskId, new TaskEnd(taskId, task.stopping ? BackgroundTaskStatus.Stopped : BackgroundTaskStatus.Ended));
    }
  }

  private async startAsync(update: JsonReader): Promise<void> {
    const taskId = update.readNonBlankString(Resources.xaiTaskIdField);
    if (this.running.has(taskId))
      return;
    const command = update.readNonBlankString(Resources.commandField);
    this.running.set(taskId, { command, output: String.empty, process: null, listed: false, stopping: false });
    const toolCallId = update.readOptionalString(Resources.xaiToolCallIdField);
    if (!Object.isUndefined(toolCallId))
      this.toolCalls.set(toolCallId, taskId);
    await this.listener.onTaskStartedAsync(new TaskStart(taskId, command, () => this.stop(taskId)));
  }

  private async stop(taskId: string): Promise<void> {
    const task = this.running.get(taskId);
    if (Object.isUndefined(task) || !task.listed)
      throw new TaskException(Resources.formatTaskNotListed(this.providerName));
    if (Object.isNull(task.process))
      throw new TaskException(Resources.formatTaskProcessUnknown(this.providerName));
    task.stopping = true;
    try {
      await this.endTree(task.process.id, task.process.startedBy);
    }
    catch (error) {
      task.stopping = false;
      throw error;
    }
  }

  private readProcess(taskId: string, update: JsonReader): void {
    const output = update.hasField(Resources.acpRawOutputField) ? update.readNullableObject(Resources.acpRawOutputField) : null;
    const processId = output?.toJson()[Resources.xaiProcessIdField];
    if (output?.readOptionalString(Resources.typeField) === Resources.xaiBackgroundTaskStarted && Number.isSafeInteger(processId))
      this.running.get(taskId)!.process = { id: processId as number, startedBy: this.timer.now() };
  }

  private list(update: JsonReader): void {
    const listed = new Map(update.readObjectArray(Resources.xaiTasksField).map(t => [t.readNonBlankString(Resources.xaiTaskIdField),
      t.readOptionalString(Resources.statusField)]));
    for (const [taskId, task] of this.running)
      task.listed = listed.get(taskId) === Resources.xaiRunningStatus;
  }

  private async completeAsync(update: JsonReader): Promise<void> {
    const snapshot = update.readObject(Resources.xaiTaskSnapshotField);
    const taskId = snapshot.readNonBlankString(Resources.xaiTaskIdField);
    const task = this.running.get(taskId);
    const command = task?.command ?? snapshot.readOptionalString(Resources.commandField) ?? null;
    if (!Object.isUndefined(task)) {
      this.write(taskId, snapshot.readOptionalString(Resources.outputField) ?? String.empty);
      const exitCode = snapshot.hasField(Resources.xaiExitCodeField) ? snapshot.readNullableInteger(Resources.xaiExitCodeField) : null;
      const status = task.stopping || snapshot.toJson()[Resources.xaiExplicitlyKilledField] === true ? BackgroundTaskStatus.Stopped
        : exitCode === 0 ? BackgroundTaskStatus.Completed : BackgroundTaskStatus.Failed;
      await this.endAsync(taskId, new TaskEnd(taskId, status, exitCode));
    }
    if (update.toJson()[Resources.xaiWillWakeField] === true)
      this.expectWake(new TurnWake(taskId, command));
  }

  private write(taskId: string, text: string): void {
    const task = this.running.get(taskId)!;
    if (text.length === 0 || text === task.output)
      return;
    const added = text.startsWith(task.output) ? text.slice(task.output.length) : text;
    task.output = text;
    this.listener.onTaskOutput(taskId, added);
  }

  private async endAsync(taskId: string, end: TaskEnd): Promise<void> {
    this.running.delete(taskId);
    for (const [toolCallId, id] of [...this.toolCalls])
      if (id === taskId)
        this.toolCalls.delete(toolCallId);
    await this.listener.onTaskEndedAsync(end);
  }

  private static textOf(update: JsonReader): string {
    if (!update.hasField(Resources.contentField))
      return String.empty;
    return update.readObjectArray(Resources.contentField).filter(t => t.readOptionalString(Resources.typeField) === Resources.acpContentBlockType)
      .map(t => t.readObject(Resources.contentField)).filter(t => t.readOptionalString(Resources.typeField) === Resources.textInputType)
      .map(t => t.readString(Resources.textField)).join(String.empty);
  }
}
