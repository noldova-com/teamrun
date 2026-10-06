/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../../resources";
import { DockSide } from "../../enums/dock-side";
import { SplitAxis } from "../../enums/split-axis";

export class LayoutMetrics {
  public static readonly none: LayoutMetrics = new LayoutMetrics(0, 0, 0, 0, 0,
    { [SplitAxis.Horizontal]: 0, [SplitAxis.Vertical]: 0 }, { [DockSide.Left]: 0, [DockSide.Right]: 0, [DockSide.Bottom]: 0 });

  public readonly gap: number;
  public readonly margin: number;
  public readonly dockMinimum: number;
  public readonly strip: number;
  public readonly documentMinimum: number;
  public readonly groupMinimums: Readonly<Record<SplitAxis, number>>;
  public readonly dockSizes: Readonly<Record<DockSide, number>>;

  public constructor(gap: number, margin: number, dockMinimum: number, strip: number, documentMinimum: number,
    groupMinimums: Readonly<Record<SplitAxis, number>>, dockSizes: Readonly<Record<DockSide, number>>) {
    this.gap = gap;
    this.margin = margin;
    this.dockMinimum = dockMinimum;
    this.strip = strip;
    this.documentMinimum = documentMinimum;
    this.groupMinimums = groupMinimums;
    this.dockSizes = dockSizes;
  }

  public static measure(probe: HTMLElement, rootSize: number): LayoutMetrics {
    const read = (name: string): number => {
      probe.style.width = Resources.formatLookValue(name);
      return probe.getBoundingClientRect().width / rootSize;
    };
    const minimums = Resources.groupMinimumLooks;
    const sizes = Resources.dockSizeLooks;
    return new LayoutMetrics(read(Resources.panelGapLook), read(Resources.panelMarginLook), read(Resources.dockMinimumLook), read(Resources.dockStripLook),
      read(Resources.documentMinimumLook), { [SplitAxis.Horizontal]: read(minimums[SplitAxis.Horizontal]), [SplitAxis.Vertical]: read(minimums[SplitAxis.Vertical]) },
      { [DockSide.Left]: read(sizes[DockSide.Left]), [DockSide.Right]: read(sizes[DockSide.Right]), [DockSide.Bottom]: read(sizes[DockSide.Bottom]) });
  }
}
