/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Menu } from "electron";

import type { DesktopSettings } from "../models/desktop-settings.js";

export class ApplicationMenu {
  public static install(settings: DesktopSettings): void {
    Menu.setApplicationMenu(settings.isMac ? Menu.buildFromTemplate([{ role: "appMenu" }, { role: "editMenu" }, { role: "windowMenu" }]) : null);
  }
}
