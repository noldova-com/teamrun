/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DockSide } from "../enums/dock-side";

export class DropTarget {
  public readonly side: DockSide;
  public readonly index: number;

  public constructor(side: DockSide, index: number) {
    this.side = side;
    this.index = Math.max(0, Math.round(index));
  }

  public equals(other: DropTarget | null): boolean {
    return other !== null && other.side === this.side && other.index === this.index;
  }
}
