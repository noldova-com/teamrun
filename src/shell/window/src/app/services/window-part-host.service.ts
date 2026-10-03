/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DestroyRef, ErrorHandler, Injectable, type Signal, type WritableSignal, inject, signal } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import {
  type CommandInfo, CommandList, CommandRun, ModuleState, ModuleStatus, ModuleStatusList, type NotificationPost, NotificationReference, NotificationUpdate, type SettingScope,
  type SettingChange, ShellEvents, ShellMethods
} from "@noldova/teamrun-shell-protocol";

import { DockSide } from "../enums/dock-side";
import type { IWindowPart } from "../interfaces/i-window-part";
import type { IWindowPartHost } from "../interfaces/i-window-part-host";
import { CommandContribution } from "../models/command-contribution";
import { ContributionMatch } from "../models/contribution-match";
import { DocumentTab } from "../models/layout/document-tab";
import type { Tab } from "../models/layout/tab";
import { TabLabel } from "../models/layout/tab-label";
import { ViewRegistry } from "../models/layout/view-registry";
import { ViewTab } from "../models/layout/view-tab";
import { ViewType } from "../models/layout/view-type";
import { ShellDocuments } from "../models/shell-documents";
import { ModuleFailure } from "../models/module-failure";
import { PendingDocument } from "../models/pending-document";
import type { StartupState } from "../models/startup-state";
import { WindowPartActivation } from "../models/window-part-activation";
import { WindowPartContext } from "../models/window-part-context";
import type { WindowPartSource } from "../models/window-part-source";
import { WindowPartTokens } from "../models/window-part-tokens";
import { Resources } from "../../resources";
import { BarItemsService } from "./bar-items.service";
import { CommandService } from "./command.service";
import { DesktopBridgeService } from "./desktop-bridge.service";
import { DocumentOpenerService } from "./document-opener.service";
import { LayoutService } from "./layout.service";
import { MenuService } from "./menu.service";
import { SettingsService } from "./settings.service";
import { TabLabelService } from "./tab-label.service";

@Injectable({ providedIn: "root" })
export class WindowPartHostService implements IWindowPartHost {
  private readonly bridge: DesktopBridgeService = inject(DesktopBridgeService);
  private readonly layout: LayoutService = inject(LayoutService);
  private readonly opener: DocumentOpenerService = inject(DocumentOpenerService);
  private readonly labels: TabLabelService = inject(TabLabelService);
  private readonly commands: CommandService = inject(CommandService);
  private readonly bars: BarItemsService = inject(BarItemsService);
  private readonly menus: MenuService = inject(MenuService);
  private readonly settings: SettingsService = inject(SettingsService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly sources: readonly WindowPartSource[] = inject(WindowPartTokens.sources);
  private readonly activations: WindowPartActivation[] = [];
  private readonly posting: Set<Promise<JsonValue>> = new Set();
  private pendingOpens: PendingDocument[] = [];
  private moduleOrder: readonly string[] = [];
  private runtimeCommands: readonly CommandContribution[] = [];
  private readonly runtimeStates: WritableSignal<CommandList | null> = signal(null);
  private readonly failuresValue: WritableSignal<readonly ModuleFailure[]> = signal([]);
  private readonly generationValue: WritableSignal<number> = signal(0);
  private isReady: boolean = false;
  private isLayoutLoaded: boolean = false;
  private reloading: Promise<void> = Promise.resolve();

  public readonly failures: Signal<readonly ModuleFailure[]> = this.failuresValue.asReadonly();
  public readonly generation: Signal<number> = this.generationValue.asReadonly();

  public constructor() {
    this.labels.register(ShellDocuments.settings.name, ShellDocuments.settingsLabel);
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(this.bridge.onStartup(t => this.follow(t)));
    destroyRef.onDestroy(this.bridge.onEvent((name, payload) => this.receiveCommands(name, payload)));
    void this.bridge.readStartupAsync().then(t => this.follow(t));
  }

  public findContribution(tab: Tab): ContributionMatch | null {
    const shellDocument = tab instanceof DocumentTab ? ShellDocuments.all.find(t => t.name === tab.name) : undefined;
    if (!Object.isUndefined(shellDocument))
      return new ContributionMatch(shellDocument.loadComponent, null);
    for (const activation of this.activations) {
      const contributions = tab instanceof DocumentTab ? activation.context.documents : activation.context.views;
      const contribution = contributions.find(t => t.name === tab.name);
      if (!Object.isUndefined(contribution))
        return new ContributionMatch(contribution.loadComponent, activation.context);
    }
    return null;
  }

  public findFailure(tab: Tab): ModuleFailure | null {
    return tab instanceof ViewTab ? this.failuresValue().find(t => t.viewNames.includes(tab.name)) ?? null : null;
  }

  public requestAsync(method: string, payload: JsonValue): Promise<JsonValue> {
    return this.bridge.requestAsync(method, payload);
  }

  public onEvent(listener: (name: string, payload: JsonValue) => void): () => void {
    return this.bridge.onEvent(listener);
  }

  public readSetting(name: string): JsonValue | undefined {
    return this.settings.read(name);
  }

  public writeSettingAsync(name: string, value: JsonValue, scope: SettingScope | null): Promise<void> {
    return this.settings.setAsync(name, value, scope);
  }

  public resetSettingAsync(name: string, scope: SettingScope | null): Promise<void> {
    return this.settings.resetAsync(name, scope);
  }

  public onSettingChanged(listener: (change: SettingChange) => void): () => void {
    return this.settings.onChanged(listener);
  }

  public openDocument(moduleId: string, name: string, instance: string, title: string, isPreview: boolean): void {
    if (this.isLayoutLoaded)
      this.opener.open(moduleId, name, instance, title, isPreview);
    else
      this.pendingOpens.push(new PendingDocument(moduleId, name, instance, title, isPreview));
  }

  public log(moduleId: string, message: string): void {
    this.bridge.logModule(moduleId, message);
  }

  public keepDocument(moduleId: string, name: string, instance: string): void {
    if (this.isLayoutLoaded)
      this.opener.keep(moduleId, name, instance);
    else
      this.pendingOpens = this.pendingOpens.map(t => t.kept(moduleId, name, instance));
  }

  public isCommandRegistered(name: string): boolean {
    return this.runtimeCommands.some(t => t.name === name) || this.activations.some(t => t.context.commands.some(u => u.name === name));
  }

  public runCommandAsync(name: string, commandArguments: JsonValue): Promise<JsonValue> {
    return this.commands.runAsync(name, commandArguments);
  }

  public async postNotificationAsync(post: NotificationPost): Promise<number> {
    const request = this.bridge.requestAsync(ShellMethods.postNotification.text, post.toJson());
    this.posting.add(request);
    try {
      return NotificationReference.fromJson(await request).id;
    }
    finally {
      this.posting.delete(request);
    }
  }

  public async updateNotificationAsync(id: number, post: NotificationPost): Promise<void> {
    await this.bridge.requestAsync(ShellMethods.updateNotification.text, new NotificationUpdate(id, post).toJson());
  }

  public dismissNotification(id: number): void {
    this.bridge.requestAsync(ShellMethods.dismissNotification.text, new NotificationReference(id).toJson()).catch((error: unknown) => this.errors.handleError(error));
  }

  public refresh(): void {
    this.commands.setCommands(this.moduleOrder.flatMap(t => [
      ...this.runtimeCommands.filter(u => u.name.startsWith(`${t}${Resources.contributionSeparator}`)),
      ...this.activations.find(u => u.context.moduleId === t)?.context.commands ?? []
    ]));
    const ordered = this.moduleOrder.flatMap(t => this.activations.filter(u => u.context.moduleId === t));
    this.bars.set(ordered.flatMap(t => t.context.statusBarItems), ordered.flatMap(t => t.context.topBarActions));
    const notStarted = new Set(this.failuresValue().map(t => t.moduleId));
    this.menus.setActiveModules(this.moduleOrder.filter(t => !notStarted.has(t)));
    const views = this.activations.flatMap(t => t.context.views);
    for (const view of views)
      this.labels.register(view.name, new TabLabel(view.title, view.icon));
    const failed = this.failuresValue().flatMap(t => t.viewNames.map(u => ({ name: u, failure: t })));
    for (const view of failed)
      this.labels.register(view.name, new TabLabel(view.failure.displayName, Resources.moduleFailureGlyph));
    this.layout.setRegistry(new ViewRegistry(
      [...views.map(t => new ViewType(t.name, t.defaultSide, t.isShownByDefault)), ...failed.map(t => new ViewType(t.name, DockSide.Left, false))],
      [...ShellDocuments.all.map(t => t.name), ...this.activations.flatMap(t => t.context.documents.map(u => u.name))]));
  }

  private follow(state: StartupState): void {
    if (!state.isReady)
      this.runtimeStates.set(null);
    if (state.isReady && !this.isReady)
      this.reloading = this.reloading.then(() => this.reloadAsync()).catch((error: unknown) => this.errors.handleError(error));
    this.isReady = state.isReady;
  }

  private async reloadAsync(): Promise<void> {
    await this.deactivateAsync();
    this.failuresValue.set([]);
    this.moduleOrder = [];
    this.runtimeCommands = [];
    try {
      await this.activateReportedAsync();
    }
    catch (error) {
      this.errors.handleError(error);
    }
    await Promise.allSettled(this.posting);
    this.refresh();
    this.generationValue.update(t => t + 1);
    if (!this.isLayoutLoaded)
      await this.loadLayoutAsync();
  }

  private async activateReportedAsync(): Promise<void> {
    await this.settings.loadAsync();
    const report = ModuleStatusList.fromJson(await this.bridge.requestAsync(ShellMethods.modules.text, null));
    this.moduleOrder = report.modules.map(t => t.id);
    const commands = CommandList.fromJson(await this.bridge.requestAsync(ShellMethods.commands.text, null));
    this.applyCommands(commands);
    this.runtimeCommands = commands.commands.map(t => this.describeRuntimeCommand(t));
    const active = new Set<string>();
    const statuses: ModuleStatus[] = [];
    for (const status of report.modules) {
      const result = status.state === ModuleState.Active ? await this.activateAsync(status.id, active) : status;
      if (result.state === ModuleState.Active)
        active.add(result.id);
      statuses.push(result);
    }
    this.failuresValue.set(statuses.filter(t => t.state !== ModuleState.Active).map(t => this.describeFailure(t)));
  }

  private async loadLayoutAsync(): Promise<void> {
    try {
      await this.layout.loadAsync();
    }
    finally {
      this.isLayoutLoaded = true;
      for (const pending of this.pendingOpens.splice(0))
        this.openPending(pending);
    }
  }

  private openPending(pending: PendingDocument): void {
    try {
      this.opener.open(pending.moduleId, pending.name, pending.instance, pending.title, pending.isPreview);
    }
    catch (error) {
      this.errors.handleError(error);
    }
  }

  private describeRuntimeCommand(info: CommandInfo): CommandContribution {
    return new CommandContribution(
      info.name.text,
      info.title,
      info.icon,
      info.defaultKey?.text ?? null,
      t => this.bridge.requestAsync(ShellMethods.runCommand.text, new CommandRun(info.name, t).toJson()),
      () => this.findRuntimeState(info)?.isEnabled ?? false,
      Object.isNull(info.isChecked) ? null : () => this.findRuntimeState(info)?.isChecked === true);
  }

  private findRuntimeState(info: CommandInfo): CommandInfo | undefined {
    return this.runtimeStates()?.commands.find(t => t.name.text === info.name.text);
  }

  private receiveCommands(name: string, payload: JsonValue): void {
    if (name !== ShellEvents.commandsChanged.text)
      return;
    try {
      this.applyCommands(CommandList.fromJson(payload));
    }
    catch (error) {
      this.errors.handleError(error);
    }
  }

  private applyCommands(commands: CommandList): void {
    const current = this.runtimeStates();
    if (Object.isNull(current) || commands.sequence > current.sequence)
      this.runtimeStates.set(commands);
  }

  private describeFailure(status: ModuleStatus): ModuleFailure {
    const source = this.sources.find(t => t.moduleId === status.id);
    return new ModuleFailure(status.id, source?.displayName ?? status.id, status.state, status.cause, source?.viewNames ?? []);
  }

  private async activateAsync(moduleId: string, active: ReadonlySet<string>): Promise<ModuleStatus> {
    const source = this.sources.find(t => t.moduleId === moduleId);
    if (Object.isUndefined(source))
      return new ModuleStatus(moduleId, ModuleState.Active, null);
    const blocker = source.dependencies.find(t => !active.has(t));
    if (!Object.isUndefined(blocker))
      return new ModuleStatus(moduleId, ModuleState.Blocked, Resources.formatModuleBlocked(blocker));

    let part: IWindowPart;
    try {
      part = await source.load();
    }
    catch (error) {
      this.errors.handleError(error);
      return new ModuleStatus(moduleId, ModuleState.Failed, Resources.windowPartLoadFailed);
    }

    const activation = new WindowPartActivation(new WindowPartContext(source, this), part);
    this.activations.push(activation);
    try {
      await part.activateAsync(activation.context);
    }
    catch (error) {
      this.activations.splice(this.activations.indexOf(activation), 1);
      activation.context.withdraw();
      this.errors.handleError(error);
      return new ModuleStatus(moduleId, ModuleState.Failed, Resources.windowPartActivationFailed);
    }
    return new ModuleStatus(moduleId, ModuleState.Active, null);
  }

  private async deactivateAsync(): Promise<void> {
    for (const activation of this.activations.splice(0).reverse()) {
      try {
        await activation.part.deactivateAsync();
      }
      catch (error) {
        this.errors.handleError(error);
      }
      finally {
        activation.context.withdraw();
      }
    }
  }
}
