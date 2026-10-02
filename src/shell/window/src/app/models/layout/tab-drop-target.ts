/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Bounds } from "./bounds";
import { DropTarget } from "./drop-target";
import type { Layout } from "./layout";
import type { LayoutGeometry } from "./layout-geometry";
import type { Tab } from "./tab";

export class TabDropTarget extends DropTarget {
  public readonly groupId: number;
  public readonly index: number;

  public constructor(groupId: number, index: number) {
    super();

    this.groupId = groupId;
    this.index = Math.max(0, Math.round(index));
  }

  public override place(layout: Layout, tab: Tab): Layout {
    return layout.moveTab(tab, this.groupId, this.index);
  }

  public override preview(geometry: LayoutGeometry): Bounds | null {
    return geometry.frameOf(this.groupId)?.bounds ?? null;
  }

  public override equals(other: DropTarget | null): boolean {
    return other instanceof TabDropTarget && other.groupId === this.groupId && other.index === this.index;
  }
}
