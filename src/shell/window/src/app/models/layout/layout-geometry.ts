/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { Resources } from "../../../resources";
import { DockSide } from "../../enums/dock-side";
import { SplitAxis } from "../../enums/split-axis";
import { Bounds } from "./bounds";
import type { GroupFrame } from "./group-frame";
import type { Layout } from "./layout";
import { LayoutFit } from "./layout-fit";
import type { SplitHandle } from "./split-handle";
import type { ViewRegistry } from "./view-registry";

export class LayoutGeometry {
  private readonly layout: Layout;
  private readonly across: LayoutFit;
  private readonly down: LayoutFit;
  private readonly area: Bounds;
  private readonly dockBounds: Readonly<Record<DockSide, Bounds>>;
  public readonly middle: Bounds;
  public readonly frames: readonly GroupFrame[];
  public readonly handles: readonly SplitHandle[];

  public constructor(width: number, height: number, layout: Layout, registry: ViewRegistry) {
    const visible = layout.withVisibleTabs(registry);
    const margin = Resources.panelMargin;
    const gap = Resources.panelGap;
    const sides = [visible.dock(DockSide.Left), visible.dock(DockSide.Right)];
    const across = LayoutFit.of(width, 2 * margin, sides, visible.middle.minimumLength(SplitAxis.Horizontal));
    const down = LayoutFit.of(height, margin, [visible.dock(DockSide.Bottom)], visible.middle.minimumLength(SplitAxis.Vertical));
    const inner = Math.max(0, height - margin);
    const left = Math.max(0, across.track(DockSide.Left) - gap);
    const right = Math.max(0, across.track(DockSide.Right) - gap);
    const middle = new Bounds(margin + across.track(DockSide.Left), 0, across.middle, down.middle);
    const frames: GroupFrame[] = [];
    const handles: SplitHandle[] = [];
    this.layout = visible;
    this.across = across;
    this.down = down;
    this.area = new Bounds(margin, 0, Math.max(0, width - 2 * margin), inner);
    this.dockBounds = {
      [DockSide.Left]: new Bounds(margin, 0, left, inner),
      [DockSide.Right]: new Bounds(width - margin - right, 0, right, inner),
      [DockSide.Bottom]: new Bounds(middle.x, middle.bottom + gap, middle.width, Math.max(0, down.track(DockSide.Bottom) - gap))
    };
    for (const dock of visible.docks.filter(t => !this.isCollapsed(t.side)))
      dock.root?.arrange(this.dockBounds[dock.side], dock.side, frames, handles);
    visible.middle.arrange(middle, null, frames, handles);
    this.middle = middle;
    this.frames = frames;
    this.handles = handles;
  }

  public dock(side: DockSide): Bounds {
    return this.dockBounds[side];
  }

  public isShown(side: DockSide): boolean {
    return !Object.isNull(this.layout.dock(side).root);
  }

  public isCollapsed(side: DockSide): boolean {
    return this.layout.dock(side).isCollapsed || this.fitOf(side).isCollapsed(side);
  }

  public maximumSize(side: DockSide): number {
    return this.fitOf(side).maximumSize(side);
  }

  public frameOf(groupId: number): GroupFrame | null {
    return this.frames.find(t => t.group.id === groupId) ?? null;
  }

  public sidePreview(side: DockSide): Bounds {
    const dock = this.layout.dock(side);
    const edge = Resources.dockEdges[side];
    if (this.isShown(side) && !this.isCollapsed(side))
      return this.dock(side).edgeHalf(edge);
    const span = side === DockSide.Bottom ? new Bounds(this.middle.x, 0, this.middle.width, this.area.height) : this.area;
    return span.edgeStrip(edge, Math.min(span.length(dock.axis), dock.size ?? Resources.defaultDockSizes[side]));
  }

  private fitOf(side: DockSide): LayoutFit {
    return side === DockSide.Bottom ? this.down : this.across;
  }
}
