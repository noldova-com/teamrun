/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DockSide } from "../../../../src/app/enums/dock-side";
import { Bounds } from "../../../../src/app/models/layout/bounds";
import { DockingOverlay } from "../../../../src/app/models/layout/docking-overlay";
import type { GroupFrame } from "../../../../src/app/models/layout/group-frame";
import { Layout } from "../../../../src/app/models/layout/layout";
import { LayoutGeometry } from "../../../../src/app/models/layout/layout-geometry";
import { Resources } from "../../../../src/resources";
import { LayoutFixture } from "../../../fixtures/layout.fixture";

describe("DockingOverlay", () => {
  const registry = LayoutFixture.createRegistry();
  const sides = [DockSide.Left, DockSide.Right, DockSide.Bottom];

  function frame(geometry: LayoutGeometry, id: number): GroupFrame {
    const found = geometry.frameOf(id);
    if (Object.isNull(found))
      throw new Error(`No frame for group ${id}.`);
    return found;
  }

  it("centers each side guide in the area a docked tab would take", () => {
    const geometry = new LayoutGeometry(120, 60, Layout.createDefault(registry), registry);
    const overlay = new DockingOverlay(geometry);

    for (const side of sides) {
      const area = geometry.sidePreview(side);
      const guide = overlay.guide(side);
      expect([guide.width, guide.height]).toEqual([Resources.dockingGuideSize, Resources.dockingGuideSize]);
      expect(guide.x + guide.width / 2).toBeCloseTo(area.x + area.width / 2);
      expect(guide.y + guide.height / 2).toBeCloseTo(area.y + area.height / 2);
    }
  });

  it("centers a group's plate on the group when no side guide is in the way", () => {
    const geometry = new LayoutGeometry(120, 60, Layout.createDefault(registry), registry);
    const plate = new DockingOverlay(geometry).plate(frame(geometry, 0));

    expect(DockingOverlay.plateSize).toBe(7.75);
    expect(plate).toEqual(new Bounds(26.5 + (68 - 7.75) / 2, (59.75 - 7.75) / 2, 7.75, 7.75));
  });

  it("moves a group's plate clear of the side guide it would cover", () => {
    const layout = Layout.createDefault(registry).openView(LayoutFixture.terminal, registry)
      .resizeDock(DockSide.Left, 10).resizeDock(DockSide.Right, 10).resizeDock(DockSide.Bottom, 10);
    const geometry = new LayoutGeometry(120, 60, layout, registry);
    const overlay = new DockingOverlay(geometry);
    const clearance = Resources.dockingPlateClearance;

    const left = overlay.plate(frame(geometry, 1));
    const right = overlay.plate(frame(geometry, 2));
    const bottom = overlay.plate(frame(geometry, 3));

    expect(left.x).toBeCloseTo(overlay.guide(DockSide.Left).right + clearance);
    expect(right.right).toBeCloseTo(overlay.guide(DockSide.Right).x - clearance);
    expect(bottom.bottom).toBeCloseTo(overlay.guide(DockSide.Bottom).y - clearance);
    for (const plate of [left, right, bottom])
      expect(sides.some(t => plate.overlaps(overlay.guide(t)))).toBe(false);
  });
});
