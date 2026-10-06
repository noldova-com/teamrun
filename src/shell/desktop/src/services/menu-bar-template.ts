/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { MenuItemConstructorOptions } from "electron";

import "@noldova/teamrun-foundation-core";
import type { KeyChord } from "@noldova/teamrun-shell-protocol";

import { MenuBarRowType } from "../enums/menu-bar-row-type.js";
import { MenuCheck } from "../enums/menu-check.js";
import type { MenuBar } from "../models/menu-bar.js";
import type { MenuBarMenu } from "../models/menu-bar-menu.js";
import type { MenuBarRow } from "../models/menu-bar-row.js";
import { Resources } from "../resources.js";

export class MenuBarTemplate {
  private static readonly SEPARATOR: MenuItemConstructorOptions = { type: "separator" };
  private static readonly EDIT_ITEMS: readonly MenuItemConstructorOptions[] = [
    { role: "undo" }, { role: "redo" }, MenuBarTemplate.SEPARATOR, { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "pasteAndMatchStyle" },
    { role: "delete" }, { role: "selectAll" }, MenuBarTemplate.SEPARATOR, { label: Resources.speechLabel, submenu: [{ role: "startSpeaking" }, { role: "stopSpeaking" }] }
  ];
  private static readonly APP_ITEMS: readonly MenuItemConstructorOptions[] = [
    { role: "services" }, MenuBarTemplate.SEPARATOR, { role: "hide" }, { role: "hideOthers" }, { role: "unhide" }, MenuBarTemplate.SEPARATOR, { role: "quit" }
  ];
  private static readonly WINDOW_ITEMS: readonly MenuItemConstructorOptions[] = [
    { role: "minimize" }, { role: "zoom" }, MenuBarTemplate.SEPARATOR, { role: "close", label: Resources.closeWindowLabel, accelerator: Resources.closeWindowAccelerator },
    MenuBarTemplate.SEPARATOR, { role: "front" }
  ];

  public static build(bar: MenuBar, run: (id: string) => void): MenuItemConstructorOptions[] {
    const app = bar.menus.find(t => t.place === Resources.appMenu)?.rows.map(t => MenuBarTemplate.itemOf(t, run)) ?? [];
    return [MenuBarTemplate.appMenu(app), ...bar.menus.filter(t => t.place !== Resources.appMenu).flatMap(t => MenuBarTemplate.menuOf(t, run))];
  }

  public static standard(): MenuItemConstructorOptions[] {
    return [MenuBarTemplate.appMenu([]), MenuBarTemplate.editMenu(Resources.editTitle, []), MenuBarTemplate.windowMenu(Resources.windowTitle, [])];
  }

  private static appMenu(rows: readonly MenuItemConstructorOptions[]): MenuItemConstructorOptions {
    return { label: Resources.applicationName, submenu: [{ role: "about" }, MenuBarTemplate.SEPARATOR, ...MenuBarTemplate.before(rows, MenuBarTemplate.APP_ITEMS)] };
  }

  private static editMenu(title: string, rows: readonly MenuItemConstructorOptions[]): MenuItemConstructorOptions {
    return { label: title, submenu: MenuBarTemplate.after(MenuBarTemplate.EDIT_ITEMS, rows) };
  }

  private static windowMenu(title: string, rows: readonly MenuItemConstructorOptions[]): MenuItemConstructorOptions {
    return { label: title, role: "window", submenu: MenuBarTemplate.after(MenuBarTemplate.WINDOW_ITEMS, rows) };
  }

  private static menuOf(menu: MenuBarMenu, run: (id: string) => void): MenuItemConstructorOptions[] {
    const rows = menu.rows.map(t => MenuBarTemplate.itemOf(t, run));
    if (menu.place === Resources.editMenu)
      return [MenuBarTemplate.editMenu(menu.title, rows)];
    if (menu.place === Resources.windowMenu)
      return [MenuBarTemplate.windowMenu(menu.title, rows)];
    if (rows.length === 0)
      return [];
    return [{ label: menu.title, submenu: rows, ...menu.place === Resources.helpMenu ? { role: "help" } : {} }];
  }

  private static before(rows: readonly MenuItemConstructorOptions[], native: readonly MenuItemConstructorOptions[]): MenuItemConstructorOptions[] {
    return rows.length === 0 ? [...native] : [...rows, MenuBarTemplate.SEPARATOR, ...native];
  }

  private static after(native: readonly MenuItemConstructorOptions[], rows: readonly MenuItemConstructorOptions[]): MenuItemConstructorOptions[] {
    return rows.length === 0 ? [...native] : [...native, MenuBarTemplate.SEPARATOR, ...rows];
  }

  private static itemOf(row: MenuBarRow, run: (id: string) => void): MenuItemConstructorOptions {
    if (row.type === MenuBarRowType.Separator)
      return MenuBarTemplate.SEPARATOR;
    if (row.type === MenuBarRowType.Submenu)
      return { label: row.label, submenu: row.rows.map(t => MenuBarTemplate.itemOf(t, run)) };
    const id = String(row.id);
    return {
      id,
      label: row.label,
      enabled: row.isEnabled,
      type: row.check === MenuCheck.Checkbox ? "checkbox" : row.check === MenuCheck.Radio ? "radio" : "normal",
      checked: row.isChecked,
      ...Object.isNull(row.key) ? {} : { accelerator: MenuBarTemplate.acceleratorOf(row.key), registerAccelerator: false },
      click: () => run(id)
    };
  }

  private static acceleratorOf(key: KeyChord): string {
    const modifiers = [[key.hasCtrl, Resources.controlKey], [key.hasAlt, Resources.altKey], [key.hasShift, Resources.shiftKey], [key.hasMod, Resources.commandKey]] as const;
    return [...modifiers.filter(t => t[0]).map(t => t[1]), key.key.label(false)].join(Resources.acceleratorSeparator);
  }
}
