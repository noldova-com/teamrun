/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { Resources } from "../../../resources";
import { BottomDockSpan } from "../../enums/bottom-dock-span";
import { DockSide } from "../../enums/dock-side";
import { SplitAxis } from "../../enums/split-axis";
import { Bounds } from "./bounds";
import type { Dock } from "./dock";
import { DockYield } from "./dock-yield";
import type { GroupFrame } from "./group-frame";
import type { Layout } from "./layout";
import { LayoutFit } from "./layout-fit";
import type { SplitHandle } from "./split-handle";
import type { ViewRegistry } from "./view-registry";

export class LayoutGeometry {
  private readonly width: number;
  private readonly height: number;
  private readonly registry: ViewRegistry;
  private readonly layout: Layout;
  private readonly across: LayoutFit;
  private readonly down: LayoutFit;
  private readonly dockBounds: Readonly<Record<DockSide, Bounds>>;
  private readonly iconSides: ReadonlySet<DockSide>;
  private readonly yielded: DockYield;
  private readonly railBounds: ReadonlyMap<DockSide, Bounds>;
  public readonly area: Bounds;
  public readonly middle: Bounds;
  public readonly frames: readonly GroupFrame[];
  public readonly handles: readonly SplitHandle[];

  public constructor(width: number, height: number, layout: Layout, registry: ViewRegistry, iconSides: ReadonlySet<DockSide> = new Set(), yielded: DockYield = DockYield.none) {
    const visible = layout.withVisibleTabs(registry);
    const margin = Resources.panelMargin;
    const gap = Resources.panelGap;
    const sides = [visible.dock(DockSide.Left), visible.dock(DockSide.Right)];
    const railed = new Set(sides.filter(t => iconSides.has(t.side) && !Object.isNull(t.root)).map(t => t.side));
    const rail = (side: DockSide): number => railed.has(side) ? Resources.dockStripSize + gap : 0;
    const isFull = visible.bottomSpan === BottomDockSpan.Full;
    const across = LayoutFit.of(width, 2 * margin + rail(DockSide.Left) + rail(DockSide.Right), sides, visible.middle.minimumLength(SplitAxis.Horizontal), railed, yielded);
    const upright = Math.max(visible.middle.minimumLength(SplitAxis.Vertical), ...(isFull ? this.uprightMinimums(sides, across) : []));
    const down = LayoutFit.of(height, margin, [visible.dock(DockSide.Bottom)], upright);
    const inner = Math.max(0, height - margin);
    const sideHeight = isFull ? down.middle : inner;
    const left = Math.max(0, across.track(DockSide.Left) - gap);
    const right = Math.max(0, across.track(DockSide.Right) - gap);
    const middle = new Bounds(margin + rail(DockSide.Left) + across.track(DockSide.Left), 0, across.middle, down.middle);
    const area = new Bounds(margin, 0, Math.max(0, width - 2 * margin), inner);
    const bottomSpan = isFull ? area : middle;
    const frames: GroupFrame[] = [];
    const handles: SplitHandle[] = [];
    this.width = width;
    this.height = height;
    this.registry = registry;
    this.layout = visible;
    this.across = across;
    this.down = down;
    this.area = area;
    this.iconSides = iconSides;
    this.yielded = yielded;
    this.railBounds = new Map([...railed].map(t => [t, new Bounds(t === DockSide.Left ? margin : width - margin - Resources.dockStripSize, 0, Resources.dockStripSize, sideHeight)]));
    this.dockBounds = {
      [DockSide.Left]: new Bounds(margin + rail(DockSide.Left), 0, left, sideHeight),
      [DockSide.Right]: new Bounds(width - margin - rail(DockSide.Right) - right, 0, right, sideHeight),
      [DockSide.Bottom]: new Bounds(bottomSpan.x, middle.bottom + gap, bottomSpan.width, Math.max(0, down.track(DockSide.Bottom) - gap))
    };
    for (const dock of visible.docks.filter(t => !this.isCollapsed(t.side)))
      dock.root?.arrange(this.dockBounds[dock.side], dock.side, frames, handles);
    visible.middle.arrange(middle, null, frames, handles);
    this.middle = middle;
    this.frames = frames;
    this.handles = handles;
  }

  public get closedSides(): ReadonlySet<DockSide> {
    return this.across.collapsed;
  }

  public get isKeeping(): boolean {
    return this.across.isKeeping;
  }

  public dock(side: DockSide): Bounds {
    return this.dockBounds[side];
  }

  public rail(side: DockSide): Bounds | null {
    return this.railBounds.get(side) ?? null;
  }

  public withBottomSpan(span: BottomDockSpan): LayoutGeometry {
    return span === this.layout.bottomSpan ? this : new LayoutGeometry(this.width, this.height, this.layout.withBottomSpan(span), this.registry, this.iconSides, this.yielded);
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
    const span = this.spanOf(side);
    return span.edgeStrip(edge, Math.min(span.length(dock.axis), dock.size ?? Resources.defaultDockSizes[side]));
  }

  private uprightMinimums(sides: readonly Dock[], across: LayoutFit): readonly number[] {
    return sides.flatMap(t => Object.isNull(t.root) || t.isCollapsed || across.isCollapsed(t.side) ? [] : [t.root.minimumLength(SplitAxis.Vertical)]);
  }

  private spanOf(side: DockSide): Bounds {
    const isFull = this.layout.bottomSpan === BottomDockSpan.Full;
    if (side === DockSide.Bottom)
      return isFull ? this.area : new Bounds(this.middle.x, 0, this.middle.width, this.area.height);
    const left = this.railTrack(DockSide.Left);
    const right = this.railTrack(DockSide.Right);
    return new Bounds(this.area.x + left, 0, this.area.width - left - right, isFull ? this.down.middle : this.area.height);
  }

  private railTrack(side: DockSide): number {
    return this.railBounds.has(side) ? Resources.dockStripSize + Resources.panelGap : 0;
  }

  private fitOf(side: DockSide): LayoutFit {
    return side === DockSide.Bottom ? this.down : this.across;
  }
}
