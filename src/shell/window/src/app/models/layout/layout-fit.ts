/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../../resources";
import type { DockSide } from "../../enums/dock-side";
import type { Dock } from "./dock";

export class LayoutFit {
  private readonly tracks: ReadonlyMap<DockSide, number>;
  private readonly collapsed: ReadonlySet<DockSide>;
  private readonly middleMinimum: number;
  public readonly middle: number;

  private constructor(tracks: ReadonlyMap<DockSide, number>, collapsed: ReadonlySet<DockSide>, middleMinimum: number, middle: number) {
    this.tracks = tracks;
    this.collapsed = collapsed;
    this.middleMinimum = middleMinimum;
    this.middle = middle;
  }

  public static of(length: number, chrome: number, docks: readonly Dock[], middleMinimum: number): LayoutFit {
    const strip = Resources.dockStripSize + Resources.panelGap;
    const collapsed = new Set<DockSide>();
    const floor = (dock: Dock): number => collapsed.has(dock.side) ? strip : dock.isExpanded ? dock.minimumSize + Resources.panelGap : dock.preferredTrack;
    for (const dock of docks.filter(t => t.isExpanded))
      if (length - chrome - docks.reduce((sum, t) => sum + floor(t), 0) < middleMinimum)
        collapsed.add(dock.side);
    const tracks = new Map(docks.map(t => [t.side, collapsed.has(t.side) ? strip : t.preferredTrack]));
    const room = (): number => length - chrome - [...tracks.values()].reduce((sum, t) => sum + t, 0);
    for (const dock of docks.filter(t => t.isExpanded && !collapsed.has(t.side)))
      tracks.set(dock.side, Math.max(floor(dock), dock.preferredTrack - Math.max(0, middleMinimum - room())));
    return new LayoutFit(tracks, collapsed, middleMinimum, Math.max(0, room()));
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
