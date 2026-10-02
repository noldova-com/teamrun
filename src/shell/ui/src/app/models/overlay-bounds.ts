/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources";
import type { OverlayAnchoring } from "./overlay-anchoring";
import { OverlayPlacement } from "./overlay-placement";
import type { OverlaySide } from "./overlay-side";

export class OverlayBounds {
  public readonly top: number;
  public readonly right: number;
  public readonly bottom: number;
  public readonly left: number;

  public constructor(top: number, right: number, bottom: number, left: number) {
    this.top = top;
    this.right = right;
    this.bottom = bottom;
    this.left = left;
  }

  public place(anchor: DOMRect, width: number, height: number, anchoring: OverlayAnchoring): OverlayPlacement {
    const preferred = anchoring.side;
    const opposite = preferred.opposite;
    for (const side of [preferred, opposite])
      if (this.fits(side, anchor, width, height, anchoring.gap))
        return this.placeOn(side, anchor, width, height, anchoring);
    const side = this.roomOn(preferred, anchor, anchoring.gap) >= this.roomOn(opposite, anchor, anchoring.gap) ? preferred : opposite;
    return this.placeOn(side, anchor, width, height, anchoring);
  }

  private fits(side: OverlaySide, anchor: DOMRect, width: number, height: number, gap: number): boolean {
    const across = side.isVertical ? width <= this.right - this.left : height <= this.bottom - this.top;
    return across && (side.isVertical ? height : width) <= this.roomOn(side, anchor, gap);
  }

  private roomOn(side: OverlaySide, anchor: DOMRect, gap: number): number {
    if (side.isVertical)
      return side.isForward ? this.bottom - anchor.bottom - gap : anchor.top - gap - this.top;
    return side.isForward ? this.right - anchor.right - gap : anchor.left - gap - this.left;
  }

  private placeOn(side: OverlaySide, anchor: DOMRect, width: number, height: number, anchoring: OverlayAnchoring): OverlayPlacement {
    if (side.isVertical) {
      const shown = Math.min(height, Math.max(0, this.roomOn(side, anchor, anchoring.gap)));
      const top = this.clamp(side.isForward ? anchor.bottom + anchoring.gap : anchor.top - anchoring.gap - shown, this.top, this.bottom - shown);
      const left = this.clamp(this.alignedStart(anchor.left, anchor.width, width, anchoring), this.left, this.right - width);
      return new OverlayPlacement(left, top, side, shown < height ? shown : null);
    }
    const shown = Math.min(height, this.bottom - this.top);
    const left = this.clamp(side.isForward ? anchor.right + anchoring.gap : anchor.left - anchoring.gap - width, this.left, this.right - width);
    const top = this.clamp(this.alignedStart(anchor.top, anchor.height, shown, anchoring), this.top, this.bottom - shown);
    return new OverlayPlacement(left, top, side, shown < height ? shown : null);
  }

  private alignedStart(anchorStart: number, anchorSize: number, size: number, anchoring: OverlayAnchoring): number {
    const factor = Resources.overlayAlignmentFactors[anchoring.alignment];
    return anchorStart + (anchorSize - size) * factor + anchoring.crossOffset * (1 - 2 * factor);
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    return Math.max(minimum, Math.min(value, maximum));
  }
}
