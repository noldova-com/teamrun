/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PanelEdge } from "../../enums/panel-edge";
import type { Bounds } from "./bounds";
import { DropTarget } from "./drop-target";
import type { Layout } from "./layout";
import type { LayoutGeometry } from "./layout-geometry";
import type { Tab } from "./tab";

export class SplitDropTarget extends DropTarget {
  public readonly groupId: number;
  public readonly edge: PanelEdge;

  public constructor(groupId: number, edge: PanelEdge) {
    super();

    this.groupId = groupId;
    this.edge = edge;
  }

  public override place(layout: Layout, tab: Tab): Layout {
    return layout.splitGroup(tab, this.groupId, this.edge);
  }

  public override preview(geometry: LayoutGeometry): Bounds | null {
    return geometry.frameOf(this.groupId)?.bounds.edgeHalf(this.edge) ?? null;
  }

  public override equals(other: DropTarget | null): boolean {
    return other instanceof SplitDropTarget && other.groupId === this.groupId && other.edge === this.edge;
  }
}
