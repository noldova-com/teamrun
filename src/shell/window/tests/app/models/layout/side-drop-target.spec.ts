/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { BottomDockSpan } from "../../../../src/app/enums/bottom-dock-span";
import { DockSide } from "../../../../src/app/enums/dock-side";
import { Bounds } from "../../../../src/app/models/layout/bounds";
import { Layout } from "../../../../src/app/models/layout/layout";
import { LayoutGeometry } from "../../../../src/app/models/layout/layout-geometry";
import { SideDropTarget } from "../../../../src/app/models/layout/side-drop-target";
import { TabDropTarget } from "../../../../src/app/models/layout/tab-drop-target";
import { LayoutFixture } from "../../../fixtures/layout.fixture";
import { LayoutMetricsFixture } from "../../../fixtures/layout-metrics.fixture";

describe("SideDropTarget", () => {
  const registry = LayoutFixture.createRegistry();
  const layout = Layout.createDefault(registry);

  it("docks the view along its side and previews the area it takes", () => {
    const target = new SideDropTarget(DockSide.Bottom);

    expect(target.place(layout, LayoutFixture.files).dock(DockSide.Bottom).root?.groups.map(t => t.tabs)).toEqual([[LayoutFixture.files]]);
    expect(target.preview(new LayoutGeometry(120, 60, layout, registry, LayoutMetricsFixture.standard))).toEqual(new Bounds(0.25, 43.5, 119.5, 16.25));
  });

  it("sets the bottom dock's span with the view it docks, previews the area under that span, and leaves a document alone", () => {
    const between = new SideDropTarget(DockSide.Bottom, BottomDockSpan.Between);
    const placed = between.place(layout, LayoutFixture.files);
    const geometry = new LayoutGeometry(120, 60, layout, registry, LayoutMetricsFixture.standard);

    expect([placed.bottomSpan, placed.dock(DockSide.Bottom).root?.groups.map(t => t.tabs)]).toEqual([BottomDockSpan.Between, [[LayoutFixture.files]]]);
    expect(new SideDropTarget(DockSide.Bottom, BottomDockSpan.Full).place(placed, LayoutFixture.files).bottomSpan).toBe(BottomDockSpan.Full);
    expect(between.place(layout, LayoutFixture.plan)).toBe(layout);
    expect(between.preview(geometry)).toEqual(geometry.withBottomSpan(BottomDockSpan.Between).sidePreview(DockSide.Bottom));
    expect(between.equals(new SideDropTarget(DockSide.Bottom, BottomDockSpan.Between))).toBe(true);
    expect(between.equals(new SideDropTarget(DockSide.Bottom, BottomDockSpan.Full))).toBe(false);
    expect(between.equals(new SideDropTarget(DockSide.Bottom))).toBe(false);
  });

  it("equals a target for the same side only", () => {
    expect(new SideDropTarget(DockSide.Left).equals(new SideDropTarget(DockSide.Left))).toBe(true);
    expect(new SideDropTarget(DockSide.Left).equals(new SideDropTarget(DockSide.Right))).toBe(false);
    expect(new SideDropTarget(DockSide.Left).equals(new TabDropTarget(0, 0))).toBe(false);
    expect(new SideDropTarget(DockSide.Left).equals(null)).toBe(false);
  });
});
