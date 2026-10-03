/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { OverlaySide } from "./overlay-side";

export class OverlayPlacement {
  public readonly left: number;
  public readonly top: number;
  public readonly side: OverlaySide;
  public readonly maxHeight: number | null;

  public constructor(left: number, top: number, side: OverlaySide, maxHeight: number | null) {
    this.left = left;
    this.top = top;
    this.side = side;
    this.maxHeight = maxHeight;
  }
}
