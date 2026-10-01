/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DockSide } from "../../enums/dock-side";
import type { Bounds } from "./bounds";
import { DropTarget } from "./drop-target";
import type { Layout } from "./layout";
import type { LayoutGeometry } from "./layout-geometry";
import type { Tab } from "./tab";

export class SideDropTarget extends DropTarget {
  public readonly side: DockSide;

  public constructor(side: DockSide) {
    super();

    this.side = side;
  }

  public override place(layout: Layout, tab: Tab): Layout {
    return layout.dockOnSide(tab, this.side);
  }

  public override preview(geometry: LayoutGeometry): Bounds {
    return geometry.sidePreview(this.side);
  }

  public override equals(other: DropTarget | null): boolean {
    return other instanceof SideDropTarget && other.side === this.side;
  }
}
