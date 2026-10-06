/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import type { Notification, NotificationState, WorkReport } from "@noldova/teamrun-shell-protocol";

import { TrayIconState } from "../enums/tray-icon-state.js";
import type { IMenuHost } from "../interfaces/i-menu-host.js";
import type { ITray } from "../interfaces/i-tray.js";
import type { ITrayActions } from "../interfaces/i-tray-actions.js";
import type { ITrayHost } from "../interfaces/i-tray-host.js";
import { Resources } from "../resources.js";
import type { AppIcons } from "./app-icons.js";
import { TrayMenuTemplate } from "./tray-menu-template.js";

export class TrayController {
  private readonly host: ITrayHost;
  private readonly menu: IMenuHost;
  private readonly icons: AppIcons;
  private readonly isMac: boolean;
  private readonly actions: ITrayActions;
  private readonly log: (text: string) => void;
  private tray: ITray | null = null;
  private isEnabled: boolean = false;
  private isHostAvailable: boolean = false;
  private hasFailed: boolean = false;
  private work: WorkReport | null = null;
  private notifications: NotificationState | null = null;
  private image: string = String.empty;
  private toolTip: string = String.empty;
  private menuKey: string = String.empty;

  public constructor(host: ITrayHost, menu: IMenuHost, icons: AppIcons, platform: string, actions: ITrayActions, log: (text: string) => void) {
    this.host = host;
    this.menu = menu;
    this.icons = icons;
    this.isMac = platform === Resources.macPlatform;
    this.actions = actions;
    this.log = log;
  }

  public get isShown(): boolean {
    return !Object.isNull(this.tray);
  }

  public setEnabled(isEnabled: boolean): void {
    this.isEnabled = isEnabled;
    this.update();
  }

  public setHostAvailable(isAvailable: boolean): void {
    this.isHostAvailable = isAvailable;
    this.update();
  }

  public receiveWork(report: WorkReport): void {
    if (!report.isNewerThan(this.work))
      return;
    this.work = report;
    this.update();
  }

  public receiveNotifications(state: NotificationState): void {
    if (!Object.isNull(this.notifications) && state.sequence < this.notifications.sequence)
      return;
    this.notifications = state;
    this.update();
  }

  public clear(): void {
    this.work = null;
    this.notifications = null;
    this.update();
  }

  public dispose(): void {
    this.isEnabled = false;
    this.update();
  }

  private update(): void {
    if (!this.isEnabled || !this.isHostAvailable) {
      this.tray?.destroy();
      this.tray = null;
      this.image = String.empty;
      this.toolTip = String.empty;
      this.menuKey = String.empty;
      return;
    }
    const work = this.work?.descriptions ?? [];
    const unread = this.unread();
    const image = this.icons.tray(TrayController.stateOf(work.length, unread.length));
    const tray = this.show(image);
    if (Object.isNull(tray))
      return;
    if (image !== this.image)
      tray.setImage(image);
    this.image = image;
    const toolTip = Resources.formatTrayToolTip(work.length, unread.length);
    if (toolTip !== this.toolTip)
      tray.setToolTip(toolTip);
    this.toolTip = toolTip;
    const isDoNotDisturb = this.notifications?.isDoNotDisturb ?? false;
    const menuKey = JSON.stringify([work, unread.slice(0, Resources.trayNotificationRows).map(t => [t.id, t.post.title]), isDoNotDisturb]);
    if (menuKey !== this.menuKey)
      tray.setContextMenu(this.menu.buildFromTemplate(TrayMenuTemplate.build(work, unread, isDoNotDisturb, this.actions)));
    this.menuKey = menuKey;
  }

  private show(image: string): ITray | null {
    if (!Object.isNull(this.tray) || this.hasFailed)
      return this.tray;
    try {
      this.tray = this.host.create(image);
    }
    catch (error) {
      this.hasFailed = true;
      this.log(Resources.formatTrayNotShown(String(error)));
      return null;
    }
    this.image = image;
    if (!this.isMac)
      this.tray.on(Resources.clickEvent, () => this.actions.open());
    return this.tray;
  }

  private unread(): readonly Notification[] {
    const state = this.notifications;
    return Object.isNull(state) ? [] : state.notifications.filter(t => !t.isRead && !state.mutedModules.includes(t.post.kind.owner));
  }

  private static stateOf(running: number, unread: number): TrayIconState {
    if (running > 0)
      return unread > 0 ? TrayIconState.Both : TrayIconState.Running;
    return unread > 0 ? TrayIconState.Unread : TrayIconState.Idle;
  }
}
