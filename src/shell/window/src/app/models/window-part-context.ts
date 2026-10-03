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
import type { ViewContribution } from "./view-contribution";
import { Resources } from "../../resources";

export class WindowPartContext implements IWindowPartContext {
  private readonly host: IWindowPartHost;
  private readonly owners: readonly string[];
  private readonly commandNames: readonly string[];
  private readonly notificationKinds: readonly string[];
  private readonly notificationIds: Set<number> = new Set();
  private readonly commandList: CommandContribution[] = [];
  private readonly viewList: ViewContribution[] = [];
  private readonly documentList: DocumentContribution[] = [];
  private readonly subscriptions: (() => void)[] = [];

  public readonly moduleId: string;

  public constructor(moduleId: string, dependencies: readonly string[], commandNames: readonly string[], notificationKinds: readonly string[], host: IWindowPartHost) {
    this.moduleId = moduleId;
    this.owners = [moduleId, ...dependencies];
    this.commandNames = [...commandNames];
    this.notificationKinds = [...notificationKinds];
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
    if (!this.commandNames.includes(command.name))
      throw new WindowPartAccessException(Resources.formatUndeclaredCommand(this.moduleId, command.name));
    if (this.host.isCommandRegistered(command.name))
      throw new WindowPartAccessException(Resources.formatCommandRegistered(command.name));
    this.commandList.push(command);
    this.host.refresh();
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
    this.host.refresh();
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
    if (!this.notificationKinds.includes(post.kind.text))
      throw new WindowPartAccessException(Resources.formatUndeclaredNotification(this.moduleId, post.kind.text));
    for (const command of [...post.open === null ? [] : [post.open], ...post.actions.map(t => t.command)])
      this.requireAllowed(command.name.text);
  }

  private requireOwn(name: string): void {
    if (!name.startsWith(`${this.moduleId}${Resources.contributionSeparator}`))
      throw new WindowPartAccessException(Resources.formatForeignContribution(this.moduleId, name));
  }

  private requireAllowed(name: string): void {
    if (!this.owners.includes(name.substring(0, name.indexOf(Resources.contributionSeparator))))
      throw new WindowPartAccessException(Resources.formatForeignName(this.moduleId, name));
  }
}
