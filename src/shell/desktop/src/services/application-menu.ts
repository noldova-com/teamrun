/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IMenuHost } from "../interfaces/i-menu-host.js";
import type { DesktopSettings } from "../models/desktop-settings.js";

export class ApplicationMenu {
  public static install(menu: IMenuHost, settings: DesktopSettings): void {
    menu.setApplicationMenu(settings.isMac ? menu.buildFromTemplate([{ role: "appMenu" }, { role: "editMenu" }, { role: "windowMenu" }]) : null);
  }
}
