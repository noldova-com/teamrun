/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/teamrun-foundation-json";
import type { NotificationPost } from "@noldova/teamrun-shell-protocol";

import { WindowPartAccessException } from "../exceptions/window-part-access.exception";
import type { IWindowPartContext } from "../interfaces/i-window-part-context";
import type { IDocumentOptions } from "../interfaces/i-document-options";
import type { IWindowPartHost } from "../interfaces/i-window-part-host";
import type { CommandContribution } from "./command-contribution";
import type { DocumentContribution } from "./document-contribution";
import { NotificationHandle } from "./notification-handle";
import { StatusBarItem } from "./status-bar-item";
import type { StatusBarItemContribution } from "./status-bar-item-contribution";
import { TopBarAction } from "./top-bar-action";
import type { TopBarActionContribution } from "./top-bar-action-contribution";
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
    this.requireOwn(view.name);
    this.viewList.push(view);
    this.host.refresh();
  }

  public registerDocument(document: DocumentContribution): void {
    this.requireOwn(document.name);
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

  public withdraw(): void {
    for (const unsubscribe of this.subscriptions.splice(0))
      unsubscribe();
    this.viewList.length = 0;
    this.documentList.length = 0;
    this.commandList.length = 0;
    for (const id of [...this.notificationIds])
      this.dismissNotification(id);
    this.statusBarItemList.length = 0;
    this.topBarActionList.length = 0;
    this.host.refresh();
  }

  public isAllowed(name: string): boolean {
    return this.owners.includes(name.substring(0, name.indexOf(Resources.contributionSeparator)));
  }

  private async updateNotificationAsync(id: number, post: NotificationPost): Promise<void> {
    this.requireNotification(post);
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

  private requireAllowed(name: string): void {
    if (!this.isAllowed(name))
      throw new WindowPartAccessException(Resources.formatForeignName(this.moduleId, name));
  }
}
