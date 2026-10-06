/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DockSide } from "../../../../src/app/enums/dock-side";
import { PanelEdge } from "../../../../src/app/enums/panel-edge";
import { Bounds } from "../../../../src/app/models/layout/bounds";
import { Layout } from "../../../../src/app/models/layout/layout";
import { LayoutGeometry } from "../../../../src/app/models/layout/layout-geometry";
import { SideDropTarget } from "../../../../src/app/models/layout/side-drop-target";
import { SplitDropTarget } from "../../../../src/app/models/layout/split-drop-target";
import { LayoutFixture } from "../../../fixtures/layout.fixture";
import { LayoutMetricsFixture } from "../../../fixtures/layout-metrics.fixture";

describe("SplitDropTarget", () => {
  const registry = LayoutFixture.createRegistry();
  const layout = Layout.createDefault(registry);
  const geometry = new LayoutGeometry(120, 60, layout, registry, LayoutMetricsFixture.standard);

  it("splits the group with the view and previews the half it takes", () => {
    const target = new SplitDropTarget(0, PanelEdge.Right);

    expect(target.place(layout, LayoutFixture.changes).dock(DockSide.Right).root).toBeNull();
    expect(target.place(layout, LayoutFixture.changes).middle.groups.map(t => t.id)).toEqual([0, 2]);
    expect(target.preview(geometry)).toEqual(new Bounds(60.625, 0, 33.875, 59.75));
    expect(new SplitDropTarget(9, PanelEdge.Right).preview(geometry)).toBeNull();
  });

  it("equals a target for the same group and edge only", () => {
    expect(new SplitDropTarget(1, PanelEdge.Top).equals(new SplitDropTarget(1, PanelEdge.Top))).toBe(true);
    expect(new SplitDropTarget(1, PanelEdge.Top).equals(new SplitDropTarget(2, PanelEdge.Top))).toBe(false);
    expect(new SplitDropTarget(1, PanelEdge.Top).equals(new SplitDropTarget(1, PanelEdge.Left))).toBe(false);
    expect(new SplitDropTarget(1, PanelEdge.Top).equals(new SideDropTarget(DockSide.Left))).toBe(false);
  });
});
