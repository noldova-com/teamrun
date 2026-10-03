/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { DockSide } from "../../../../src/app/enums/dock-side";
import { PanelEdge } from "../../../../src/app/enums/panel-edge";
import { SplitAxis } from "../../../../src/app/enums/split-axis";
import { Bounds } from "../../../../src/app/models/layout/bounds";
import type { GroupFrame } from "../../../../src/app/models/layout/group-frame";
import { TabGroup } from "../../../../src/app/models/layout/tab-group";
import { ViewRegistry } from "../../../../src/app/models/layout/view-registry";
import { ViewTab } from "../../../../src/app/models/layout/view-tab";
import { LayoutFixture } from "../../../fixtures/layout.fixture";

describe("TabGroup", () => {
  const { files, search, changes, plan, terminal, secondTerminal } = LayoutFixture;
  const group = new TabGroup(3, [files, search, changes], search);

  it("holds views with one of them active", () => {
    expect([group.id, group.tabs, group.active, group.isDocuments]).toEqual([3, [files, search, changes], search, false]);
    expect(group.active).toBe(search);
    expect(new TabGroup(3, [files], new ViewTab("files.tree")).active).toBe(files);
    expect([group.groups, group.nodeIds, group.cornerGroup]).toEqual([[group], [3], group]);
    expect([group.has(changes), group.has(plan)]).toEqual([true, false]);
    expect([group.accepts(files), group.accepts(plan)]).toEqual([true, false]);
  });

  it("rejects an empty group, repeated tabs, documents, a missing active tab and a bad id", () => {
    expect(() => new TabGroup(3, [], null)).toThrow(ArgumentException);
    expect(() => new TabGroup(3, [files, new ViewTab("files.tree")], files)).toThrow(ArgumentException);
    expect(() => new TabGroup(3, [files, plan], files)).toThrow(ArgumentException);
    expect(() => new TabGroup(3, [files], null)).toThrow(ArgumentException);
    expect(() => new TabGroup(3, [files], search)).toThrow(ArgumentException);
    expect(() => new TabGroup(-1, [files], files)).toThrow(ArgumentException);
    expect(() => new TabGroup(1.5, [files], files)).toThrow(ArgumentException);
  });

  it("inserts a tab at an index and activates it, moving it when it is already there", () => {

    expect(group.insert(terminal, 1).tabs).toEqual([files, terminal, search, changes]);
    expect(group.insert(terminal, 1).active).toBe(terminal);
    expect(group.insert(terminal, -5).tabs).toEqual([terminal, files, search, changes]);
    expect(group.insert(terminal, 99).tabs).toEqual([files, search, changes, terminal]);
    expect(group.insert(files, 2).tabs).toEqual([search, files, changes]);
    expect(group.insert(files, 3).tabs).toEqual([search, changes, files]);
    expect(group.insert(changes, 0).tabs).toEqual([changes, files, search]);
    expect(group.insert(search, 1)).toBe(group);
    expect(group.insert(files, 0).active).toBe(files);
    expect(() => group.insert(plan, 0)).toThrow(ArgumentException);
  });

  it("removes a tab, activating its neighbour, and closes when the last tab leaves", () => {
    expect(group.without(search)?.tabs).toEqual([files, changes]);
    expect(group.without(search)?.active).toBe(changes);
    expect(group.without(changes)?.active).toBe(search);
    expect(new TabGroup(3, [files, search], search).without(search)?.active).toBe(files);
    expect(group.without(plan)).toBe(group);
    expect(new TabGroup(3, [files], files).without(files)).toBeNull();
  });

  it("activates a tab it holds", () => {
    expect(group.activate(changes).active).toBe(changes);
    expect(group.activate(search)).toBe(group);
    expect(group.activate(plan)).toBe(group);
  });

  it("keeps the tabs whose views are registered", () => {
    const registry = LayoutFixture.createRegistry();
    const gone = new ViewTab("gone.view");

    expect(group.withVisibleTabs(registry)).toBe(group);
    expect(new TabGroup(3, [gone, files], gone).withVisibleTabs(registry)).toEqual(new TabGroup(3, [files], files));
    expect(new TabGroup(3, [gone, files, search], search).withVisibleTabs(registry)?.active).toBe(search);
    expect(group.withVisibleTabs(ViewRegistry.createEmpty())).toBeNull();
  });

  it("replaces, removes and splits itself by id", () => {
    const other = new TabGroup(3, [changes], changes);
    const added = new TabGroup(7, [LayoutFixture.terminal], LayoutFixture.terminal);

    expect(group.withGroup(other)).toBe(other);
    expect(group.withGroup(new TabGroup(4, [changes], changes))).toBe(group);
    expect(group.withoutGroup(3)).toBeNull();
    expect(group.withoutGroup(4)).toBe(group);
    expect(group.splitGroup(3, added, PanelEdge.Bottom, 8)).toEqual(LayoutFixture.createSplit(8, SplitAxis.Vertical, [group, added], [1, 1]));
    expect(group.splitGroup(4, added, PanelEdge.Bottom, 8)).toBe(group);
    expect(group.withSplit()).toBe(group);
  });

  it("has the group minimum on each axis and places itself in its bounds", () => {
    const frames: GroupFrame[] = [];
    const bounds = new Bounds(0, 0, 30, 20);

    expect([group.minimumLength(SplitAxis.Horizontal), group.minimumLength(SplitAxis.Vertical)]).toEqual([10, 6.25]);
    group.arrange(bounds, DockSide.Right, frames);
    expect(frames.map(t => [t.group, t.bounds, t.side])).toEqual([[group, bounds, DockSide.Right]]);
  });

  it("writes its tabs and the index of the active one, and of its preview when it has one", () => {
    expect(group.toJson()).toEqual({ tabs: [{ view: "files.tree" }, { view: "files.search" }, { view: "git.changes" }], active: 1 });
    expect(new TabGroup(3, [files, search], files, search).toJson()).toEqual({ tabs: [{ view: "files.tree" }, { view: "files.search" }], active: 0, preview: 1 });
  });

  it("holds at most one preview, which must be one of its tabs", () => {
    expect(group.preview).toBeNull();
    expect(new TabGroup(3, [files, search], files, new ViewTab("files.search")).preview).toBe(search);
    expect(() => new TabGroup(3, [files], files, search)).toThrow(ArgumentException);
  });

  it("opens a preview at the end, puts the next preview in its place, and only activates a tab it already holds", () => {
    const first = group.openPreview(terminal);
    const second = first.openPreview(secondTerminal);

    expect([first.tabs, first.active, first.preview]).toEqual([[files, search, changes, terminal], terminal, terminal]);
    expect([second.tabs, second.active, second.preview]).toEqual([[files, search, changes, secondTerminal], secondTerminal, secondTerminal]);
    expect(new TabGroup(3, [files, terminal, search], search, terminal).openPreview(changes).tabs).toEqual([files, changes, search]);
    expect([second.openPreview(files).active, second.openPreview(files).preview]).toEqual([files, secondTerminal]);
    expect(() => group.openPreview(plan)).toThrow(ArgumentException);
  });

  it("keeps its preview as a normal tab, and keeps a moved or reordered preview too", () => {
    const previewing = new TabGroup(3, [files, search, changes], files, search);

    expect(previewing.keep(search).preview).toBeNull();
    expect(previewing.keep(files)).toBe(previewing);
    expect([previewing.insert(search, 0).tabs, previewing.insert(search, 0).preview]).toEqual([[search, files, changes], null]);
    expect(previewing.activate(search).insert(search, 1).preview).toBeNull();
    expect(previewing.insert(changes, 0).preview).toBe(search);
    expect(previewing.insert(terminal, 3).preview).toBe(search);
  });

  it("clears its preview when the preview closes or its view goes away, and keeps it otherwise", () => {
    const previewing = new TabGroup(3, [files, search, changes], files, search);
    const gone = new ViewTab("gone.view");
    const registry = LayoutFixture.createRegistry();

    expect(previewing.without(search)?.preview).toBeNull();
    expect(previewing.without(changes)?.preview).toBe(search);
    expect(previewing.activate(changes).preview).toBe(search);
    expect(new TabGroup(3, [gone, files], files, gone).withVisibleTabs(registry)?.preview).toBeNull();
    expect(new TabGroup(3, [gone, files], files, files).withVisibleTabs(registry)?.preview).toBe(files);
  });
});
