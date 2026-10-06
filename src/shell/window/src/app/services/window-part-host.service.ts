/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DestroyRef, ErrorHandler, Injectable, type Signal, type WritableSignal, inject, signal } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import type { JsonObject, JsonValue } from "@noldova/teamrun-foundation-json";
import {
  type CommandInfo, CommandList, CommandRun, FailureCode, ModuleState, ModuleStatus, ModuleStatusList, type NotificationPost, NotificationReference, NotificationUpdate,
  type SettingChange, type SettingEntry, type SettingScope, ShellEvents, ShellMethods
} from "@noldova/teamrun-shell-protocol";

import { ContentPadding } from "../enums/content-padding";
import { DockSide } from "../enums/dock-side";
import { RuntimeDisconnectedException } from "../exceptions/runtime-disconnected.exception";
import { RuntimeRequestException } from "../exceptions/runtime-request.exception";
import { WindowPartFailureException } from "../exceptions/window-part-failure.exception";
import type { IWindowPart } from "../interfaces/i-window-part";
import type { IWindowPartHost } from "../interfaces/i-window-part-host";
import { BuildTokens } from "../models/build-tokens";
import { CommandContribution } from "../models/command-contribution";
import { ContributionMatch } from "../models/contribution-match";
import type { DocumentContribution } from "../models/document-contribution";
import { DocumentTab } from "../models/layout/document-tab";
import type { Tab } from "../models/layout/tab";
import { TabLabel } from "../models/layout/tab-label";
import { ViewRegistry } from "../models/layout/view-registry";
import { ViewTab } from "../models/layout/view-tab";
import { ViewType } from "../models/layout/view-type";
import type { MenuItem } from "../models/menu-item";
import { ShellDocuments } from "../models/shell-documents";
import { ModuleFailure } from "../models/module-failure";
import { PendingDocument } from "../models/pending-document";
import type { StartupState } from "../models/startup-state";
import type { ViewBadge } from "../models/view-badge";
import type { ViewContribution } from "../models/view-contribution";
import { WindowPartActivation } from "../models/window-part-activation";
import { WindowPartContext } from "../models/window-part-context";
import type { WindowPartSource } from "../models/window-part-source";
import { Resources } from "../../resources";
import { BarItemsService } from "./bar-items.service";
import { CommandService } from "./command.service";
import { DesktopBridgeService } from "./desktop-bridge.service";
import { DocumentOpenerService } from "./document-opener.service";
import { LayoutService } from "./layout.service";
import { MenuService } from "./menu.service";
import { ModuleStatusService } from "./module-status.service";
import { SettingsService } from "./settings.service";
import { TabLabelService } from "./tab-label.service";
import { ViewDialogService } from "./view-dialog.service";

@Injectable({ providedIn: "root" })
export class WindowPartHostService implements IWindowPartHost {
  private readonly bridge: DesktopBridgeService = inject(DesktopBridgeService);
  private readonly layout: LayoutService = inject(LayoutService);
  private readonly opener: DocumentOpenerService = inject(DocumentOpenerService);
  private readonly labels: TabLabelService = inject(TabLabelService);
  private readonly commands: CommandService = inject(CommandService);
  private readonly bars: BarItemsService = inject(BarItemsService);
  private readonly menus: MenuService = inject(MenuService);
  private readonly statuses: ModuleStatusService = inject(ModuleStatusService);
  private readonly settings: SettingsService = inject(SettingsService);
  private readonly viewDialogs: ViewDialogService = inject(ViewDialogService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly sources: readonly WindowPartSource[] = inject(BuildTokens.sources);
  private readonly activations: WindowPartActivation[] = [];
  private readonly posting: Set<Promise<JsonValue>> = new Set();
  private startOpens: PendingDocument[] = [];
  private pendingOpens: PendingDocument[] = [];
  private moduleOrder: readonly string[] = [];
  private runtimeCommands: readonly CommandContribution[] = [];
  private readonly runtimeStates: WritableSignal<CommandList | null> = signal(null);
  private readonly failuresValue: WritableSignal<readonly ModuleFailure[]> = signal([]);
  private readonly generationValue: WritableSignal<number> = signal(0);
  private readonly revisionsValue: WritableSignal<ReadonlyMap<string, number>> = signal(new Map());
  private readonly changedModules: Set<string> = new Set();
  private connection: number = 0;
  private isReady: boolean = false;
  private isLayoutLoaded: boolean = false;
  private isActivating: boolean = true;
  private reloading: Promise<void> = Promise.resolve();

  public readonly failures: Signal<readonly ModuleFailure[]> = this.failuresValue.asReadonly();
  public readonly generation: Signal<number> = this.generationValue.asReadonly();

  public constructor() {
    this.labels.register(ShellDocuments.settings.name, ShellDocuments.settingsLabel);
    this.labels.register(ShellDocuments.modules.name, ShellDocuments.modulesLabel);
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(this.bridge.onStartup(t => this.follow(t)));
    destroyRef.onDestroy(this.bridge.onEvent((name, payload) => this.receiveCommands(name, payload)));
    void this.bridge.readStartupAsync().then(t => this.follow(t));
  }

  public findContribution(tab: Tab): ContributionMatch | null {
    const shellDocument = ShellDocuments.find(tab);
    if (!Object.isNull(shellDocument))
      return WindowPartHostService.match(shellDocument, null);
    for (const activation of this.activations) {
      const contributions = tab instanceof DocumentTab ? activation.context.documents : activation.context.views;
      const contribution = contributions.find(t => t.name === tab.name);
      if (!Object.isUndefined(contribution))
        return WindowPartHostService.match(contribution, activation.context, activation.part.padding);
    }
    return null;
  }

  public findFailure(tab: Tab): ModuleFailure | null {
    return tab instanceof ViewTab ? this.findFailures().find(t => t.viewNames.includes(tab.name)) ?? null : null;
  }

  public revisionOf(tab: Tab): number {
    const revisions = this.revisionsValue();
    const owner = this.findContribution(tab)?.context?.moduleId ?? this.findFailure(tab)?.moduleId;
    return Object.isUndefined(owner) ? 0 : revisions.get(owner) ?? 0;
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

  public readSettingAsync(name: string, scope: SettingScope | null): Promise<SettingEntry> {
    return this.settings.readAsync(name, scope);
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
    if (this.isActivating)
      this.pendingOpens.push(new PendingDocument(moduleId, name, instance, title, isPreview));
    else
      this.opener.open(moduleId, name, instance, title, isPreview);
  }

  public listSaves(): ReadonlyMap<string, readonly (() => Promise<void>)[]> {
    return new Map(this.activations.filter(t => t.context.saves.length > 0).map(t => [t.context.moduleId, [...t.context.saves]]));
  }

  public log(moduleId: string, message: string): void {
    this.bridge.logModule(moduleId, message);
  }

  public keepDocument(moduleId: string, name: string, instance: string): void {
    this.startOpens = this.startOpens.map(t => t.kept(moduleId, name, instance));
    this.pendingOpens = this.pendingOpens.map(t => t.kept(moduleId, name, instance));
    if (this.isLayoutLoaded)
      this.opener.keep(moduleId, name, instance);
  }

  public async showInDialogAsync(name: string, instance: string | null, title: string | null): Promise<void> {
    const tab = this.layout.registry().hasDocument(name) ? new DocumentTab(name, instance ?? undefined) : new ViewTab(name, instance ?? undefined);
    await this.viewDialogs.showAsync(tab, title);
  }

  public declaresDynamicMenuGroup(moduleId: string, group: string): boolean {
    return this.menus.declaresDynamicGroup(moduleId, group);
  }

  public provideMenuGroup(group: string, provider: (context: JsonObject) => readonly MenuItem[]): () => void {
    return this.menus.provideGroup(group, provider);
  }

  public isCommandRegistered(name: string): boolean {
    return this.runtimeCommands.some(t => t.name === name) || this.activations.some(t => t.context.commands.some(u => u.name === name));
  }

  public runCommandAsync(name: string, commandArguments: JsonValue): Promise<JsonValue> {
    return this.commands.runAsync(name, commandArguments);
  }

  public async postNotificationAsync(post: NotificationPost): Promise<string> {
    const request = this.bridge.requestAsync(ShellMethods.postNotification.text, post.toJson());
    this.posting.add(request);
    try {
      return NotificationReference.fromJson(await request).id;
    }
    finally {
      this.posting.delete(request);
    }
  }

  public async updateNotificationAsync(id: string, post: NotificationPost): Promise<boolean> {
    try {
      await this.bridge.requestAsync(ShellMethods.updateNotification.text, new NotificationUpdate(id, post).toJson());
      return true;
    }
    catch (error) {
      if (error instanceof RuntimeRequestException && error.code === FailureCode.NotFound)
        return false;
      throw error;
    }
  }

  public dismissNotification(id: string): void {
    this.bridge.requestAsync(ShellMethods.dismissNotification.text, new NotificationReference(id).toJson()).catch((error: unknown) => this.errors.handleError(error));
  }

  public setViewBadge(view: string, badge: ViewBadge | null): void {
    this.labels.setBadge(view, badge);
  }

  public refresh(): void {
    this.commands.setCommands(this.moduleOrder.flatMap(t => [
      ...this.runtimeCommands.filter(u => u.name.startsWith(`${t}${Resources.contributionSeparator}`)),
      ...this.activations.find(u => u.context.moduleId === t)?.context.commands ?? []
    ]));
    const ordered = this.moduleOrder.flatMap(t => this.activations.filter(u => u.context.moduleId === t));
    this.bars.set(ordered.flatMap(t => t.context.statusBarItems), ordered.flatMap(t => t.context.topBarActions));
    const failures = this.findFailures();
    const notStarted = new Set(failures.map(t => t.moduleId));
    this.menus.setActiveModules(this.moduleOrder.filter(t => !notStarted.has(t)));
    const views = this.activations.flatMap(t => t.context.views);
    for (const view of views)
      this.labels.register(view.name, new TabLabel(view.title, view.icon));
    const failed = failures.flatMap(t => t.viewNames.map(u => ({ name: u, failure: t })));
    for (const view of failed)
      this.labels.register(view.name, new TabLabel(view.failure.displayName, Resources.moduleFailureGlyph));
    this.layout.setRegistry(new ViewRegistry(
      [...views.map(t => new ViewType(t.name, t.defaultSide, t.isShownByDefault)), ...failed.map(t => new ViewType(t.name, DockSide.Left, false))],
      [...ShellDocuments.all.map(t => t.name), ...this.activations.flatMap(t => t.context.documents.map(u => u.name))]));
  }

  private follow(state: StartupState): void {
    if (!state.isReady)
      this.runtimeStates.set(null);
    if (state.isReady && !this.isReady) {
      const connection = ++this.connection;
      this.reloading = this.reloading.then(() => this.reloadAsync(connection)).catch((error: unknown) => this.errors.handleError(error));
    }
    this.isReady = state.isReady;
  }

  private isConnected(connection: number): boolean {
    return this.isReady && this.connection === connection;
  }

  private async reloadAsync(connection: number): Promise<void> {
    if (!this.isConnected(connection))
      return;
    this.isActivating = true;
    try {
      if (!await this.activateReportedAsync(connection))
        return;
    }
    catch (error) {
      if (!this.isConnected(connection) || RuntimeDisconnectedException.isIn(error))
        return;
      this.errors.handleError(error);
      await this.deactivateAsync(this.activations.slice());
      this.setFailures([]);
      this.moduleOrder = [];
      this.runtimeCommands = [];
    }
    const isReconnect = this.isLayoutLoaded;
    this.startOpens = this.pendingOpens.splice(0);
    let openAtStart: DocumentOpenerService["open"] = isReconnect ? (...t) => this.opener.restore(...t) : (...t) => this.opener.open(...t);
    try {
      await Promise.allSettled(this.posting);
      this.refresh();
      this.revise();
      this.generationValue.update(t => t + 1);
      if (!isReconnect && await this.loadLayoutAsync())
        openAtStart = (...t) => this.opener.restoreSaved(...t);
    }
    catch (error) {
      if (this.isLayoutLoaded || !RuntimeDisconnectedException.isIn(error))
        this.replayPending(openAtStart);
      else
        this.pendingOpens.unshift(...this.startOpens.splice(0));
      throw error;
    }
    this.replayPending(openAtStart);
  }

  private async activateReportedAsync(connection: number): Promise<boolean> {
    await this.settings.loadAsync();
    const report = ModuleStatusList.fromJson(await this.bridge.requestAsync(ShellMethods.modules.text, null));
    this.statuses.report(report.modules);
    const commands = CommandList.fromJson(await this.bridge.requestAsync(ShellMethods.commands.text, null));
    const kept = await this.reconnectPartsAsync(report.modules, connection);
    if (!this.isConnected(connection))
      return false;
    this.moduleOrder = report.modules.map(t => t.id);
    this.applyCommands(commands);
    this.runtimeCommands = commands.commands.map(t => this.describeRuntimeCommand(t));
    await this.deactivateAsync(this.activations.filter(t => !kept.has(t.context.moduleId)));
    const active = new Set<string>();
    const statuses: ModuleStatus[] = [];
    for (const status of report.modules) {
      if (!this.isConnected(connection))
        return false;
      const result = status.state === ModuleState.Active && !kept.has(status.id) ? await this.activateAsync(status, active) : status;
      if (result.state === ModuleState.Active)
        active.add(result.id);
      statuses.push(result);
    }
    this.statuses.set(statuses);
    this.setFailures(statuses.filter(t => t.state !== ModuleState.Active).map(t => this.describeFailure(t)));
    return this.isConnected(connection);
  }

  private async reconnectPartsAsync(modules: readonly ModuleStatus[], connection: number): Promise<ReadonlySet<string>> {
    const kept = new Set<string>();
    for (const status of modules) {
      if (!this.isConnected(connection))
        break;
      const activation = this.activations.find(t => t.context.moduleId === status.id);
      if (Object.isUndefined(activation) || status.state !== ModuleState.Active)
        continue;
      if (activation.source.dependencies.every(t => kept.has(t) || !this.sources.some(u => u.moduleId === t)) && await this.reconnectPartAsync(activation))
        kept.add(status.id);
    }
    return kept;
  }

  private async reconnectPartAsync(activation: WindowPartActivation): Promise<boolean> {
    try {
      return await activation.part.reconnectAsync();
    }
    catch (error) {
      if (RuntimeDisconnectedException.isIn(error))
        throw error;
      this.errors.handleError(new WindowPartFailureException(activation.context.moduleId, Resources.windowPartReconnectionFailed, error));
      return false;
    }
  }

  private findFailures(): readonly ModuleFailure[] {
    return this.failuresValue().filter(t => !this.activations.some(u => u.context.moduleId === t.moduleId));
  }

  private setFailures(failures: readonly ModuleFailure[]): void {
    const previous = this.failuresValue();
    for (const id of new Set([...previous, ...failures].map(t => t.moduleId))) {
      const before = previous.find(t => t.moduleId === id);
      const after = failures.find(t => t.moduleId === id);
      if (before?.state !== after?.state || before?.cause !== after?.cause)
        this.changedModules.add(id);
    }
    this.failuresValue.set(failures);
  }

  private revise(): void {
    const changed = [...this.changedModules];
    this.changedModules.clear();
    if (changed.length > 0)
      this.revisionsValue.update(t => new Map([...t, ...changed.map(u => [u, (t.get(u) ?? 0) + 1] as const)]));
  }

  private async loadLayoutAsync(): Promise<boolean> {
    try {
      const isRestored = await this.layout.loadAsync();
      this.isLayoutLoaded = true;
      return isRestored;
    }
    catch (error) {
      this.isLayoutLoaded = !RuntimeDisconnectedException.isIn(error);
      throw error;
    }
  }

  private replayPending(openAtStart: DocumentOpenerService["open"]): void {
    this.isActivating = false;
    for (const pending of this.startOpens.splice(0))
      this.replay(pending, openAtStart);
    for (const pending of this.pendingOpens.splice(0))
      this.replay(pending, (...t) => this.opener.open(...t));
    this.layout.reopenEarlyDocuments();
  }

  private replay(pending: PendingDocument, open: DocumentOpenerService["open"]): void {
    try {
      open(pending.moduleId, pending.name, pending.instance, pending.title, pending.isPreview);
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
    return new ModuleFailure(status.id, status.displayName, status.state, status.cause, source?.viewNames ?? []);
  }

  private async activateAsync(status: ModuleStatus, active: ReadonlySet<string>): Promise<ModuleStatus> {
    const source = this.sources.find(t => t.moduleId === status.id);
    if (Object.isUndefined(source))
      return status;
    const blocker = source.dependencies.find(t => !active.has(t));
    if (!Object.isUndefined(blocker))
      return status.withState(ModuleState.Blocked, Resources.formatModuleBlocked(blocker), blocker);

    let part: IWindowPart;
    try {
      part = await source.load();
    }
    catch (error) {
      this.errors.handleError(new WindowPartFailureException(status.id, Resources.windowPartLoadFailed, error));
      return status.withState(ModuleState.Failed, Resources.windowPartLoadFailed);
    }

    const activation = new WindowPartActivation(source, new WindowPartContext(source, this), part);
    this.activations.push(activation);
    this.changedModules.add(status.id);
    try {
      await part.activateAsync(activation.context);
    }
    catch (error) {
      this.activations.splice(this.activations.indexOf(activation), 1);
      activation.context.withdraw();
      if (RuntimeDisconnectedException.isIn(error))
        throw error;
      this.errors.handleError(new WindowPartFailureException(status.id, Resources.windowPartActivationFailed, error));
      return status.withState(ModuleState.Failed, Resources.windowPartActivationFailed);
    }
    return status;
  }

  private async deactivateAsync(activations: readonly WindowPartActivation[]): Promise<void> {
    for (const activation of [...activations].reverse()) {
      this.activations.splice(this.activations.indexOf(activation), 1);
      this.changedModules.add(activation.context.moduleId);
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

  private static match(contribution: ViewContribution | DocumentContribution, context: WindowPartContext | null, modulePadding?: ContentPadding): ContributionMatch {
    return new ContributionMatch(contribution.loadComponent, context, contribution.padding ?? modulePadding ?? ContentPadding.Default);
  }
}
