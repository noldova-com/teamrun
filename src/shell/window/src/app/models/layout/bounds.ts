/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../../../resources";
import type { PanelEdge } from "../../enums/panel-edge";
import { SplitAxis } from "../../enums/split-axis";

export class Bounds {
  public readonly x: number;
  public readonly y: number;
  public readonly width: number;
  public readonly height: number;

  public constructor(x: number, y: number, width: number, height: number) {
    if (![x, y, width, height].every(t => Number.isFinite(t)) || width < 0 || height < 0)
      throw new ArgumentException(Resources.invalidBounds);

    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  public get right(): number {
    return this.x + this.width;
  }

  public get bottom(): number {
    return this.y + this.height;
  }

  public equals(other: Bounds | null): boolean {
    return other?.x === this.x && other.y === this.y && other.width === this.width && other.height === this.height;
  }

  public length(axis: SplitAxis): number {
    return axis === SplitAxis.Horizontal ? this.width : this.height;
  }

  public slice(axis: SplitAxis, start: number, length: number): Bounds {
    if (axis === SplitAxis.Horizontal)
      return new Bounds(start, this.y, length, this.height);
    return new Bounds(this.x, start, this.width, length);
  }

  public edgeStrip(edge: PanelEdge, length: number): Bounds {
    const axis = Resources.edgeAxes[edge];
    const start = axis === SplitAxis.Horizontal ? this.x : this.y;
    return this.slice(axis, Resources.leadingEdges.includes(edge) ? start : start + this.length(axis) - length, length);
  }

  public edgeHalf(edge: PanelEdge): Bounds {
    return this.edgeStrip(edge, Math.max(0, (this.length(Resources.edgeAxes[edge]) - Resources.panelGap) / 2));
  }
}
