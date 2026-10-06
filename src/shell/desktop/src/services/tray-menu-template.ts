/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { MenuItemConstructorOptions } from "electron";

import type { Notification } from "@noldova/teamrun-shell-protocol";

import type { ITrayActions } from "../interfaces/i-tray-actions.js";
import { Resources } from "../resources.js";

export class TrayMenuTemplate {
  private static readonly SEPARATOR: MenuItemConstructorOptions = { type: "separator" };
  private static readonly SPACES: RegExp = /\s+/g;

  public static build(work: readonly string[], unread: readonly Notification[], isDoNotDisturb: boolean, actions: ITrayActions): MenuItemConstructorOptions[] {
    const notifications = unread.slice(0, Resources.trayNotificationRows).map(t => ({ label: TrayMenuTemplate.labelOf(t.post.title), click: () => actions.openNotification(t.id) }));
    return [
      { label: Resources.openApplicationLabel, click: () => actions.open() },
      TrayMenuTemplate.SEPARATOR,
      ...TrayMenuTemplate.workRows(work),
      TrayMenuTemplate.SEPARATOR,
      ...notifications.length === 0 ? [] : [...notifications, TrayMenuTemplate.SEPARATOR],
      { label: Resources.doNotDisturbLabel, type: "checkbox", checked: isDoNotDisturb, click: () => actions.setDoNotDisturb(!isDoNotDisturb) },
      TrayMenuTemplate.SEPARATOR,
      { label: Resources.quitApplicationLabel, click: () => actions.quit() }
    ];
  }

  private static workRows(work: readonly string[]): MenuItemConstructorOptions[] {
    if (work.length === 0)
      return [{ label: Resources.noWorkLabel, enabled: false }];
    const rows: MenuItemConstructorOptions[] = work.slice(0, Resources.trayWorkRows).map(t => ({ label: TrayMenuTemplate.labelOf(t), enabled: false }));
    return work.length > Resources.trayWorkRows ? [...rows, { label: Resources.formatMoreWork(work.length - Resources.trayWorkRows), enabled: false }] : rows;
  }

  private static labelOf(text: string): string {
    const line = text.replace(TrayMenuTemplate.SPACES, " ").trim();
    const short = line.length > Resources.trayLabelLimit ? `${line.slice(0, Resources.trayLabelLimit - 1).trimEnd()}${Resources.trayEllipsis}` : line;
    return short.replaceAll("&", "&&");
  }
}
