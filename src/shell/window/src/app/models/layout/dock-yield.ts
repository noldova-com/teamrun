/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DockSide } from "../../enums/dock-side";

export class DockYield {
  public static readonly none: DockYield = new DockYield(0, new Set(), null);

  public readonly middle: number;
  public readonly closed: ReadonlySet<DockSide>;
  public readonly kept: DockSide | null;

  public constructor(middle: number, closed: ReadonlySet<DockSide>, kept: DockSide | null) {
    this.middle = middle;
    this.closed = closed;
    this.kept = kept;
  }
}
