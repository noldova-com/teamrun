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

  public readonly preferredMiddle: number;
  public readonly closed: ReadonlySet<DockSide>;
  public readonly kept: DockSide | null;

  public constructor(preferredMiddle: number, closed: ReadonlySet<DockSide>, kept: DockSide | null) {
    this.preferredMiddle = preferredMiddle;
    this.closed = closed;
    this.kept = kept;
  }
}
