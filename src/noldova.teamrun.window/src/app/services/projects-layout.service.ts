/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type FactoryProvider, type Signal, type WritableSignal, computed, inject, signal } from "@angular/core";

import "@noldova/context.core";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import { type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";
import { EventName, MethodName, ProjectsLayoutSaveParams } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";
import type { ProjectsGroup } from "../enums/projects-group";
import { ProjectsLayout } from "../models/projects-layout";

export class ProjectsLayoutService {
  public static readonly provider: FactoryProvider =
    { provide: ProjectsLayoutService, useFactory: (): ProjectsLayoutService => ProjectsLayoutService.of(inject(WindowPartTokens.context)) };

  private static readonly stores: WeakMap<IWindowPartContext, ProjectsLayoutService> = new WeakMap();

  private readonly context: IWindowPartContext;
  private readonly stored: ProjectsLayout | null = ProjectsLayoutService.readStored();
  private readonly current: WritableSignal<ProjectsLayout> = signal(this.stored ?? new ProjectsLayout());
  private readonly subscriptions: readonly (() => void)[];
  private readonly held: ((layout: ProjectsLayout) => ProjectsLayout)[] = [];
  private isOpen: boolean = false;
  private opening: Promise<void> | null = null;
  private latest: ProjectsLayout | null = null;
  private edits: number = 0;
  private received: number = 0;
  private saving: number = 0;
  private missed: ProjectsLayout | null = null;
  private saved: Promise<void> = Promise.resolve();

  public readonly layout: Signal<ProjectsLayout> = this.current.asReadonly();
  public readonly pinnedConversations: Signal<readonly string[]> = computed(() => this.current().pinnedConversations);
  public readonly projectOrder: Signal<readonly string[]> = computed(() => this.current().projectOrder);

  public constructor(context: IWindowPartContext) {
    this.context = context;
    this.subscriptions = [
      context.onEvent(Resources.formatQualifiedName(EventName.ProjectsLayoutUpdated), t => {
        this.received++;
        this.latest = ProjectsLayout.fromJson(t);
        if (this.saving === 0)
          this.current.set(this.held.reduce((layout, change) => change(layout), this.latest));
        else
          this.missed = this.latest;
      }),
      context.onEvent(Resources.formatQualifiedName(EventName.StateResyncRequested), () => this.resync())
    ];
    this.openOnce();
  }

  public static of(context: IWindowPartContext): ProjectsLayoutService {
    const found = ProjectsLayoutService.stores.get(context);
    if (!Object.isUndefined(found))
      return found;
    const store = new ProjectsLayoutService(context);
    ProjectsLayoutService.stores.set(context, store);
    return store;
  }

  public static release(context: IWindowPartContext): void {
    ProjectsLayoutService.stores.get(context)?.dispose();
    ProjectsLayoutService.stores.delete(context);
  }

  public toggleProject(projectId: string): void {
    this.update(t => t.toggleProject(projectId));
  }

  public collapseGroup(group: ProjectsGroup, collapsed: boolean): void {
    this.update(t => t.withGroupCollapsed(group, collapsed));
  }

  public togglePin(conversationId: string): void {
    this.update(t => t.togglePin(conversationId));
  }

  public orderPins(order: readonly string[]): void {
    this.update(t => t.orderPins(order));
  }

  public orderProjects(order: readonly string[]): void {
    this.update(t => t.orderProjects(order));
  }

  public orderConversations(projectId: string, order: readonly string[]): void {
    this.update(t => t.orderConversations(projectId, order));
  }

  private update(change: (layout: ProjectsLayout) => ProjectsLayout): void {
    const next = change(this.current());
    this.edits++;
    this.current.set(next);
    if (this.isOpen)
      void this.save(next.toJson());
    else {
      this.held.push(change);
      this.openOnce();
    }
  }

  private resync(): void {
    if (this.isOpen)
      void this.load();
    else
      this.openOnce();
  }

  private openOnce(): void {
    this.opening ??= this.open().finally(() => {
      this.opening = null;
    });
  }

  private async open(): Promise<void> {
    let base = this.stored ?? new ProjectsLayout();
    let kept: JsonValue = null;
    try {
      kept = await this.request(MethodName.ProjectsLayoutRead, null);
    }
    catch (error) {
      if (Object.isNull(this.latest)) {
        this.context.log(Resources.formatProjectsLayoutNotRead(ProjectsLayoutService.failureOf(error)));
        return;
      }
    }
    if (!Object.isNull(this.latest)) {
      base = this.latest;
      ProjectsLayoutService.removeStored();
    }
    else if (!Object.isNull(kept)) {
      base = ProjectsLayout.fromJson(kept);
      ProjectsLayoutService.removeStored();
    }
    else if (Object.isNull(kept) && !Object.isNull(this.stored)) {
      const moved = await this.save(this.stored.toJson(), true);
      if (!Object.isUndefined(moved)) {
        base = this.latest ?? ProjectsLayout.fromJson(moved);
        ProjectsLayoutService.removeStored();
      }
    }
    this.isOpen = true;
    const held = this.held.splice(0);
    this.current.set(held.reduce((layout, change) => change(layout), base));
    if (held.length > 0)
      void this.save(this.current().toJson());
  }

  private async load(): Promise<void> {
    const [edits, received] = [this.edits, this.received];
    try {
      const kept = await this.request(MethodName.ProjectsLayoutRead, null);
      if (!Object.isNull(kept) && edits === this.edits && received === this.received && this.saving === 0)
        this.current.set(ProjectsLayout.fromJson(kept));
    }
    catch {
      return;
    }
  }

  private save(layout: JsonObject, onlyIfNone: boolean = false): Promise<JsonValue | undefined> {
    this.saving++;
    const done = this.saved.then(() => this.request(MethodName.ProjectsLayoutSave, new ProjectsLayoutSaveParams(layout, onlyIfNone).toJson()))
      .catch((error: unknown) => {
        this.context.log(Resources.formatProjectsLayoutNotSaved(ProjectsLayoutService.failureOf(error)));
        return undefined;
      })
      .finally(() => this.settle());
    this.saved = done.then(() => undefined);
    return done;
  }

  private settle(): void {
    this.saving--;
    const missed = this.missed;
    if (this.saving > 0 || Object.isNull(missed))
      return;
    this.missed = null;
    this.current.set(this.held.reduce((layout, change) => change(layout), missed));
  }

  private request(method: MethodName, parameters: JsonValue): Promise<JsonValue> {
    return this.context.requestAsync(Resources.formatQualifiedName(method), parameters);
  }

  private dispose(): void {
    for (const unsubscribe of this.subscriptions)
      unsubscribe();
  }

  private static failureOf(error: unknown): string {
    return error instanceof Error ? error.name : typeof error;
  }

  private static readStored(): ProjectsLayout | null {
    let value: unknown;
    try {
      const stored = globalThis.localStorage.getItem(Resources.projectsLayoutStorageKey);
      if (Object.isNull(stored))
        return null;
      value = JSON.parse(stored);
    }
    catch {
      value = null;
    }
    if (Object.isObject(value) && !Array.isArray(value))
      return ProjectsLayout.fromJson(value);
    ProjectsLayoutService.removeStored();
    return null;
  }

  private static removeStored(): void {
    try {
      globalThis.localStorage.removeItem(Resources.projectsLayoutStorageKey);
    }
    catch {
      return;
    }
  }
}
