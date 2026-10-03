/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { BottomDockSpan } from "../../../../src/app/enums/bottom-dock-span";
import { DockSide } from "../../../../src/app/enums/dock-side";
import { PanelEdge } from "../../../../src/app/enums/panel-edge";
import { SplitAxis } from "../../../../src/app/enums/split-axis";
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

    expect(sides.map(t => geometry.dock(t))).toEqual([new Bounds(0.25, 0, 26, 59.75), new Bounds(94.75, 0, 25, 59.75), new Bounds(0.25, 60, 119.5, 0)]);
    expect(geometry.middle).toEqual(new Bounds(26.5, 0, 68, 59.75));
    expect(geometry.frames.map(t => [t.group.id, t.bounds, t.side])).toEqual([
      [1, new Bounds(0.25, 0, 26, 59.75), DockSide.Left],
      [2, new Bounds(94.75, 0, 25, 59.75), DockSide.Right],
      [0, new Bounds(26.5, 0, 68, 59.75), null]
    ]);
    expect(sides.map(t => [geometry.isShown(t), geometry.isCollapsed(t)])).toEqual([[true, false], [true, false], [false, false]]);
    expect(geometry.handles).toEqual([]);
  });

  it("keeps a strip on the outer edge of each side shown as icons, beside its dock or alone while it is collapsed", () => {
    const icons = new Set([DockSide.Left, DockSide.Right, DockSide.Bottom]);
    const open = new LayoutGeometry(120, 60, initial, registry, icons);
    const collapsed = new LayoutGeometry(120, 60, initial.toggleDock(DockSide.Left), registry, icons);
    const empty = new LayoutGeometry(120, 60, initial.close(LayoutFixture.changes), registry, icons);

    expect(sides.map(t => open.rail(t))).toEqual([new Bounds(0.25, 0, 2.75, 59.75), new Bounds(117, 0, 2.75, 59.75), null]);
    expect([open.dock(DockSide.Left), open.dock(DockSide.Right), open.middle]).toEqual([new Bounds(3.25, 0, 26, 59.75), new Bounds(91.75, 0, 25, 59.75), new Bounds(29.5, 0, 62, 59.75)]);
    expect([collapsed.isCollapsed(DockSide.Left), collapsed.rail(DockSide.Left), collapsed.middle]).toEqual([true, new Bounds(0.25, 0, 2.75, 59.75), new Bounds(3.25, 0, 88.25, 59.75)]);
    expect(collapsed.frames.map(t => t.group.id)).toEqual([2, 0]);
    expect([empty.rail(DockSide.Right), empty.middle]).toEqual([null, new Bounds(29.5, 0, 90.25, 59.75)]);
    expect(new LayoutGeometry(120, 60, initial, registry).rail(DockSide.Left)).toBeNull();
  });

  it("collapses a side shown as icons to its strip alone when the window is too narrow, and keeps its strip across a change of the bottom span", () => {
    const narrow = new LayoutGeometry(30, 60, initial, registry, new Set([DockSide.Left]));
    const spanned = new LayoutGeometry(120, 60, initial.openView(LayoutFixture.terminal, registry), registry, new Set([DockSide.Left])).withBottomSpan(BottomDockSpan.Between);

    expect([narrow.isCollapsed(DockSide.Left), narrow.middle.x]).toEqual([true, 3.25]);
    expect([spanned.rail(DockSide.Left), spanned.dock(DockSide.Bottom).x]).toEqual([new Bounds(0.25, 0, 2.75, 59.75), 29.5]);
    expect(new LayoutGeometry(120, 60, initial.toggleDock(DockSide.Left), registry, new Set([DockSide.Left])).sidePreview(DockSide.Left)).toEqual(new Bounds(3.25, 0, 26, 59.75));
  });

  it("spans the bottom dock across the window, under the side docks and the middle", () => {
    const geometry = new LayoutGeometry(120, 60, initial.openView(LayoutFixture.terminal, registry), registry);

    expect(geometry.middle).toEqual(new Bounds(26.5, 0, 68, 43.25));
    expect(sides.map(t => geometry.dock(t))).toEqual([new Bounds(0.25, 0, 26, 43.25), new Bounds(94.75, 0, 25, 43.25), new Bounds(0.25, 43.5, 119.5, 16.25)]);
    expect(geometry.frameOf(3)?.bounds).toEqual(new Bounds(0.25, 43.5, 119.5, 16.25));
  });

  it("places the bottom dock under the middle, between the side docks, when kept there", () => {
    const geometry = new LayoutGeometry(120, 60, initial.openView(LayoutFixture.terminal, registry).withBottomSpan(BottomDockSpan.Between), registry);

    expect(geometry.middle).toEqual(new Bounds(26.5, 0, 68, 43.25));
    expect(sides.map(t => geometry.dock(t))).toEqual([new Bounds(0.25, 0, 26, 59.75), new Bounds(94.75, 0, 25, 59.75), new Bounds(26.5, 43.5, 68, 16.25)]);
    expect(geometry.frameOf(3)?.bounds).toEqual(new Bounds(26.5, 43.5, 68, 16.25));
  });

  it("never lets a full-width bottom dock squeeze a side dock below its minimum height, nor one the width collapsed", () => {
    const stacked = initial.splitGroup(LayoutFixture.search, 1, PanelEdge.Bottom);
    const tall = stacked.splitGroup(LayoutFixture.changes, stacked.groupOf(LayoutFixture.search)?.id ?? -1, PanelEdge.Bottom)
      .openView(LayoutFixture.terminal, registry).resizeDock(DockSide.Bottom, 100);
    const minimum = tall.dock(DockSide.Left).root?.minimumLength(SplitAxis.Vertical);
    const full = new LayoutGeometry(120, 60, tall, registry);
    const between = new LayoutGeometry(120, 60, tall.withBottomSpan(BottomDockSpan.Between), registry);
    const narrow = new LayoutGeometry(22, 60, tall, registry);

    expect(minimum).toBe(19.25);
    expect([full.dock(DockSide.Left).height, full.dock(DockSide.Bottom).height, full.maximumSize(DockSide.Bottom)]).toEqual([19.25, 40.25, 40.25]);
    expect([between.dock(DockSide.Left).height, between.dock(DockSide.Bottom).height, between.maximumSize(DockSide.Bottom)]).toEqual([59.75, 45.75, 45.75]);
    expect([narrow.isCollapsed(DockSide.Left), narrow.dock(DockSide.Bottom).height]).toEqual([true, 45.75]);
  });

  it("reports how far each dock may grow while the middle keeps its minimum", () => {
    const geometry = new LayoutGeometry(120, 60, initial.openView(LayoutFixture.terminal, registry), registry);

    expect(sides.map(t => geometry.maximumSize(t))).toEqual([80.25, 79.25, 45.75]);
  });

  it("collapses docks that cannot keep their minimum and shows no groups in them", () => {
    const geometry = new LayoutGeometry(30, 20, initial.openView(LayoutFixture.terminal, registry), registry);

    expect(sides.map(t => geometry.isCollapsed(t))).toEqual([true, false, true]);
    expect(sides.map(t => geometry.dock(t))).toEqual([new Bounds(0.25, 0, 2.75, 16.75), new Bounds(17.25, 0, 12.5, 16.75), new Bounds(0.25, 17, 29.5, 2.75)]);
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

  it("previews where a dropped view lands along each side, the bottom across the window and the sides above the bottom dock", () => {
    const geometry = new LayoutGeometry(120, 60, initial.toggleDock(DockSide.Right).resizeDock(DockSide.Bottom, 20), registry);
    const withBottom = new LayoutGeometry(120, 60, initial.toggleDock(DockSide.Left).openView(LayoutFixture.terminal, registry), registry);
    const between = new LayoutGeometry(120, 60, initial.toggleDock(DockSide.Right).resizeDock(DockSide.Bottom, 20).withBottomSpan(BottomDockSpan.Between), registry);

    expect(geometry.sidePreview(DockSide.Left)).toEqual(new Bounds(0.25, 0, 12.875, 59.75));
    expect(geometry.sidePreview(DockSide.Right)).toEqual(new Bounds(94.75, 0, 25, 59.75));
    expect(geometry.sidePreview(DockSide.Bottom)).toEqual(new Bounds(0.25, 39.75, 119.5, 20));
    expect(withBottom.sidePreview(DockSide.Left)).toEqual(new Bounds(0.25, 0, 26, 43.25));
    expect(between.sidePreview(DockSide.Bottom)).toEqual(new Bounds(26.5, 39.75, 90.25, 20));
    expect(between.sidePreview(DockSide.Right)).toEqual(new Bounds(94.75, 0, 25, 59.75));
    expect(new LayoutGeometry(20, 10, Layout.createDefault(ViewRegistry.createEmpty()), registry).sidePreview(DockSide.Bottom))
      .toEqual(new Bounds(0.25, 0, 19.5, 9.75));
  });
});
