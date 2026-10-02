/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";

import { DockSide } from "../../../../src/app/enums/dock-side";
import { SplitAxis } from "../../../../src/app/enums/split-axis";
import { Dock } from "../../../../src/app/models/layout/dock";
import { TabGroup } from "../../../../src/app/models/layout/tab-group";
import { ViewRegistry } from "../../../../src/app/models/layout/view-registry";
import { LayoutFixture } from "../../../fixtures/layout.fixture";

describe("Dock", () => {
  const files = new TabGroup(1, [LayoutFixture.files], LayoutFixture.files);
  const changes = new TabGroup(2, [LayoutFixture.changes], LayoutFixture.changes);
  const pair = LayoutFixture.createSplit(3, SplitAxis.Horizontal, [files, changes], [1, 1]);
  const dock = new Dock(DockSide.Left, files, 30, false);

  it("accepts no size or a finite size of at least the dock minimum", () => {
    expect(() => new Dock(DockSide.Left, files, 9.5, false)).toThrow(ArgumentOutOfRangeException);
    expect(() => new Dock(DockSide.Left, files, Number.POSITIVE_INFINITY, false)).toThrow(ArgumentOutOfRangeException);
    expect(new Dock(DockSide.Left, files, 10, false).size).toBe(10);
    expect(Dock.createEmpty(DockSide.Bottom)).toEqual(new Dock(DockSide.Bottom, null, null, false));
  });

  it("resizes along the axis its edge faces", () => {
    expect([DockSide.Left, DockSide.Right, DockSide.Bottom].map(t => Dock.createEmpty(t).axis))
      .toEqual([SplitAxis.Horizontal, SplitAxis.Horizontal, SplitAxis.Vertical]);
  });

  it("is expanded while it has groups and is not collapsed", () => {
    expect([dock.isExpanded, dock.withCollapsed(true).isExpanded, Dock.createEmpty(DockSide.Left).isExpanded]).toEqual([true, false, false]);
  });

  it("needs the dock minimum or what its groups need, whichever is larger", () => {
    expect(dock.minimumSize).toBe(10);
    expect(dock.withRoot(pair).minimumSize).toBe(20.25);
    expect(Dock.createEmpty(DockSide.Left).minimumSize).toBe(10);
  });

  it("wants its size, its default size or its strip, each with the gap beside it", () => {
    expect(dock.preferredTrack).toBe(30.25);
    expect(dock.withSize(null).preferredTrack).toBe(26.25);
    expect(new Dock(DockSide.Right, files, null, false).preferredTrack).toBe(25.25);
    expect(new Dock(DockSide.Bottom, files, null, false).preferredTrack).toBe(16.5);
    expect(dock.withRoot(pair).withSize(12).preferredTrack).toBe(20.5);
    expect(dock.withCollapsed(true).preferredTrack).toBe(3);
    expect(Dock.createEmpty(DockSide.Left).preferredTrack).toBe(0);
  });

  it("knows which groups it holds", () => {
    expect([dock.holds(1), dock.holds(2), Dock.createEmpty(DockSide.Left).holds(1)]).toEqual([true, false, false]);
  });

  it("changes its root, size and collapsed state, keeping itself when nothing changes", () => {
    expect(dock.withRoot(files)).toBe(dock);
    expect(dock.withRoot(changes).root).toBe(changes);
    expect(dock.withSize(30)).toBe(dock);
    expect(dock.withSize(4).size).toBe(10);
    expect(dock.withSize(null).size).toBeNull();
    expect(() => dock.withSize(Number.NaN)).toThrow(ArgumentOutOfRangeException);
    expect(dock.withCollapsed(false)).toBe(dock);
    expect(dock.withCollapsed(true).isCollapsed).toBe(true);
  });

  it("keeps only groups with registered views", () => {
    expect(dock.withVisibleTabs(LayoutFixture.createRegistry())).toBe(dock);
    expect(dock.withVisibleTabs(ViewRegistry.createEmpty())).toEqual(new Dock(DockSide.Left, null, 30, false));
    expect(Dock.createEmpty(DockSide.Left).withVisibleTabs(ViewRegistry.createEmpty())).toEqual(Dock.createEmpty(DockSide.Left));
  });

  it("writes its root, size and collapsed state", () => {
    expect(dock.toJson()).toEqual({ root: { tabs: [{ view: "files.tree" }], active: 0 }, size: 30, collapsed: false });
    expect(Dock.createEmpty(DockSide.Left).toJson()).toEqual({ root: null, size: null, collapsed: false });
  });
});
