/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject, JsonValue } from "@noldova/teamrun-foundation-json";
import type { NotificationPost, SettingScope } from "@noldova/teamrun-shell-protocol";

import { WindowPartAccessException } from "../exceptions/window-part-access.exception";
import type { IWindowPartContext } from "../interfaces/i-window-part-context";
import type { IDocumentOptions } from "../interfaces/i-document-options";
import type { IViewDialogOptions } from "../interfaces/i-view-dialog-options";
import type { IWindowPartHost } from "../interfaces/i-window-part-host";
import type { CommandContribution } from "./command-contribution";
import type { DocumentContribution } from "./document-contribution";
import { MenuItem } from "./menu-item";
import type { MenuRowContribution } from "./menu-row-contribution";
import { NotificationHandle } from "./notification-handle";
import { StatusBarItem } from "./status-bar-item";
import type { StatusBarItemContribution } from "./status-bar-item-contribution";
import { TopBarAction } from "./top-bar-action";
import type { TopBarActionContribution } from "./top-bar-action-contribution";
import type { ViewBadge } from "./view-badge";
import type { ViewContribution } from "./view-contribution";
import type { WindowPartSource } from "./window-part-source";
import { Resources } from "../../resources";

export class WindowPartContext implements IWindowPartContext {
  private readonly host: IWindowPartHost;
  private readonly owners: readonly string[];
  private readonly source: WindowPartSource;
  private readonly notificationIds: Set<number> = new Set();
  private readonly commandList: CommandContribution[] = [];
  private readonly statusBarItemList: StatusBarItem[] = [];
  private readonly topBarActionList: TopBarAction[] = [];
  private readonly viewList: ViewContribution[] = [];
  private readonly documentList: DocumentContribution[] = [];
  private readonly subscriptions: (() => void)[] = [];
  private readonly badgedViews: Set<string> = new Set();

  public readonly moduleId: string;

  public constructor(source: WindowPartSource, host: IWindowPartHost) {
    this.moduleId = source.moduleId;
    this.owners = [source.moduleId, ...source.dependencies];
    this.source = source;
    this.host = host;
  }

  public get views(): readonly ViewContribution[] {
    return this.viewList;
  }

  public get documents(): readonly DocumentContribution[] {
    return this.documentList;
  }

  public get commands(): readonly CommandContribution[] {
    return this.commandList;
  }

  public get statusBarItems(): readonly StatusBarItem[] {
    return this.source.statusBarItemNames.flatMap(t => this.statusBarItemList.filter(u => u.name === t));
  }

  public get topBarActions(): readonly TopBarAction[] {
    return this.source.topBarActionNames.flatMap(t => this.topBarActionList.filter(u => u.name === t));
  }

  public registerView(view: ViewContribution): void {
    this.requireDeclared(view.name, this.source.viewNames, this.viewList, Resources.viewKind);
    this.viewList.push(view);
    this.host.refresh();
  }

  public registerDocument(document: DocumentContribution): void {
    this.requireDeclared(document.name, this.source.documentNames, this.documentList, Resources.documentKind);
    this.documentList.push(document);
    this.host.refresh();
  }

  public registerCommand(command: CommandContribution): void {
    this.requireOwn(command.name);
    if (!this.source.commandNames.includes(command.name))
      throw new WindowPartAccessException(Resources.formatUndeclaredCommand(this.moduleId, command.name));
    if (this.host.isCommandRegistered(command.name))
      throw new WindowPartAccessException(Resources.formatCommandRegistered(command.name));
    this.commandList.push(command);
    this.host.refresh();
  }

  public registerStatusBarItem(item: StatusBarItemContribution): StatusBarItem {
    this.requireDeclared(item.name, this.source.statusBarItemNames, this.statusBarItemList, Resources.statusBarItemKind);
    const registered = new StatusBarItem(item, t => {
      if (!Object.isNull(t.command))
        this.requireAllowed(t.command);
    });
    this.statusBarItemList.push(registered);
    this.host.refresh();
    return registered;
  }

  public registerTopBarAction(action: TopBarActionContribution): TopBarAction {
    this.requireDeclared(action.name, this.source.topBarActionNames, this.topBarActionList, Resources.topBarActionKind);
    const registered = new TopBarAction(action, t => this.requireAllowed(t.command));
    this.topBarActionList.push(registered);
    this.host.refresh();
    return registered;
  }

  public provideMenuGroup(group: string, provider: (context: JsonObject) => readonly MenuRowContribution[]): () => void {
    this.requireOwn(group);
    if (!this.host.declaresDynamicMenuGroup(this.moduleId, group))
      throw new WindowPartAccessException(Resources.formatUndeclaredContribution(this.moduleId, Resources.dynamicMenuGroupKind, group));
    const withdraw = this.host.provideMenuGroup(group, context => provider(context).filter(t => this.isAllowed(t.command))
      .map(t => MenuItem.ofCommand(t.command, t.commandArguments, t.label)));
    this.subscriptions.push(withdraw);
    return withdraw;
  }

  public setViewBadge(view: string, badge: ViewBadge | null): void {
    this.requireOwn(view);
    if (!this.source.viewNames.includes(view))
      throw new WindowPartAccessException(Resources.formatUndeclaredContribution(this.moduleId, Resources.viewKind, view));
    if (Object.isNull(badge))
      this.badgedViews.delete(view);
    else
      this.badgedViews.add(view);
    this.host.setViewBadge(view, badge);
  }

  public runCommandAsync(name: string, commandArguments: JsonValue = null): Promise<JsonValue> {
    this.requireAllowed(name);
    return this.host.runCommandAsync(name, commandArguments);
  }

  public async postNotificationAsync(post: NotificationPost): Promise<NotificationHandle> {
    this.requireNotification(post);
    const id = await this.host.postNotificationAsync(post);
    this.notificationIds.add(id);
    return new NotificationHandle(id, t => this.updateNotificationAsync(id, t), () => this.dismissNotification(id));
  }

  public openDocument(name: string, instance: string, title: string, options: IDocumentOptions = {}): void {
    this.requireOwn(name);
    this.host.openDocument(this.moduleId, name, instance, title, options.preview === true);
  }

  public keepDocument(name: string, instance: string): void {
    this.requireOwn(name);
    this.host.keepDocument(this.moduleId, name, instance);
  }

  public async showInDialogAsync(name: string, options: IViewDialogOptions = {}): Promise<void> {
    this.requireReadable(name);
    await this.host.showInDialogAsync(name, options.instance ?? null, options.title ?? null);
  }

  public log(message: string): void {
    this.host.log(this.moduleId, message);
  }

  public async requestAsync(method: string, parameters: JsonValue): Promise<JsonValue> {
    this.requireAllowed(method);
    return this.host.requestAsync(method, parameters);
  }

  public onEvent(event: string, listener: (payload: JsonValue) => void): () => void {
    this.requireAllowed(event);
    const unsubscribe = this.host.onEvent((name, payload) => {
      if (name === event)
        listener(payload);
    });
    this.subscriptions.push(unsubscribe);
    return unsubscribe;
  }

  public readSetting(name: string): JsonValue | undefined {
    this.requireReadable(name);
    return this.host.readSetting(name);
  }

  public async writeSettingAsync(name: string, value: JsonValue, scope: SettingScope | null = null): Promise<void> {
    this.requireOwn(name);
    await this.host.writeSettingAsync(name, value, scope);
  }

  public async resetSettingAsync(name: string, scope: SettingScope | null = null): Promise<void> {
    this.requireOwn(name);
    await this.host.resetSettingAsync(name, scope);
  }

  public onSettingChanged(name: string, listener: (value: JsonValue, scope: SettingScope | null) => void): () => void {
    this.requireReadable(name);
    const unsubscribe = this.host.onSettingChanged(t => {
      if (t.key.name.text === name)
        listener(t.value, t.key.scope);
    });
    this.subscriptions.push(unsubscribe);
    return unsubscribe;
  }

  public withdraw(): void {
    for (const unsubscribe of this.subscriptions.splice(0))
      unsubscribe();
    this.viewList.length = 0;
    this.documentList.length = 0;
    this.commandList.length = 0;
    for (const id of [...this.notificationIds])
      this.dismissNotification(id);
    for (const view of [...this.badgedViews])
      this.host.setViewBadge(view, null);
    this.badgedViews.clear();
    this.statusBarItemList.length = 0;
    this.topBarActionList.length = 0;
    this.host.refresh();
  }

  public forgetNotifications(): void {
    this.notificationIds.clear();
  }

  public isAllowed(name: string): boolean {
    return this.owners.includes(name.substring(0, name.indexOf(Resources.contributionSeparator)));
  }

  private async updateNotificationAsync(id: number, post: NotificationPost): Promise<void> {
    this.requireNotification(post);
    if (this.notificationIds.has(id))
      await this.host.updateNotificationAsync(id, post);
  }

  private dismissNotification(id: number): void {
    if (this.notificationIds.delete(id))
      this.host.dismissNotification(id);
  }

  private requireNotification(post: NotificationPost): void {
    this.requireOwn(post.kind.text);
    if (!this.source.notificationKinds.includes(post.kind.text))
      throw new WindowPartAccessException(Resources.formatUndeclaredContribution(this.moduleId, Resources.notificationKind, post.kind.text));
    for (const command of [...post.open === null ? [] : [post.open], ...post.actions.map(t => t.command)])
      this.requireAllowed(command.name.text);
  }

  private requireOwn(name: string): void {
    if (!name.startsWith(`${this.moduleId}${Resources.contributionSeparator}`))
      throw new WindowPartAccessException(Resources.formatForeignContribution(this.moduleId, name));
  }

  private requireDeclared(name: string, declared: readonly string[], registered: readonly { readonly name: string }[], kind: string): void {
    this.requireOwn(name);
    if (!declared.includes(name))
      throw new WindowPartAccessException(Resources.formatUndeclaredContribution(this.moduleId, kind, name));
    if (registered.some(t => t.name === name))
      throw new WindowPartAccessException(Resources.formatContributionRegistered(kind, name));
  }

  private requireReadable(name: string): void {
    if (!name.startsWith(`${Resources.shellOwner}${Resources.contributionSeparator}`))
      this.requireAllowed(name);
  }

  private requireAllowed(name: string): void {
    if (!this.isAllowed(name))
      throw new WindowPartAccessException(Resources.formatForeignName(this.moduleId, name));
  }
}
