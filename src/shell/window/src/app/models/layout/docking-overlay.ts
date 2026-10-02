/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../../resources";
import { DockSide } from "../../enums/dock-side";
import { Bounds } from "./bounds";
import type { GroupFrame } from "./group-frame";
import type { LayoutGeometry } from "./layout-geometry";

export class DockingOverlay {
  private readonly geometry: LayoutGeometry;

  public static readonly plateSize: number = 3 * Resources.dockingGuideSize + 2 * Resources.dockingPlateGap;

  public constructor(geometry: LayoutGeometry) {
    this.geometry = geometry;
  }

  public guide(side: DockSide): Bounds {
    const area = this.geometry.sidePreview(side);
    const size = Resources.dockingGuideSize;
    return new Bounds(area.x + (area.width - size) / 2, area.y + (area.height - size) / 2, size, size);
  }

  public plate(frame: GroupFrame): Bounds {
    const size = DockingOverlay.plateSize;
    const clearance = Resources.dockingPlateClearance;
    let x = frame.bounds.x + (frame.bounds.width - size) / 2;
    let y = frame.bounds.y + (frame.bounds.height - size) / 2;
    for (const side of Object.values(DockSide)) {
      const guide = this.guide(side);
      if (!new Bounds(x, y, size, size).overlaps(guide))
        continue;
      if (side === DockSide.Left)
        x = guide.right + clearance;
      else if (side === DockSide.Right)
        x = guide.x - clearance - size;
      else
        y = guide.y - clearance - size;
    }
    return new Bounds(x, y, size, size);
  }
}
