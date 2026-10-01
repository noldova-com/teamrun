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
import { ViewRegistry } from "../../../../src/app/models/layout/view-registry";
import { ViewType } from "../../../../src/app/models/layout/view-type";
import { LayoutFixture } from "../../../fixtures/layout.fixture";

describe("LayoutGeometry", () => {
  const registry = LayoutFixture.createRegistry();
  const initial = Layout.createDefault(registry);
  const sides = [DockSide.Left, DockSide.Right, DockSide.Bottom];

  it("places the docks at their preferred sizes and gives the middle the rest", () => {
    const geometry = new LayoutGeometry(120, 60, initial, registry);

    expect(sides.map(t => geometry.dock(t))).toEqual([new Bounds(0.25, 0, 26, 59.75), new Bounds(94.75, 0, 25, 59.75), new Bounds(26.5, 60, 68, 0)]);
    expect(geometry.middle).toEqual(new Bounds(26.5, 0, 68, 59.75));
    expect(geometry.frames.map(t => [t.group.id, t.bounds, t.side])).toEqual([
      [1, new Bounds(0.25, 0, 26, 59.75), DockSide.Left],
      [2, new Bounds(94.75, 0, 25, 59.75), DockSide.Right],
      [0, new Bounds(26.5, 0, 68, 59.75), null]
    ]);
    expect(sides.map(t => [geometry.isShown(t), geometry.isCollapsed(t)])).toEqual([[true, false], [true, false], [false, false]]);
    expect(geometry.handles).toEqual([]);
  });

  it("places the bottom dock under the middle", () => {
    const geometry = new LayoutGeometry(120, 60, initial.openView(LayoutFixture.terminal, registry), registry);

    expect(geometry.middle).toEqual(new Bounds(26.5, 0, 68, 43.25));
    expect(geometry.dock(DockSide.Bottom)).toEqual(new Bounds(26.5, 43.5, 68, 16.25));
    expect(geometry.frameOf(3)?.bounds).toEqual(new Bounds(26.5, 43.5, 68, 16.25));
  });

  it("reports how far each dock may grow while the middle keeps its minimum", () => {
    const geometry = new LayoutGeometry(120, 60, initial.openView(LayoutFixture.terminal, registry), registry);

    expect(sides.map(t => geometry.maximumSize(t))).toEqual([80.25, 79.25, 45.75]);
  });

  it("collapses docks that cannot keep their minimum and shows no groups in them", () => {
    const geometry = new LayoutGeometry(30, 20, initial.openView(LayoutFixture.terminal, registry), registry);

    expect(sides.map(t => geometry.isCollapsed(t))).toEqual([true, false, true]);
    expect(sides.map(t => geometry.dock(t).width)).toEqual([2.75, 12.5, 13.75]);
    expect(geometry.dock(DockSide.Bottom).height).toBe(2.75);
    expect(geometry.middle).toEqual(new Bounds(3.25, 0, 13.75, 16.75));
    expect(geometry.frames.map(t => t.group.id)).toEqual([2, 0]);
  });

  it("keeps a collapsed dock's strip without placing its groups", () => {
    const geometry = new LayoutGeometry(120, 60, initial.toggleDock(DockSide.Right), registry);

    expect([geometry.isCollapsed(DockSide.Right), geometry.dock(DockSide.Right)]).toEqual([true, new Bounds(117, 0, 2.75, 59.75)]);
    expect(geometry.frames.map(t => t.group.id)).toEqual([1, 0]);
  });

  it("leaves out the docks and views whose modules are absent", () => {
    const partial = new ViewRegistry([new ViewType("files.tree", DockSide.Left, true)], []);
    const geometry = new LayoutGeometry(120, 60, initial, partial);

    expect([geometry.isShown(DockSide.Right), geometry.dock(DockSide.Right).width]).toEqual([false, 0]);
    expect(geometry.middle).toEqual(new Bounds(26.5, 0, 93.25, 59.75));
    expect(new LayoutGeometry(120, 60, initial, ViewRegistry.createEmpty()).middle).toEqual(new Bounds(0.25, 0, 119.5, 59.75));
  });

  it("arranges the groups of a split dock and its handles", () => {
    const split = initial.splitGroup(LayoutFixture.changes, 1, PanelEdge.Bottom);
    const geometry = new LayoutGeometry(120, 60, split, registry);

    expect([geometry.frameOf(1)?.bounds, geometry.frameOf(2)?.bounds]).toEqual([new Bounds(0.25, 0, 26, 29.75), new Bounds(0.25, 30, 26, 29.75)]);
    expect(geometry.handles.map(t => t.bounds)).toEqual([new Bounds(0.25, 29.75, 26, 0.25)]);
    expect(geometry.frameOf(9)).toBeNull();
  });

  it("previews where a dropped view lands along each side", () => {
    const geometry = new LayoutGeometry(120, 60, initial.toggleDock(DockSide.Right).resizeDock(DockSide.Bottom, 20), registry);

    expect(geometry.sidePreview(DockSide.Left)).toEqual(new Bounds(0.25, 0, 12.875, 59.75));
    expect(geometry.sidePreview(DockSide.Right)).toEqual(new Bounds(94.75, 0, 25, 59.75));
    expect(geometry.sidePreview(DockSide.Bottom)).toEqual(new Bounds(26.5, 39.75, 90.25, 20));
    expect(new LayoutGeometry(20, 10, Layout.createDefault(ViewRegistry.createEmpty()), registry).sidePreview(DockSide.Bottom))
      .toEqual(new Bounds(0.25, 0, 19.5, 9.75));
  });
});
