/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type FactoryProvider, inject, type Signal, signal, type WritableSignal } from "@angular/core";

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";
import {
  BackgroundTask,
  BackgroundTaskIdParams,
  BackgroundTaskListParams,
  BackgroundTaskOutputPayload,
  BackgroundTaskPage,
  BackgroundTasksClearedPayload,
  ConversationIdParams,
  EventName,
  MethodName
} from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";
import { EngineResync } from "./engine-resync";

export class BackgroundTaskStoreService {
  public static readonly provider: FactoryProvider =
    { provide: BackgroundTaskStoreService, useFactory: (): BackgroundTaskStoreService => BackgroundTaskStoreService.of(inject(WindowPartTokens.context)) };

  private static readonly stores: WeakMap<IWindowPartContext, BackgroundTaskStoreService> = new WeakMap();
  private static readonly empty: BackgroundTaskPage = new BackgroundTaskPage([], false, 0);

  private readonly context: IWindowPartContext;
  private readonly tasksSignal: WritableSignal<ReadonlyMap<string, readonly BackgroundTask[]>> = signal(new Map());
  private readonly loadErrorsSignal: WritableSignal<ReadonlyMap<string, string>> = signal(new Map());
  private readonly stopErrorsSignal: WritableSignal<ReadonlyMap<string, string>> = signal(new Map());
  private readonly stoppingSignal: WritableSignal<ReadonlySet<string>> = signal(new Set());
  private readonly clearErrorsSignal: WritableSignal<ReadonlyMap<string, string>> = signal(new Map());
  private readonly clearingSignal: WritableSignal<ReadonlySet<string>> = signal(new Set());
  private readonly outputLoadingSignal: WritableSignal<ReadonlySet<string>> = signal(new Set());
  private readonly outputFailedSignal: WritableSignal<ReadonlySet<string>> = signal(new Set());
  private readonly unlistedSignal: WritableSignal<ReadonlyMap<string, number>> = signal(new Map());
  private readonly loadingMoreSignal: WritableSignal<ReadonlySet<string>> = signal(new Set());
  private readonly nexts: Map<string, string> = new Map();
  private readonly pagesFailed: Set<string> = new Set();
  private readonly outputChanged: Set<string> = new Set();
  private readonly loads: Map<string, number> = new Map();
  private readonly subscriptions: readonly (() => void)[];
  private generation: number = 0;

  public readonly stopErrors: Signal<ReadonlyMap<string, string>> = this.stopErrorsSignal.asReadonly();
  public readonly stopping: Signal<ReadonlySet<string>> = this.stoppingSignal.asReadonly();
  public readonly clearErrors: Signal<ReadonlyMap<string, string>> = this.clearErrorsSignal.asReadonly();
  public readonly clearing: Signal<ReadonlySet<string>> = this.clearingSignal.asReadonly();
  public readonly outputLoading: Signal<ReadonlySet<string>> = this.outputLoadingSignal.asReadonly();
  public readonly outputFailed: Signal<ReadonlySet<string>> = this.outputFailedSignal.asReadonly();
  public readonly loadingMore: Signal<ReadonlySet<string>> = this.loadingMoreSignal.asReadonly();

  public constructor(context: IWindowPartContext) {
    this.context = context;
    this.subscriptions = [
      context.onEvent(Resources.formatQualifiedName(EventName.BackgroundTaskUpdated), t => this.put(BackgroundTask.fromJson(t))),
      context.onEvent(Resources.formatQualifiedName(EventName.BackgroundTaskOutput), t => this.append(BackgroundTaskOutputPayload.fromJson(t))),
      context.onEvent(Resources.formatQualifiedName(EventName.BackgroundTasksCleared), t => this.remove(BackgroundTasksClearedPayload.fromJson(t))),
      context.onEvent(Resources.formatQualifiedName(EventName.ConversationDeleted), t => this.forget(ConversationIdParams.fromJson(t).conversationId)),
      context.onEvent(Resources.formatQualifiedName(EventName.StateInvalidated), () => this.reload()),
      EngineResync.on(context, () => this.reload())
    ];
  }

  public static of(context: IWindowPartContext): BackgroundTaskStoreService {
    const found = BackgroundTaskStoreService.stores.get(context);
    if (!Object.isUndefined(found))
      return found;
    const store = new BackgroundTaskStoreService(context);
    BackgroundTaskStoreService.stores.set(context, store);
    return store;
  }

  public static release(context: IWindowPartContext): void {
    BackgroundTaskStoreService.stores.get(context)?.dispose();
    BackgroundTaskStoreService.stores.delete(context);
  }

  public watch(conversationId: string): void {
    if (!this.loads.has(conversationId))
      void this.load(conversationId);
  }

  public retry(conversationId: string): void {
    void (this.pagesFailed.has(conversationId) ? this.loadMore(conversationId) : this.load(conversationId));
  }

  public tasksOf(conversationId: string): readonly BackgroundTask[] {
    return this.tasksSignal().get(conversationId) ?? [];
  }

  public loadErrorOf(conversationId: string): string | null {
    return this.loadErrorsSignal().get(conversationId) ?? null;
  }

  public unlistedOf(conversationId: string): number {
    return this.unlistedSignal().get(conversationId) ?? 0;
  }

  public commandsOf(conversationId: string): readonly BackgroundTask[] {
    return this.tasksOf(conversationId).filter(t => Object.isNull(t.subAgentId));
  }

  public subAgentTaskOf(conversationId: string, messageId: string, subAgentId: string | null): BackgroundTask | null {
    return this.tasksOf(conversationId).find(t => !Object.isNull(t.subAgentId) && t.subAgentId === subAgentId && t.isRunning && t.messageId === messageId) ?? null;
  }

  public runningCountOf(conversationId: string, messageId: string): number {
    return this.commandsOf(conversationId).filter(t => t.messageId === messageId && t.isRunning).length;
  }

  public async stop(task: BackgroundTask): Promise<void> {
    this.stoppingSignal.update(t => new Set([...t, task.id]));
    this.stopErrorsSignal.update(t => BackgroundTaskStoreService.without(t, task.id));
    try {
      this.replace(BackgroundTask.fromJson(await this.request(MethodName.BackgroundTaskStop, new BackgroundTaskIdParams(task.id).toJson())));
    }
    catch (error) {
      if (this.lists(task))
        this.stopErrorsSignal.update(t => new Map([...t, [task.id, error instanceof Error ? error.message : String(error)]]));
    }
    finally {
      this.stoppingSignal.update(t => new Set([...t].filter(u => u !== task.id)));
    }
  }

  public async readOutput(task: BackgroundTask): Promise<void> {
    this.outputLoadingSignal.update(t => new Set([...t, task.id]));
    this.outputFailedSignal.update(t => new Set([...t].filter(u => u !== task.id)));
    try {
      let read: BackgroundTask;
      do
        read = BackgroundTask.fromJson(await this.request(MethodName.BackgroundTaskRead, new BackgroundTaskIdParams(task.id).toJson()));
      while (this.outputChanged.delete(task.id));
      this.fill(read);
    }
    catch {
      if (this.lists(task))
        this.outputFailedSignal.update(t => new Set([...t, task.id]));
    }
    finally {
      this.outputChanged.delete(task.id);
      this.outputLoadingSignal.update(t => new Set([...t].filter(u => u !== task.id)));
    }
  }

  public async clearFinished(conversationId: string): Promise<void> {
    this.clearingSignal.update(t => new Set([...t, conversationId]));
    this.clearErrorsSignal.update(t => BackgroundTaskStoreService.without(t, conversationId));
    try {
      this.remove(BackgroundTasksClearedPayload.fromJson(await this.request(MethodName.BackgroundTaskClearFinished, new ConversationIdParams(conversationId).toJson())));
    }
    catch (error) {
      this.clearErrorsSignal.update(t => new Map([...t, [conversationId, error instanceof Error ? error.message : String(error)]]));
    }
    finally {
      this.clearingSignal.update(t => new Set([...t].filter(u => u !== conversationId)));
    }
  }

  public async loadMore(conversationId: string): Promise<void> {
    const after = this.nexts.get(conversationId);
    const ticket = this.loads.get(conversationId);
    if (Object.isUndefined(after) || this.loadingMoreSignal().has(conversationId))
      return;
    this.loadingMoreSignal.update(t => new Set([...t, conversationId]));
    this.pagesFailed.delete(conversationId);
    this.loadErrorsSignal.update(t => BackgroundTaskStoreService.without(t, conversationId));
    try {
      const page = BackgroundTaskPage.fromJson(await this.request(MethodName.BackgroundTaskList,
        new BackgroundTaskListParams(conversationId, after, Resources.backgroundTaskPageSize).toJson()));
      if (this.loads.get(conversationId) !== ticket)
        return;
      const tasks = this.tasksOf(conversationId);
      const listed = new Set(tasks.map(t => t.id));
      this.tasksSignal.update(t => new Map([...t, [conversationId, [...tasks, ...page.tasks.filter(u => !listed.has(u.id))]]]));
      this.paged(conversationId, page);
    }
    catch (error) {
      if (this.loads.get(conversationId) === ticket) {
        this.pagesFailed.add(conversationId);
        this.loadErrorsSignal.update(t => new Map([...t, [conversationId, error instanceof Error ? error.message : String(error)]]));
      }
    }
    finally {
      this.loadingMoreSignal.update(t => new Set([...t].filter(u => u !== conversationId)));
    }
  }

  private async load(conversationId: string): Promise<void> {
    const ticket = ++this.generation;
    this.loads.set(conversationId, ticket);
    this.pagesFailed.delete(conversationId);
    this.loadErrorsSignal.update(t => BackgroundTaskStoreService.without(t, conversationId));
    try {
      const value = await this.request(MethodName.BackgroundTaskList,
        new BackgroundTaskListParams(conversationId, null, Resources.backgroundTaskPageSize).toJson());
      if (this.loads.get(conversationId) !== ticket)
        return;
      const page = Object.isNull(value) ? BackgroundTaskStoreService.empty : BackgroundTaskPage.fromJson(value);
      const held = new Map(this.tasksOf(conversationId).filter(t => !Object.isNull(t.output)).map(t => [t.id, t]));
      const tasks = page.tasks.map(t => {
        const kept = held.get(t.id);
        return !Object.isUndefined(kept) && !kept.isRunning ? kept : t;
      });
      this.tasksSignal.update(t => new Map([...t, [conversationId, tasks]]));
      this.paged(conversationId, page);
      for (const task of tasks.filter(t => Object.isNull(t.output) && held.has(t.id)))
        void this.readOutput(task);
    }
    catch (error) {
      if (this.loads.get(conversationId) === ticket)
        this.loadErrorsSignal.update(t => new Map([...t, [conversationId, error instanceof Error ? error.message : String(error)]]));
    }
  }

  private paged(conversationId: string, page: BackgroundTaskPage): void {
    if (page.hasLater)
      this.nexts.set(conversationId, page.tasks.at(-1)!.id);
    else
      this.nexts.delete(conversationId);
    const listed = this.commandsOf(conversationId).filter(t => !t.isRunning).length;
    this.unlistedSignal.update(t => new Map([...t, [conversationId, page.count - listed]]));
  }

  private reload(): void {
    for (const conversationId of [...this.loads.keys()])
      void this.load(conversationId);
  }

  private lists(task: BackgroundTask): boolean {
    return this.tasksSignal().get(task.conversationId)?.some(t => t.id === task.id) === true;
  }

  private replace(task: BackgroundTask): void {
    if (this.lists(task))
      this.put(task);
  }

  private put(task: BackgroundTask): void {
    const tasks = this.tasksSignal().get(task.conversationId);
    if (Object.isUndefined(tasks))
      return;
    const others = tasks.filter(t => t.id !== task.id);
    this.tasksSignal.update(t => new Map([...t, [task.conversationId, [task, ...others]]]));
  }

  private fill(task: BackgroundTask): void {
    const tasks = this.tasksOf(task.conversationId);
    if (tasks.some(t => t.id === task.id && Object.isNull(t.output)))
      this.tasksSignal.update(t => new Map([...t, [task.conversationId, tasks.map(u => u.id === task.id ? task : u)]]));
  }

  private append(payload: BackgroundTaskOutputPayload): void {
    const tasks = this.tasksSignal().get(payload.conversationId);
    const task = tasks?.find(t => t.id === payload.taskId);
    if (Object.isUndefined(tasks) || Object.isUndefined(task))
      return;
    if (Object.isNull(task.output)) {
      if (this.outputLoadingSignal().has(task.id))
        this.outputChanged.add(task.id);
      return;
    }
    const changed = task.withOutput(payload.text);
    this.tasksSignal.update(t => new Map([...t, [payload.conversationId, tasks.map(u => u.id === task.id ? changed : u)]]));
  }

  private remove(payload: BackgroundTasksClearedPayload): void {
    const tasks = this.tasksSignal().get(payload.conversationId);
    if (Object.isUndefined(tasks))
      return;
    const gone = new Set(tasks.filter(t => !Object.isNull(t.endedAt) && t.endedAt <= payload.clearedAt).map(t => t.id));
    this.nexts.delete(payload.conversationId);
    this.tasksSignal.update(t => new Map([...t, [payload.conversationId, tasks.filter(u => !gone.has(u.id))]]));
    this.unlistedSignal.update(t => BackgroundTaskStoreService.without(t, payload.conversationId));
    this.stopErrorsSignal.update(t => new Map([...t].filter(([id]) => !gone.has(id))));
    this.outputFailedSignal.update(t => new Set([...t].filter(u => !gone.has(u))));
  }

  private forget(conversationId: string): void {
    this.loads.delete(conversationId);
    this.nexts.delete(conversationId);
    this.pagesFailed.delete(conversationId);
    this.tasksSignal.update(t => BackgroundTaskStoreService.without(t, conversationId));
    this.unlistedSignal.update(t => BackgroundTaskStoreService.without(t, conversationId));
    this.loadErrorsSignal.update(t => BackgroundTaskStoreService.without(t, conversationId));
    this.clearErrorsSignal.update(t => BackgroundTaskStoreService.without(t, conversationId));
  }

  private dispose(): void {
    for (const unsubscribe of this.subscriptions)
      unsubscribe();
    this.loads.clear();
  }

  private request(method: MethodName, parameters: JsonValue): Promise<JsonValue> {
    return this.context.requestAsync(Resources.formatQualifiedName(method), parameters);
  }

  private static without<T>(map: ReadonlyMap<string, T>, key: string): ReadonlyMap<string, T> {
    const copy = new Map(map);
    copy.delete(key);
    return copy;
  }
}
