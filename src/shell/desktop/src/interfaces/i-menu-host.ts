/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { MenuItemConstructorOptions } from "electron";

export interface IMenuHost {
  buildFromTemplate(template: MenuItemConstructorOptions[]): unknown;
  setApplicationMenu(menu: unknown): void;
}
