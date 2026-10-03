/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { CommandRow } from "./command-row";
import type { SubmenuRow } from "./submenu-row";

export class MenuSection {
  public readonly group: string;
  public readonly rows: readonly (CommandRow | SubmenuRow)[];

  public constructor(group: string, rows: readonly (CommandRow | SubmenuRow)[]) {
    this.group = group;
    this.rows = [...rows];
  }
}
