/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { OverlayAlignment } from "../../../src/app/enums/overlay-alignment";
import { OverlayAnchoring } from "../../../src/app/models/overlay-anchoring";
import { OverlayBounds } from "../../../src/app/models/overlay-bounds";
import type { OverlayPlacement } from "../../../src/app/models/overlay-placement";
import { OverlaySide } from "../../../src/app/models/overlay-side";

describe("OverlayBounds", () => {
  const bounds = new OverlayBounds(43, 1432, 856, 8);

  function anchor(left: number, top: number, width: number = 24, height: number = 24): DOMRect {
    return new DOMRect(left, top, width, height);
  }

  function inside(placement: OverlayPlacement, width: number, height: number): boolean {
    const shown = placement.maxHeight ?? height;
    return placement.left >= bounds.left && placement.left + width <= bounds.right && placement.top >= bounds.top && placement.top + shown <= bounds.bottom;
  }

  it("keeps its edges", () => {
    expect([bounds.top, bounds.right, bounds.bottom, bounds.left]).toEqual([43, 1432, 856, 8]);
  });

  it("places on the preferred side a gap away, centered or aligned to an edge with a cross offset", () => {
    const target = anchor(400, 400, 100, 24);

    const above = bounds.place(target, 60, 20, new OverlayAnchoring(OverlaySide.above, OverlayAlignment.Center, 8));
    const below = bounds.place(target, 60, 20, new OverlayAnchoring(OverlaySide.below, OverlayAlignment.Start, 8, 4));
    const end = bounds.place(target, 60, 20, new OverlayAnchoring(OverlaySide.end, OverlayAlignment.Start, 8, -5));
    const start = bounds.place(target, 60, 20, new OverlayAnchoring(OverlaySide.start, OverlayAlignment.End, 8));

    expect([above.side, above.left, above.top, above.maxHeight]).toEqual([OverlaySide.above, 420, 372, null]);
    expect([below.side, below.left, below.top]).toEqual([OverlaySide.below, 404, 432]);
    expect([end.side, end.left, end.top]).toEqual([OverlaySide.end, 508, 395]);
    expect([start.side, start.left, start.top]).toEqual([OverlaySide.start, 332, 404]);
  });

  for (const [name, target, side] of [
    ["the top-left corner", anchor(8, 43), OverlaySide.above],
    ["the top-right corner", anchor(1408, 43), OverlaySide.above],
    ["the bottom-left corner", anchor(8, 832), OverlaySide.below],
    ["the bottom-right corner", anchor(1408, 832), OverlaySide.below],
    ["the left edge", anchor(8, 400), OverlaySide.start],
    ["the right edge", anchor(1408, 400), OverlaySide.end]
  ] as const)
    it(`flips and clamps an overlay anchored at ${name} into its edges`, () => {
      const placement = bounds.place(target, 200, 120, new OverlayAnchoring(side, OverlayAlignment.Center, 8));

      expect(placement.side).toBe(side.opposite);
      expect(inside(placement, 200, 120)).toBe(true);
    });

  it("keeps an overlay anchored inside a chrome band out of that band", () => {
    const placement = bounds.place(anchor(400, 2), 120, 20, new OverlayAnchoring(OverlaySide.above, OverlayAlignment.Center, 8));

    expect(placement.side).toBe(OverlaySide.below);
    expect(placement.top).toBe(43);
  });

  it("lifts an overlay anchored low, in or just above the status bar, clear of the bottom edge", () => {
    const inBand = bounds.place(anchor(1380, 862, 40, 20), 300, 200, new OverlayAnchoring(OverlaySide.above, OverlayAlignment.End, 8));
    const low = bounds.place(anchor(400, 820), 200, 300, new OverlayAnchoring(OverlaySide.below, OverlayAlignment.Start, 8));

    expect([inBand.side, inBand.left, inBand.top, inBand.maxHeight]).toEqual([OverlaySide.above, 1120, 654, null]);
    expect([low.side, low.top, low.maxHeight]).toEqual([OverlaySide.above, 512, null]);
    expect(inside(low, 200, 300)).toBe(true);
  });

  it("gives a menu taller than the window the side with more room and limits its height to that room", () => {
    const short = new OverlayBounds(43, 1432, 392, 8);

    const fromTop = short.place(anchor(100, 60), 200, 500, new OverlayAnchoring(OverlaySide.below, OverlayAlignment.Start, 8));
    const fromBottom = short.place(anchor(100, 340), 200, 500, new OverlayAnchoring(OverlaySide.below, OverlayAlignment.Start, 8));

    expect([fromTop.side, fromTop.top, fromTop.maxHeight]).toEqual([OverlaySide.below, 92, 300]);
    expect([fromBottom.side, fromBottom.top, fromBottom.maxHeight]).toEqual([OverlaySide.above, 43, 289]);
  });

  it("flips a submenu at the right edge to the menu's other side, aligned with its row, and clamps one wider than both sides", () => {
    const row = anchor(1250, 300, 170, 26);

    const flipped = bounds.place(row, 160, 120, new OverlayAnchoring(OverlaySide.end, OverlayAlignment.Start, 0, -5));
    const crowded = bounds.place(anchor(500, 300, 450, 26), 1000, 120, new OverlayAnchoring(OverlaySide.end, OverlayAlignment.Start, 0, -5));
    const tall = bounds.place(row, 160, 1200, new OverlayAnchoring(OverlaySide.end, OverlayAlignment.Start, 0, -5));

    expect([flipped.side, flipped.left, flipped.top]).toEqual([OverlaySide.start, 1090, 295]);
    expect([crowded.side, crowded.left]).toEqual([OverlaySide.start, 8]);
    expect([tall.top, tall.maxHeight]).toEqual([43, 813]);
  });
});
