/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { PanelEdge } from "../../../../src/app/enums/panel-edge";
import { SplitAxis } from "../../../../src/app/enums/split-axis";
import { Bounds } from "../../../../src/app/models/layout/bounds";

describe("Bounds", () => {
  const bounds = new Bounds(2, 3, 40, 20);

  it("rejects coordinates that are not finite and negative sizes", () => {
    expect(() => new Bounds(Number.NaN, 0, 1, 1)).toThrow(ArgumentException);
    expect(() => new Bounds(0, Number.POSITIVE_INFINITY, 1, 1)).toThrow(ArgumentException);
    expect(() => new Bounds(0, 0, -1, 1)).toThrow(ArgumentException);
    expect(() => new Bounds(0, 0, 1, -0.5)).toThrow(ArgumentException);
    expect(new Bounds(-4, -2, 0, 0).right).toBe(-4);
  });

  it("reports its far edges, lengths and equality", () => {
    expect([bounds.right, bounds.bottom]).toEqual([42, 23]);
    expect([bounds.length(SplitAxis.Horizontal), bounds.length(SplitAxis.Vertical)]).toEqual([40, 20]);
    expect(bounds.equals(new Bounds(2, 3, 40, 20))).toBe(true);
    expect(bounds.equals(new Bounds(2, 3, 40, 21))).toBe(false);
    expect(bounds.equals(new Bounds(2, 3, 41, 20))).toBe(false);
    expect(bounds.equals(new Bounds(2, 4, 40, 20))).toBe(false);
    expect(bounds.equals(new Bounds(1, 3, 40, 20))).toBe(false);
    expect(bounds.equals(null)).toBe(false);
  });

  it("slices along an axis", () => {
    expect(bounds.slice(SplitAxis.Horizontal, 10, 5)).toEqual(new Bounds(10, 3, 5, 20));
    expect(bounds.slice(SplitAxis.Vertical, 8, 6)).toEqual(new Bounds(2, 8, 40, 6));
  });

  it("takes a strip and the half along each edge, leaving a gap between halves", () => {
    expect(bounds.edgeStrip(PanelEdge.Left, 4)).toEqual(new Bounds(2, 3, 4, 20));
    expect(bounds.edgeStrip(PanelEdge.Right, 4)).toEqual(new Bounds(38, 3, 4, 20));
    expect(bounds.edgeStrip(PanelEdge.Top, 4)).toEqual(new Bounds(2, 3, 40, 4));
    expect(bounds.edgeStrip(PanelEdge.Bottom, 4)).toEqual(new Bounds(2, 19, 40, 4));
    expect(bounds.edgeHalf(PanelEdge.Left)).toEqual(new Bounds(2, 3, 19.875, 20));
    expect(bounds.edgeHalf(PanelEdge.Bottom)).toEqual(new Bounds(2, 13.125, 40, 9.875));
    expect(new Bounds(0, 0, 0.1, 5).edgeHalf(PanelEdge.Right)).toEqual(new Bounds(0.1, 0, 0, 5));
  });

  it("overlaps another bounds only where they share area", () => {
    const bounds = new Bounds(2, 3, 4, 5);

    expect(bounds.overlaps(new Bounds(5, 7, 4, 4))).toBe(true);
    expect(bounds.overlaps(new Bounds(0, 0, 3, 4))).toBe(true);
    expect(bounds.overlaps(new Bounds(6, 3, 1, 1))).toBe(false);
    expect(bounds.overlaps(new Bounds(2, 8, 1, 1))).toBe(false);
    expect(bounds.overlaps(new Bounds(0, 3, 2, 1))).toBe(false);
    expect(bounds.overlaps(new Bounds(2, 0, 1, 3))).toBe(false);
  });
});
