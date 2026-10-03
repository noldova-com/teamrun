/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { MenuRow } from "./menu-row";

export class MenuSection {
  public readonly group: string;
  public readonly rows: readonly MenuRow[];

  public constructor(group: string, rows: readonly MenuRow[]) {
    this.group = group;
    this.rows = [...rows];
  }
}
