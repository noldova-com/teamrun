/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DockSide } from "../enums/dock-side";
import { Resources } from "../resources";

export class DropPreview {
  public readonly side: DockSide;
  public readonly size: string;
  public readonly leftTrack: string;
  public readonly rightTrack: string;

  public constructor(side: DockSide, size: string, leftTrack: string, rightTrack: string) {
    this.side = side;
    this.size = size;
    this.leftTrack = leftTrack;
    this.rightTrack = rightTrack;
  }

  public get width(): string | null {
    return this.side === DockSide.Bottom ? null : this.size;
  }

  public get height(): string | null {
    return this.side === DockSide.Bottom ? this.size : null;
  }

  public get left(): string | null {
    if (this.side === DockSide.Left)
      return "0";

    return this.side === DockSide.Bottom ? this.leftTrack : null;
  }

  public get right(): string | null {
    if (this.side === DockSide.Right)
      return "0";

    return this.side === DockSide.Bottom ? this.rightTrack : null;
  }

  public get top(): string | null {
    return this.side === DockSide.Bottom ? null : "0";
  }

  public get centerX(): string {
    switch (this.side) {
      case DockSide.Left:
        return Resources.formatNearCenter(this.size);
      case DockSide.Right:
        return Resources.formatFarCenter(this.size);
      default:
        return Resources.formatMiddleCenter(this.leftTrack, this.rightTrack);
    }
  }

  public get centerY(): string {
    return this.side === DockSide.Bottom ? Resources.formatFarCenter(this.size) : Resources.fullCenter;
  }
}
