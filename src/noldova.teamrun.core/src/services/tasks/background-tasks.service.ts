/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import {
  BackgroundTask,
  BackgroundTaskOutputPayload,
  BackgroundTaskPage,
  BackgroundTasksClearedPayload,
  BackgroundTaskStatus,
  ConversationIdParams,
  ErrorCode,
  Event,
  EventName,
  type BackgroundTaskIdParams,
  type BackgroundTaskListParams
} from "@noldova/teamrun.protocol";
import { ServiceException } from "@noldova/teamrun.services";

import type { IBackgroundTasksService } from "../../interfaces/i-background-tasks.service.js";
import type { IEventSink } from "../../interfaces/i-event-sink.js";
import type { ILog } from "../../interfaces/i-log.js";
import { Guid } from "../../models/guid.js";
import type { TaskEnd } from "../../models/task-end.js";
import type { TaskStart } from "../../models/task-start.js";
import { Resources } from "../../resources.js";
import type { DatabaseContext } from "../database-context.js";
import { BackgroundTaskStore } from "./background-task-store.js";

export class BackgroundTasksService implements IBackgroundTasksService {
  private readonly events: IEventSink;
  private readonly outputInterval: number;
  private readonly stopWait: number;
  private readonly log: ILog | null;
  private saved: BackgroundTaskStore | null;
  private readonly loaded: Set<string> = new Set();
  private readonly tasks: Map<string, BackgroundTask> = new Map();
  private readonly owned: Map<string, string> = new Map();
  private readonly stops: Map<string, () => Promise<void>> = new Map();
  private readonly teammates: Map<string, string> = new Map();
  private readonly endings: Map<string, PromiseWithResolvers<void>> = new Map();
  private readonly pending: Map<string, string> = new Map();
  private readonly forgotten: Set<string> = new Set();
  private readonly stopping: Map<string, Promise<void>> = new Map();
  private flushTimer: NodeJS.Timeout | null = null;
  private latest: number = 0;

  public constructor(events: IEventSink, outputInterval: number = Resources.backgroundTaskOutputInterval, stopWait: number = Resources.backgroundTaskStopWait,
    log: ILog | null = null, context: DatabaseContext | null = null) {
    this.events = events;
    this.outputInterval = outputInterval;
    this.stopWait = stopWait;
    this.log = log;
    this.saved = Object.isNull(context) ? null : new BackgroundTaskStore(context, log);
  }

  public async startAsync(conversationId: string, messageId: string, kind: string, start: TaskStart, teammateId: string | null = null): Promise<BackgroundTask | null> {
    if (this.forgotten.has(conversationId)) {
      void start.stop().catch(() => undefined);
      return null;
    }
    const key = BackgroundTasksService.keyOf(messageId, start.taskId);
    if (this.owned.has(key))
      return null;
    const task = new BackgroundTask(Guid.createVersion7().toString(), conversationId, messageId, kind, start.command, BackgroundTaskStatus.Running,
      null, this.now(), null, String.empty, start.subAgentId);
    this.owned.set(key, task.id);
    this.stops.set(task.id, start.stop);
    if (!Object.isNull(teammateId))
      this.teammates.set(task.id, teammateId);
    this.endings.set(task.id, Promise.withResolvers());
    this.store(task);
    await this.saved?.saveAsync(task);
    return task;
  }

  public write(messageId: string, taskId: string, text: string): void {
    const task = this.find(messageId, taskId);
    if (Object.isNull(task) || !task.isRunning || text.length === 0)
      return;
    this.pending.set(task.id, `${this.pending.get(task.id) ?? String.empty}${text}`);
    this.flushTimer ??= setTimeout(() => this.flush(), this.outputInterval);
  }

  public async endAsync(messageId: string, end: TaskEnd): Promise<void> {
    const task = this.find(messageId, end.taskId);
    if (Object.isNull(task) || !task.isRunning)
      return;
    this.flushOne(task.id);
    this.stops.delete(task.id);
    this.teammates.delete(task.id);
    const running = this.tasks.get(task.id)!;
    this.tasks.delete(task.id);
    const ended = running.withEnd(end.status, end.exitCode, this.now());
    this.store(ended);
    await this.saved?.saveAsync(ended);
    this.endings.get(task.id)?.resolve();
    this.endings.delete(task.id);
  }

  public async listAsync(params: ConversationIdParams): Promise<readonly BackgroundTask[]> {
    await this.loadAsync(params.conversationId);
    const tasks = [...this.tasks.values()].filter(t => t.conversationId === params.conversationId).reverse();
    return [...tasks.filter(t => t.isRunning), ...tasks.filter(t => !t.isRunning)].map(t => t.withoutOutput());
  }

  public async pageAsync(params: BackgroundTaskListParams): Promise<BackgroundTaskPage> {
    const tasks = await this.listAsync(new ConversationIdParams(params.chatId));
    const finished = tasks.filter(t => !t.isRunning && Object.isNull(t.subAgentId));
    const after = Object.isNull(params.afterTaskId) ? 0 : finished.findIndex(t => t.id === params.afterTaskId) + 1;
    const shown = Object.isNull(params.afterTaskId) || after > 0 ? finished.slice(after, after + params.limit) : [];
    const running = Object.isNull(params.afterTaskId) ? tasks.filter(t => t.isRunning) : [];
    return new BackgroundTaskPage([...running, ...shown].map(t => t.withCommandCut()), shown.length > 0 && after + shown.length < finished.length, finished.length);
  }

  public async readAsync(params: BackgroundTaskIdParams): Promise<BackgroundTask> {
    const task = this.tasks.get(params.taskId);
    if (Object.isUndefined(task))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatBackgroundTaskNotFound(params.taskId), [params.taskId]);
    return Object.isNull(task.output) ? await this.saved?.readAsync(task) ?? task : task;
  }

  public async stop(params: BackgroundTaskIdParams): Promise<BackgroundTask> {
    const task = this.tasks.get(params.taskId);
    if (Object.isUndefined(task))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatBackgroundTaskNotFound(params.taskId), [params.taskId]);
    const stop = this.stops.get(task.id);
    const ending = this.endings.get(task.id);
    if (Object.isUndefined(stop) || Object.isUndefined(ending))
      return task;
    try {
      await this.stopOnce(task.id, stop);
    }
    catch (error) {
      throw new ServiceException(ErrorCode.ProviderError, Resources.formatBackgroundTaskStopFailed(error instanceof Error ? error.message : String(error)),
        [params.taskId]);
    }
    let timer: NodeJS.Timeout | null = null;
    await Promise.race([ending.promise, new Promise<void>(resolve => timer = setTimeout(resolve, this.stopWait))]);
    if (!Object.isNull(timer))
      clearTimeout(timer);
    const current = this.tasks.get(task.id);
    if (!Object.isUndefined(current) || this.forgotten.has(task.conversationId))
      return current ?? task;
    throw new ServiceException(ErrorCode.NotFound, Resources.formatBackgroundTaskNotFound(params.taskId), [params.taskId]);
  }

  public async clearFinishedAsync(params: ConversationIdParams): Promise<BackgroundTasksClearedPayload> {
    await this.loadAsync(params.conversationId);
    const clearedAt = this.now();
    const finished = [...this.tasks.values()].filter(t => t.conversationId === params.conversationId && !t.isRunning);
    for (const task of finished)
      this.tasks.delete(task.id);
    await this.saved?.deleteAsync(finished.map(t => t.id));
    const cleared = new BackgroundTasksClearedPayload(params.conversationId, clearedAt, finished.length);
    if (finished.length > 0)
      this.events.publish(new Event(EventName.BackgroundTasksCleared, cleared.toJson()));
    return cleared;
  }

  public forget(conversationIds: readonly string[]): void {
    const gone = new Set(conversationIds);
    for (const id of gone) {
      this.forgotten.add(id);
      this.loaded.delete(id);
    }
    const dropped = new Set<string>();
    for (const task of [...this.tasks.values()].filter(t => gone.has(t.conversationId))) {
      const stop = this.stops.get(task.id);
      dropped.add(task.id);
      this.tasks.delete(task.id);
      this.stops.delete(task.id);
      this.teammates.delete(task.id);
      if (!Object.isUndefined(stop))
        void stop().catch(() => undefined);
      this.pending.delete(task.id);
      this.endings.get(task.id)?.resolve();
      this.endings.delete(task.id);
    }
    for (const [key, id] of [...this.owned])
      if (dropped.has(id))
        this.owned.delete(key);
  }

  public stopTeammate(teammateId: string, conversationId: string | null): void {
    for (const [id, stop] of [...this.stops])
      if (this.teammates.get(id) === teammateId && (Object.isNull(conversationId) || this.tasks.get(id)?.conversationId === conversationId))
        void this.stopOnce(id, stop)
          .catch((error: unknown) => this.log?.write(Resources.formatTeammateTaskStopFailed(id, Resources.formatFailureKind(error))));
  }

  public async closeAsync(): Promise<void> {
    const saved = this.saved;
    this.saved = null;
    const now = this.now();
    const stopped: BackgroundTask[] = [];
    for (const task of [...this.tasks.values()].filter(t => t.isRunning)) {
      this.flushOne(task.id);
      stopped.push(this.tasks.get(task.id)!.withEnd(BackgroundTaskStatus.Stopped, null, now));
    }
    for (const task of stopped)
      await saved?.saveAsync(task);
  }

  private async loadAsync(conversationId: string): Promise<void> {
    if (Object.isNull(this.saved) || this.loaded.has(conversationId))
      return;
    const listed = await this.saved.listAsync(conversationId);
    if (this.loaded.has(conversationId) || this.forgotten.has(conversationId))
      return;
    const earlier = listed.filter(t => !this.tasks.has(t.id));
    this.loaded.add(conversationId);
    if (earlier.length === 0)
      return;
    const current = [...this.tasks.values()];
    this.tasks.clear();
    for (const task of [...earlier, ...current]) {
      this.tasks.set(task.id, task);
      this.latest = Math.max(this.latest, Date.parse(task.endedAt ?? task.startedAt));
    }
  }

  private stopOnce(id: string, stop: () => Promise<void>): Promise<void> {
    const running = this.stopping.get(id);
    if (!Object.isUndefined(running))
      return running;
    const stopped = stop().finally(() => this.stopping.delete(id));
    this.stopping.set(id, stopped);
    return stopped;
  }

  private find(messageId: string, taskId: string): BackgroundTask | null {
    return this.tasks.get(this.owned.get(BackgroundTasksService.keyOf(messageId, taskId)) ?? String.empty) ?? null;
  }

  private flush(): void {
    this.flushTimer = null;
    for (const id of [...this.pending.keys()])
      this.flushOne(id);
  }

  private flushOne(id: string): void {
    const text = this.pending.get(id);
    const task = this.tasks.get(id);
    this.pending.delete(id);
    if (Object.isUndefined(text) || Object.isUndefined(task))
      return;
    this.tasks.set(id, task.withOutput(text));
    this.events.publish(new Event(EventName.BackgroundTaskOutput, new BackgroundTaskOutputPayload(task.conversationId, id, text).toJson()));
  }

  private store(task: BackgroundTask): void {
    this.tasks.set(task.id, task);
    this.events.publish(new Event(EventName.BackgroundTaskUpdated, task.toJson()));
  }

  private now(): string {
    this.latest = Math.max(Date.now(), this.latest + 1);
    return new Date(this.latest).toISOString();
  }

  private static keyOf(messageId: string, taskId: string): string {
    return `${messageId}${Resources.taskKeySeparator}${taskId}`;
  }
}
