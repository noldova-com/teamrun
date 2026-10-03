/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { MenuItemConstructorOptions } from "electron";

import type { IMenuHost } from "@noldova/teamrun-shell-desktop";

export class FakeMenuHost implements IMenuHost {
  public menu: unknown = undefined;

  public buildFromTemplate(template: MenuItemConstructorOptions[]): unknown {
    return template;
  }

  public setApplicationMenu(menu: unknown): void {
    this.menu = menu;
  }
}
