/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../../resources";
import { BottomDockSpan } from "../../enums/bottom-dock-span";
import { DockSide } from "../../enums/dock-side";
import { Bounds } from "./bounds";
import type { GroupFrame } from "./group-frame";
import type { LayoutGeometry } from "./layout-geometry";

export class DockingOverlay {
  public static readonly plateSize: number = 3 * Resources.dockingGuideSize + 2 * Resources.dockingPlateGap;

  private readonly geometry: LayoutGeometry;

  public constructor(geometry: LayoutGeometry) {
    this.geometry = geometry;
  }

  public guide(side: DockSide): Bounds {
    if (side !== DockSide.Bottom)
      return DockingOverlay.centered(this.geometry.sidePreview(side));
    const inner = DockingOverlay.centered(this.geometry.withBottomSpan(BottomDockSpan.Between).sidePreview(side));
    const ceiling = this.outerGuide().y - Resources.dockingPlateClearance - inner.height;
    return inner.y > ceiling ? new Bounds(inner.x, ceiling, inner.width, inner.height) : inner;
  }

  public outerGuide(): Bounds {
    const area = this.geometry.area;
    const size = Resources.dockingGuideSize;
    return new Bounds(area.x + (area.width - size) / 2, area.bottom - Resources.panelGap - size, size, size);
  }

  public plate(frame: GroupFrame): Bounds {
    const size = DockingOverlay.plateSize;
    const clearance = Resources.dockingPlateClearance;
    let x = frame.bounds.x + (frame.bounds.width - size) / 2;
    let y = frame.bounds.y + (frame.bounds.height - size) / 2;
    for (const [side, guide] of [...Object.values(DockSide).map(t => [t, this.guide(t)] as const), [DockSide.Bottom, this.outerGuide()] as const]) {
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

  private static centered(area: Bounds): Bounds {
    const size = Resources.dockingGuideSize;
    return new Bounds(area.x + (area.width - size) / 2, area.y + (area.height - size) / 2, size, size);
  }
}
