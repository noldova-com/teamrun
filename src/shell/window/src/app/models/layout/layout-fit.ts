/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { Resources } from "../../../resources";
import type { DockSide } from "../../enums/dock-side";
import type { Dock } from "./dock";
import { DockYield } from "./dock-yield";

export class LayoutFit {
  private readonly tracks: ReadonlyMap<DockSide, number>;
  private readonly middleMinimum: number;
  public readonly collapsed: ReadonlySet<DockSide>;
  public readonly middle: number;

  private constructor(tracks: ReadonlyMap<DockSide, number>, collapsed: ReadonlySet<DockSide>, middleMinimum: number, middle: number) {
    this.tracks = tracks;
    this.collapsed = collapsed;
    this.middleMinimum = middleMinimum;
    this.middle = middle;
  }

  public static of(length: number, chrome: number, docks: readonly Dock[], middleMinimum: number, railed: ReadonlySet<DockSide> = new Set(), yielded: DockYield = DockYield.none): LayoutFit {
    const strip = (dock: Dock): number => railed.has(dock.side) ? 0 : Resources.dockStripSize + Resources.panelGap;
    const preferred = (dock: Dock): number => dock.isCollapsed && railed.has(dock.side) ? 0 : dock.preferredTrack;
    const collapsed = new Set<DockSide>();
    const floor = (dock: Dock): number => collapsed.has(dock.side) ? strip(dock) : dock.isExpanded ? dock.minimumSize + Resources.panelGap : preferred(dock);
    const spare = (): number => length - chrome - docks.reduce((sum, t) => sum + floor(t), 0);
    const wanted = Math.max(middleMinimum, yielded.middle);
    const order = [...docks].reverse();
    for (const dock of order.filter(t => t.isExpanded && t.side !== yielded.kept))
      if (spare() < wanted + (yielded.closed.has(dock.side) ? Resources.dockReopenMargin : 0))
        collapsed.add(dock.side);
    const kept = docks.find(t => t.isExpanded && t.side === yielded.kept);
    if (!Object.isUndefined(kept) && spare() < middleMinimum)
      collapsed.add(kept.side);
    const tracks = new Map(docks.map(t => [t.side, collapsed.has(t.side) ? strip(t) : preferred(t)]));
    const room = (): number => length - chrome - [...tracks.values()].reduce((sum, t) => sum + t, 0);
    for (const dock of order.filter(t => t.isExpanded && !collapsed.has(t.side)))
      tracks.set(dock.side, Math.max(floor(dock), dock.preferredTrack - Math.max(0, wanted - room())));
    return new LayoutFit(tracks, collapsed, wanted, Math.max(0, room()));
  }

  public track(side: DockSide): number {
    return this.tracks.get(side) ?? 0;
  }

  public isCollapsed(side: DockSide): boolean {
    return this.collapsed.has(side);
  }

  public maximumSize(side: DockSide): number {
    return this.track(side) - Resources.panelGap + Math.max(0, this.middle - this.middleMinimum);
  }
}
