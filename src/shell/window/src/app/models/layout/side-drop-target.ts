/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import type { BottomDockSpan } from "../../enums/bottom-dock-span";
import type { DockSide } from "../../enums/dock-side";
import type { Bounds } from "./bounds";
import { DropTarget } from "./drop-target";
import type { Layout } from "./layout";
import type { LayoutGeometry } from "./layout-geometry";
import type { Tab } from "./tab";

export class SideDropTarget extends DropTarget {
  public readonly side: DockSide;
  public readonly span: BottomDockSpan | null;

  public constructor(side: DockSide, span: BottomDockSpan | null = null) {
    super();

    this.side = side;
    this.span = span;
  }

  public override place(layout: Layout, tab: Tab): Layout {
    const docked = layout.dockOnSide(tab, this.side);
    return Object.isNull(this.span) || !tab.isMovable ? docked : docked.withBottomSpan(this.span);
  }

  public override preview(geometry: LayoutGeometry): Bounds {
    return (Object.isNull(this.span) ? geometry : geometry.withBottomSpan(this.span)).sidePreview(this.side);
  }

  public override equals(other: DropTarget | null): boolean {
    return other instanceof SideDropTarget && other.side === this.side && other.span === this.span;
  }
}
