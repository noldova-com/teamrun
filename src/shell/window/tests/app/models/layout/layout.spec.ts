/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { BottomDockSpan } from "../../../../src/app/enums/bottom-dock-span";
import { DockSide } from "../../../../src/app/enums/dock-side";
import { PanelEdge } from "../../../../src/app/enums/panel-edge";
import { SplitAxis } from "../../../../src/app/enums/split-axis";
import { Bounds } from "../../../../src/app/models/layout/bounds";
import { Dock } from "../../../../src/app/models/layout/dock";
import { DocumentGroup } from "../../../../src/app/models/layout/document-group";
import { DocumentTab } from "../../../../src/app/models/layout/document-tab";
import { Layout } from "../../../../src/app/models/layout/layout";
import { LayoutReader } from "../../../../src/app/models/layout/layout.reader";
import { ToolbarLayout } from "../../../../src/app/models/layout/toolbar-layout";
import { SplitHandle } from "../../../../src/app/models/layout/split-handle";
import type { SplitNode } from "../../../../src/app/models/layout/split.node";
import type { Tab } from "../../../../src/app/models/layout/tab";
import { TabGroup } from "../../../../src/app/models/layout/tab-group";
import { ViewRegistry } from "../../../../src/app/models/layout/view-registry";
import { ViewTab } from "../../../../src/app/models/layout/view-tab";
import { ViewType } from "../../../../src/app/models/layout/view-type";
import { LayoutFixture } from "../../../fixtures/layout.fixture";

describe("Layout", () => {
  const { files, search, changes, terminal, plan, todo, settings, createSplit } = LayoutFixture;
  const registry = LayoutFixture.createRegistry();
  const initial = Layout.createDefault(registry);
  const group = (id: number, ...tabs: readonly ViewTab[]): TabGroup => new TabGroup(id, tabs, tabs[0] ?? null);

  it("starts with each default view in its dock and an empty documents group", () => {
    expect(initial.docks.map(t => t.side)).toEqual([DockSide.Left, DockSide.Right, DockSide.Bottom]);
    expect(initial.dock(DockSide.Left)).toEqual(new Dock(DockSide.Left, group(1, files), null, false));
    expect(initial.dock(DockSide.Right)).toEqual(new Dock(DockSide.Right, group(2, changes), null, false));
    expect(initial.dock(DockSide.Bottom)).toEqual(Dock.createEmpty(DockSide.Bottom));
    expect([initial.middle, initial.documents]).toEqual([DocumentGroup.createEmpty(), DocumentGroup.createEmpty()]);
    expect(Layout.createDefault(ViewRegistry.createEmpty()).docks.map(t => t.root)).toEqual([null, null, null]);
  });

  it("needs a documents group, in the middle, and one dock per side", () => {
    expect(() => new Layout([], null)).toThrow(ArgumentException);
    expect(() => new Layout([], group(1, files))).toThrow(ArgumentException);
    expect(() => new Layout([new Dock(DockSide.Left, DocumentGroup.createEmpty(), null, false)], createSplit(1, SplitAxis.Horizontal, [
      group(2, files),
      new DocumentGroup([plan], plan)
    ], [1, 1]))).toThrow(ArgumentException);
    expect(() => new Layout([Dock.createEmpty(DockSide.Left), Dock.createEmpty(DockSide.Left)], DocumentGroup.createEmpty())).toThrow(ArgumentException);
    expect(new Layout([], DocumentGroup.createEmpty()).docks).toEqual([DockSide.Left, DockSide.Right, DockSide.Bottom].map(t => Dock.createEmpty(t)));
  });

  it("allows each tab and each group or split id only once", () => {
    expect(() => new Layout([new Dock(DockSide.Left, group(1, files), null, false)], new DocumentGroup([files], files))).toThrow(ArgumentException);
    expect(() => new Layout([new Dock(DockSide.Left, group(1, files), null, false), new Dock(DockSide.Right, group(1, changes), null, false)],
      DocumentGroup.createEmpty())).toThrow(ArgumentException);
  });

  it("finds groups by id and by tab, and the dock that holds a group", () => {
    expect(initial.groups.map(t => t.id)).toEqual([1, 2, 0]);
    expect([initial.group(2)?.tabs, initial.group(9)]).toEqual([[changes], null]);
    expect([initial.groupOf(files)?.id, initial.groupOf(plan)]).toEqual([1, null]);
    expect([initial.sideOf(1), initial.sideOf(2), initial.sideOf(0), initial.sideOf(9)]).toEqual([DockSide.Left, DockSide.Right, null, null]);
    expect([initial.isOpen(files), initial.isOpen(search)]).toEqual([true, false]);
  });

  it("opens a view in its default dock, beside the views already there", () => {
    const opened = initial.openView(terminal, registry).openView(search, registry);

    expect(opened.dock(DockSide.Bottom).root).toEqual(group(3, terminal));
    expect(opened.dock(DockSide.Left).root).toEqual(new TabGroup(1, [files, search], search));
    expect(opened.openView(LayoutFixture.secondTerminal, registry).dock(DockSide.Bottom).root?.groups[0]?.tabs)
      .toEqual([terminal, LayoutFixture.secondTerminal]);
    expect(() => initial.openView(new ViewTab("gone.view"), registry)).toThrow(ArgumentException);
  });

  it("activates a view that is already open and shows its collapsed dock", () => {
    const opened = initial.openView(search, registry).toggleDock(DockSide.Left);
    const shown = opened.openView(files, registry);

    expect(opened.dock(DockSide.Left).isCollapsed).toBe(true);
    expect([shown.dock(DockSide.Left).isCollapsed, shown.groupOf(files)?.active]).toEqual([false, files]);
    expect(initial.toggleDock(DockSide.Bottom).openView(terminal, registry).dock(DockSide.Bottom).isCollapsed).toBe(false);
  });

  it("opens documents at the end of the documents group and activates them", () => {
    const opened = initial.openDocument(plan).openDocument(todo);

    expect(opened.documents).toEqual(new DocumentGroup([plan, todo], todo));
    expect(opened.openDocument(plan).documents).toEqual(new DocumentGroup([plan, todo], plan));
    expect(opened.middle).toBe(opened.documents);
  });

  it("opens document previews, each replacing the last, and keeps one opened again normally or asked to keep", () => {
    const first = initial.openDocument(plan).openDocument(todo, true);
    const second = first.openDocument(settings, true);

    expect(first.documents).toEqual(new DocumentGroup([plan, todo], todo, todo));
    expect(second.documents).toEqual(new DocumentGroup([plan, settings], settings, settings));
    expect(second.openDocument(settings).documents).toEqual(new DocumentGroup([plan, settings], settings));
    expect(second.openDocument(plan, true).documents).toEqual(new DocumentGroup([plan, settings], plan, settings));
    expect(second.keep(settings).documents.preview).toBeNull();
    expect(second.keep(new ViewTab("gone.view"))).toBe(second);
  });

  it("keeps the preview of every group as an ordinary tab, and changes nothing when no group has one", () => {
    const previews = LayoutReader.read({
      version: 1,
      docks: {
        Left: { root: { tabs: [{ view: "files.tree" }, { view: "files.search" }], active: 0, preview: 1 }, size: null, collapsed: false },
        Right: { root: null, size: null, collapsed: false },
        Bottom: { root: null, size: null, collapsed: false }
      },
      middle: { tabs: [{ document: "notes.note", instance: "plan" }, { document: "notes.note", instance: "todo" }], active: 0, preview: 1, documents: true }
    });
    const kept = previews.keepPreviews();

    expect(kept.groups.map(t => t.preview)).toEqual([null, null]);
    expect(kept.groups.flatMap(t => t.tabs)).toEqual(previews.groups.flatMap(t => t.tabs));
    expect(kept.keepPreviews()).toBe(kept);
  });

  it("keeps the preview of every document group when the middle holds two", () => {
    const readme = new DocumentTab("notes.note", "readme");
    const split = initial.openDocument(plan).openDocument(todo).splitGroup(todo, 0, PanelEdge.Right).openDocument(readme, true).focusDocuments(0).openDocument(settings, true);

    expect(split.documentGroups.map(t => t.preview)).toEqual([settings, readme]);
    expect(split.keepPreviews().documentGroups.map(t => t.preview)).toEqual([null, null]);
    expect(split.keepPreviews().documentGroups.flatMap(t => t.tabs)).toEqual(split.documentGroups.flatMap(t => t.tabs));
  });

  it("makes a moved, reordered, split or docked preview a normal tab, so a strip never holds two previews", () => {
    const previews = LayoutReader.read({
      version: 1,
      docks: {
        Left: { root: { tabs: [{ view: "files.tree" }, { view: "files.search" }], active: 0, preview: 1 }, size: null, collapsed: false },
        Right: { root: { tabs: [{ view: "git.changes" }, { view: "terminal.shell", instance: "1" }], active: 0, preview: 1 }, size: null, collapsed: false },
        Bottom: { root: null, size: null, collapsed: false }
      },
      middle: { tabs: [{ document: "notes.note", instance: "plan" }, { document: "notes.note", instance: "todo" }], active: 0, preview: 1, documents: true }
    });
    const right = previews.groupOf(changes)?.id ?? -1;

    const moved = previews.moveTab(search, right, 0);

    expect([moved.groupOf(search)?.tabs, moved.groupOf(search)?.preview]).toEqual([[search, changes, terminal], terminal]);
    expect(moved.groupOf(files)?.preview).toBeNull();
    expect(previews.moveTab(todo, 0, 0).documents.preview).toBeNull();
    expect(previews.splitGroup(search, right, PanelEdge.Bottom).groupOf(search)?.preview).toBeNull();
    expect(previews.dockOnSide(search, DockSide.Bottom).groupOf(search)?.preview).toBeNull();
    expect(previews.reset(registry).documents.preview).toEqual(todo);
  });

  it("closes a tab, closing its group when it was the last and keeping the documents group", () => {
    const opened = initial.openView(search, registry).openDocument(plan);

    expect(opened.close(search).dock(DockSide.Left).root).toEqual(group(1, files));
    expect(opened.close(search).close(files).dock(DockSide.Left).root).toBeNull();
    expect(opened.close(plan).documents).toEqual(DocumentGroup.createEmpty());
    expect(opened.close(todo)).toBe(opened);
  });

  it("closes a group beside the documents and returns the middle to the documents group", () => {
    const split = initial.openDocument(plan).splitGroup(changes, 0, PanelEdge.Right);

    expect(split.middle.groups.map(t => t.id)).toEqual([0, 2]);
    expect(split.close(changes).middle).toEqual(new DocumentGroup([plan], plan));
  });

  it("activates an open tab and shows its collapsed dock", () => {
    const opened = initial.openView(search, registry).toggleDock(DockSide.Left);

    expect(opened.activate(files).groupOf(files)?.active).toEqual(files);
    expect(opened.activate(files).dock(DockSide.Left).isCollapsed).toBe(false);
    expect(opened.activate(plan)).toBe(opened);
    expect(initial.openDocument(plan).openDocument(todo).activate(plan).documents.active).toBe(plan);
  });

  it("moves a view to any group, including the documents group", () => {
    const opened = initial.openDocument(plan).openDocument(todo);

    expect(opened.moveTab(files, 2, 0).dock(DockSide.Right).root).toEqual(new TabGroup(2, [files, changes], files));
    expect(opened.moveTab(files, 2, 0).dock(DockSide.Left).root).toBeNull();
    expect(opened.moveTab(files, 0, 1).documents).toEqual(new DocumentGroup([plan, files, todo], files));
    expect(opened.moveTab(files, 0, 1).moveTab(files, 2, 1).dock(DockSide.Right).root).toEqual(new TabGroup(2, [changes, files], files));
    expect(opened.openView(search, registry).moveTab(search, 1, 0).dock(DockSide.Left).root).toEqual(new TabGroup(1, [search, files], search));
    expect(opened.moveTab(files, 9, 0)).toBe(opened);
  });

  it("only reorders documents within the documents group", () => {
    const opened = initial.openDocument(plan).openDocument(todo);

    expect(opened.moveTab(todo, 0, 0).documents).toEqual(new DocumentGroup([todo, plan], todo));
    expect(opened.moveTab(todo, 1, 0)).toBe(opened);
    expect(opened.moveTab(settings, 0, 1).documents).toEqual(new DocumentGroup([plan, settings, todo], settings));
  });

  it("shows the dock a moved view lands in", () => {
    const collapsed = initial.toggleDock(DockSide.Right);

    expect(collapsed.moveTab(files, 2, 1).dock(DockSide.Right).isCollapsed).toBe(false);
  });

  it("splits a group with a view on any edge, beside the documents too", () => {
    const opened = initial.openDocument(plan);
    const beside = opened.splitGroup(changes, 0, PanelEdge.Right);

    expect(beside.middle).toEqual(createSplit(3, SplitAxis.Horizontal, [new DocumentGroup([plan], plan), group(2, changes)], [1, 1]));
    expect(beside.dock(DockSide.Right).root).toBeNull();
    expect(opened.splitGroup(files, 2, PanelEdge.Top).dock(DockSide.Right).root)
      .toEqual(createSplit(4, SplitAxis.Vertical, [group(3, files), group(2, changes)], [1, 1]));
  });

  it("splits a group by one of its own views only when the group keeps a tab", () => {
    const opened = initial.openView(search, registry);
    const split = opened.splitGroup(search, 1, PanelEdge.Bottom);

    expect(split.dock(DockSide.Left).root).toEqual(createSplit(4, SplitAxis.Vertical, [group(1, files), group(3, search)], [1, 1]));
    expect(initial.splitGroup(files, 1, PanelEdge.Bottom)).toBe(initial);
    expect(initial.openDocument(plan).moveTab(files, 0, 1).splitGroup(files, 0, PanelEdge.Left).middle.groups.map(t => t.tabs))
      .toEqual([[files], [plan]]);
  });

  it("does not split with a document or into a missing group", () => {
    const opened = initial.openDocument(plan);

    expect(opened.splitGroup(plan, 0, PanelEdge.Right)).toBe(opened);
    expect(opened.splitGroup(plan, 1, PanelEdge.Right)).toBe(opened);
    expect(opened.splitGroup(files, 9, PanelEdge.Right)).toBe(opened);
  });

  it("docks a view along a whole side, outside what is there", () => {
    const bottom = initial.dockOnSide(files, DockSide.Bottom);
    const left = initial.dockOnSide(changes, DockSide.Left);

    expect(bottom.dock(DockSide.Bottom).root).toEqual(group(3, files));
    expect(bottom.dock(DockSide.Left).root).toBeNull();
    expect(left.dock(DockSide.Left).root).toEqual(createSplit(3, SplitAxis.Horizontal, [group(2, changes), group(1, files)], [1, 1]));
    expect(initial.toggleDock(DockSide.Left).dockOnSide(files, DockSide.Left).dock(DockSide.Left)).toEqual(initial.dock(DockSide.Left));
    expect(initial.openDocument(plan).dockOnSide(plan, DockSide.Left).documents.tabs).toEqual([plan]);
  });

  it("docks a view that is not open yet", () => {
    expect(initial.dockOnSide(terminal, DockSide.Right).dock(DockSide.Right).root?.groups.map(t => t.tabs)).toEqual([[changes], [terminal]]);
  });

  it("collapses, shows and resizes docks", () => {
    expect(initial.toggleDock(DockSide.Left).dock(DockSide.Left).isCollapsed).toBe(true);
    expect(initial.toggleDock(DockSide.Left).toggleDock(DockSide.Left).dock(DockSide.Left).isCollapsed).toBe(false);
    expect(initial.resizeDock(DockSide.Left, 30).dock(DockSide.Left).size).toBe(30);
    expect(initial.resizeDock(DockSide.Left, 2).dock(DockSide.Left).size).toBe(10);
    expect(initial.resizeDock(DockSide.Left, null)).toBe(initial);
  });

  it("spans the bottom dock across the window unless kept between the side docks, through every change until a reset", () => {
    const between = initial.withBottomSpan(BottomDockSpan.Between);

    expect(initial.bottomSpan).toBe(BottomDockSpan.Full);
    expect(initial.withBottomSpan(BottomDockSpan.Full)).toBe(initial);
    expect(between.openView(terminal, registry).toggleDock(DockSide.Bottom).openDocument(plan).bottomSpan).toBe(BottomDockSpan.Between);
    expect(between.reset(registry).bottomSpan).toBe(BottomDockSpan.Full);
    expect(between.withBottomSpan(BottomDockSpan.Full).bottomSpan).toBe(BottomDockSpan.Full);
  });

  it("keeps the toolbar arrangement through every change, writes it only once it holds a choice, and returns to the declared defaults on a reset", () => {
    const arranged = initial.withToolbars(new ToolbarLayout([["notes.main"]], ["notes.second"]));

    expect(initial.toolbars).toBe(ToolbarLayout.EMPTY);
    expect(initial.withToolbars(ToolbarLayout.EMPTY)).toBe(initial);
    expect(arranged.withBottomSpan(BottomDockSpan.Between).openView(terminal, registry).toggleDock(DockSide.Bottom).openDocument(plan).toolbars).toEqual(arranged.toolbars);
    expect(arranged.toJson()["toolbars"]).toEqual({ rows: [{ toolbars: ["notes.main"] }], hidden: ["notes.second"] });
    expect(initial.toJson()).not.toHaveProperty("toolbars");
    expect(arranged.reset(registry).toolbars).toBe(ToolbarLayout.EMPTY);
  });

  it("keeps the person's wanted middle through every change, writes it only once it is set, refuses one outside 0 to 30rem and drops it on a reset", () => {
    const narrowed = initial.withMiddleSize(20);

    expect([initial.middleSize, initial.withMiddleSize(null)]).toEqual([null, initial]);
    expect(narrowed.withMiddleSize(20)).toBe(narrowed);
    expect(narrowed.withBottomSpan(BottomDockSpan.Between).withToolbars(new ToolbarLayout([["notes.main"]], [])).openView(terminal, registry).openDocument(plan).focusDocuments(0).middleSize).toBe(20);
    expect(narrowed.toJson()["middleSize"]).toBe(20);
    expect(initial.toJson()).not.toHaveProperty("middleSize");
    expect(narrowed.reset(registry).middleSize).toBeNull();
    expect(initial.withMiddleSize(0).middleSize).toBe(0);
    expect(() => initial.withMiddleSize(-1)).toThrow(ArgumentException);
    expect(() => initial.withMiddleSize(Number.NaN)).toThrow(ArgumentException);
    expect(() => initial.withMiddleSize(40)).toThrow(ArgumentException);
    expect(initial.withMiddleSize(30).middleSize).toBe(30);
  });

  it("resizes a split through its handle", () => {
    const split = initial.splitGroup(changes, 1, PanelEdge.Right);
    const root = split.dock(DockSide.Left).root as SplitNode;
    const handle = new SplitHandle(root, 0, new Bounds(10, 0, 0.25, 10), 10, 10, 20);

    expect(LayoutFixture.weightsOf(split.resizeSplit(handle.resize(15)).dock(DockSide.Left).root ?? root)).toEqual([0.25, 0.75]);
    expect(split.resizeSplit(createSplit(9, SplitAxis.Horizontal, [group(7, search), group(8, terminal)], [1, 1]))).toBe(split);
  });

  it("resets to the default arrangement, keeping open views, documents and the active document", () => {
    const changed = initial.openDocument(plan).openDocument(todo).openDocument(settings).openView(terminal, registry).openView(search, registry)
      .dockOnSide(files, DockSide.Right).moveTab(search, 0, 1).moveTab(new ViewTab("gone.view"), 0, 0).activate(todo).toggleDock(DockSide.Left);
    const reset = changed.reset(registry);

    expect(reset.dock(DockSide.Left)).toEqual(new Dock(DockSide.Left, new TabGroup(1, [files, search], search), null, false));
    expect(reset.dock(DockSide.Right).root).toEqual(group(2, changes));
    expect(reset.dock(DockSide.Bottom).root).toEqual(group(3, terminal));
    expect(reset.middle).toEqual(new DocumentGroup([plan, todo, settings], todo));
  });

  it("activates the first document after a reset when a view was active among them", () => {
    expect(initial.openDocument(plan).moveTab(search, 0, 1).reset(registry).documents).toEqual(new DocumentGroup([plan], plan));
    expect(initial.moveTab(search, 0, 0).reset(registry).documents).toEqual(DocumentGroup.createEmpty());
  });

  it("hides the views and documents whose modules are absent and keeps their places", () => {
    const partial = new ViewRegistry([new ViewType("files.tree", DockSide.Left, true)], ["shell.settings"]);
    const opened = initial.openDocument(plan).openDocument(settings).openView(terminal, registry);
    const visible = opened.withVisibleTabs(partial);

    expect(visible.dock(DockSide.Left).root).toEqual(group(1, files));
    expect([visible.dock(DockSide.Right).root, visible.dock(DockSide.Bottom).root]).toEqual([null, null]);
    expect(visible.documents).toEqual(new DocumentGroup([settings], settings));
    expect(opened.withVisibleTabs(registry)).toBe(opened);
    expect(opened.groups.flatMap(t => t.tabs)).toEqual([files, changes, terminal, plan, settings]);
  });

  it("writes its version, docks and middle", () => {
    expect(initial.openDocument(plan).toggleDock(DockSide.Right).resizeDock(DockSide.Left, 20).toJson()).toEqual({
      version: 1,
      docks: {
        Left: { root: { tabs: [{ view: "files.tree" }], active: 0 }, size: 20, collapsed: false },
        Right: { root: { tabs: [{ view: "git.changes" }], active: 0 }, size: null, collapsed: true },
        Bottom: { root: null, size: null, collapsed: false }
      },
      middle: { tabs: [{ document: "notes.note", instance: "plan" }], active: 0, documents: true },
      bottomSpan: "Full",
      activeDocuments: 0
    });
  });

  describe("document groups", () => {
    const readme = new DocumentTab("notes.note", "readme");
    const opened = initial.openDocument(plan).openDocument(todo).openDocument(settings);
    const split = opened.splitGroup(todo, 0, PanelEdge.Right);
    const contents = (layout: Layout): readonly (readonly [number, readonly Tab[]])[] => layout.documentGroups.map(t => [t.id, t.tabs] as const);

    it("holds several documents groups in the middle, the first the active one unless another is named", () => {
      const middle = createSplit(5, SplitAxis.Horizontal, [new DocumentGroup([plan], plan), new DocumentGroup([todo], todo, null, 6)], [1, 1]);

      expect(new Layout([], middle).documents.id).toBe(0);
      expect(new Layout([], middle, BottomDockSpan.Full, ToolbarLayout.EMPTY, 6).documents.id).toBe(6);
      expect(new Layout([], middle, BottomDockSpan.Full, ToolbarLayout.EMPTY, 9).documents.id).toBe(0);
      expect(new Layout([], middle).documentGroups.map(t => t.id)).toEqual([0, 6]);
    });

    it("splits a document into a new documents group on any edge, which becomes the active one", () => {
      const beside = split.middle as SplitNode;
      const above = opened.splitGroup(todo, 0, PanelEdge.Top);

      expect(contents(split)).toEqual([[0, [plan, settings]], [3, [todo]]]);
      expect([beside.axis, split.documents.id, split.documents.active]).toEqual([SplitAxis.Horizontal, 3, todo]);
      expect(contents(opened.splitGroup(todo, 0, PanelEdge.Left))).toEqual([[3, [todo]], [0, [plan, settings]]]);
      expect([(above.middle as SplitNode).axis, contents(above)]).toEqual([SplitAxis.Vertical, [[3, [todo]], [0, [plan, settings]]]]);
      expect(split.dock(DockSide.Left).root).toEqual(initial.dock(DockSide.Left).root);
    });

    it("does not split a document that is alone in its group, into a views group or into a missing group", () => {
      expect(split.splitGroup(todo, 3, PanelEdge.Right)).toBe(split);
      expect(split.splitGroup(plan, 1, PanelEdge.Right)).toBe(split);
      expect(split.splitGroup(plan, 9, PanelEdge.Right)).toBe(split);
      expect([split.canSplit(plan, 0), split.canSplit(todo, 3), split.canSplit(plan, 1), split.canSplit(plan, 9)]).toEqual([true, false, false, false]);
      expect([split.canSplit(files, 1), split.canSplit(files, 0), initial.canSplit(files, 1)]).toEqual([false, true, false]);
      expect(initial.moveTab(files, 0, 0).canSplit(files, 0)).toBe(true);
      expect(split.moveTab(files, 3, 1).moveTab(todo, 0, 0).canSplit(files, 3)).toBe(false);
    });

    it("moves a document to another documents group, which becomes the active one, and not to a views group", () => {
      const moved = split.moveTab(plan, 3, 1);

      expect(contents(moved)).toEqual([[0, [settings]], [3, [todo, plan]]]);
      expect([moved.documents.id, moved.documents.active]).toEqual([3, plan]);
      expect(split.moveTab(plan, 1, 0)).toBe(split);
    });

    it("closes a documents group when its last tab closes or leaves, the active one passing to its neighbor", () => {
      const closed = split.close(todo);
      const left = split.moveTab(todo, 0, 0);
      const first = split.focusDocuments(0).close(settings).close(plan);

      expect([closed.documentGroups.map(t => t.id), closed.documents.id, closed.middle]).toEqual([[0], 0, closed.documents]);
      expect([left.documentGroups.map(t => t.id), left.documents.id, left.documents.tabs]).toEqual([[0], 0, [todo, plan, settings]]);
      expect([contents(first), first.documents.id]).toEqual([[[3, [todo]]], 3]);
      expect(split.focusDocuments(0).close(plan).documents.id).toBe(0);
    });

    it("keeps the last documents group when its last tab closes", () => {
      const emptied = split.close(todo).close(plan).close(settings);

      expect([emptied.documentGroups.length, emptied.documents.tabs]).toEqual([1, []]);
    });

    it("opens a document in the active documents group, or activates it where it is open", () => {
      expect(contents(split.openDocument(readme))).toEqual([[0, [plan, settings]], [3, [todo, readme]]]);
      expect(contents(split.focusDocuments(0).openDocument(readme))).toEqual([[0, [plan, settings, readme]], [3, [todo]]]);
      expect(contents(split.openDocument(readme).openDocument(plan))).toEqual([[0, [plan, settings]], [3, [todo, readme]]]);
      expect([split.openDocument(plan).documents.id, split.openDocument(plan).documents.active]).toEqual([0, plan]);
      expect(split.focusDocuments(0).openDocument(readme, true).documents.preview).toEqual(readme);
    });

    it("makes a documents group active when one of its tabs is activated, and ignores a group that is not one", () => {
      expect(split.activate(plan).documents.id).toBe(0);
      expect(split.activate(plan).activate(settings).documents.active).toBe(settings);
      expect(split.focusDocuments(0).documents.id).toBe(0);
      expect(split.focusDocuments(3)).toBe(split);
      expect(split.focusDocuments(1)).toBe(split);
      expect(split.focusDocuments(9)).toBe(split);
    });

    it("keeps every documents tab in one group after a reset, with the active group's active tab and a preview that survives", () => {
      const previewed = split.focusDocuments(0).openDocument(readme, true);
      const reset = previewed.focusDocuments(3).reset(registry);

      expect(contents(reset)).toEqual([[0, [plan, settings, readme, todo]]]);
      expect([reset.documents.active, reset.documents.preview]).toEqual([todo, readme]);
      expect(previewed.reset(registry).documents.preview).toEqual(readme);
      expect(contents(split.reset(registry))).toEqual([[0, [plan, settings, todo]]]);
    });

    it("leaves out an empty documents group when its documents are absent, unless it is the last one", () => {
      const gone = new DocumentTab("gone.document");
      const another = new DocumentTab("gone.other");
      const some = new Layout([], createSplit(5, SplitAxis.Horizontal, [new DocumentGroup([plan], plan), new DocumentGroup([gone], gone, null, 6)], [1, 1]));
      const none = new Layout([], createSplit(5, SplitAxis.Horizontal, [new DocumentGroup([gone], gone), new DocumentGroup([another], another, null, 6)], [1, 1]));

      expect(contents(some.withVisibleTabs(registry))).toEqual([[0, [plan]]]);
      expect(contents(none.withVisibleTabs(registry))).toEqual([[0, []]]);
      expect(some.withVisibleTabs(registry).documents.id).toBe(0);
    });

    it("writes which documents group is active, and reads it back", () => {
      const written = split.toJson();
      const read = LayoutReader.read(written);

      expect(written["activeDocuments"]).toBe(1);
      expect([read.documentGroups.map(t => t.tabs), read.documents.tabs]).toEqual([[[plan, settings], [todo]], [todo]]);
    });
  });
});
