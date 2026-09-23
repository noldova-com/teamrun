/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DockSide } from "../../../src/app/enums/dock-side";
import { PanelId } from "../../../src/app/enums/panel-id";
import { Resources } from "../../../src/app/resources";
import { Dock } from "../../../src/app/models/dock";
import { DocumentTabs } from "../../../src/app/models/document-tabs";
import { Layout } from "../../../src/app/models/layout";

describe("Layout", () => {
  it("starts with every panel in its default dock and the bottom dock collapsed", () => {
    const layout = Layout.createDefault();

    expect(layout.dock(DockSide.Left).panels).toEqual([PanelId.Explorer]);
    expect(layout.dock(DockSide.Right).panels).toEqual([PanelId.Changes]);
    expect(layout.dock(DockSide.Bottom).panels).toEqual([PanelId.Activity]);
    expect(layout.dock(DockSide.Bottom).collapsed).toBe(true);
    expect(layout.dock(DockSide.Left).activePanel).toBe(PanelId.Explorer);
    expect(layout.dock(DockSide.Left).size).toBeNull();
    expect(layout.documents.open).toEqual([]);
    expect(layout.isOpen(PanelId.Changes)).toBe(true);
    expect(() => layout.dock("top" as DockSide)).toThrow(RangeError);
  });

  it("opens, closes, moves, activates panels, and toggles and resizes docks", () => {
    let layout = Layout.createDefault();

    layout = layout.closePanel(PanelId.Changes);
    expect(layout.isOpen(PanelId.Changes)).toBe(false);
    expect(layout.dockOf(PanelId.Changes)).toBeNull();
    expect(layout.closePanel(PanelId.Changes)).toBe(layout);

    layout = layout.openPanel(PanelId.Changes);
    expect(layout.dock(DockSide.Right).panels).toEqual([PanelId.Changes]);

    layout = layout.movePanel(PanelId.Changes, DockSide.Left, 0);
    expect(layout.dock(DockSide.Left).panels).toEqual([PanelId.Changes, PanelId.Explorer]);
    expect(layout.dock(DockSide.Left).activePanel).toBe(PanelId.Changes);
    expect(layout.dock(DockSide.Right).panels).toEqual([]);
    expect(layout.dock(DockSide.Right).activePanel).toBeNull();

    layout = layout.movePanel(PanelId.Activity, DockSide.Left);
    expect(layout.dock(DockSide.Left).panels).toEqual([PanelId.Changes, PanelId.Explorer, PanelId.Activity]);
    layout = layout.activatePanel(PanelId.Explorer);
    expect(layout.dock(DockSide.Left).activePanel).toBe(PanelId.Explorer);
    expect(layout.activatePanel(PanelId.Explorer)).toEqual(layout);

    layout = layout.toggleDock(DockSide.Left);
    expect(layout.dock(DockSide.Left).collapsed).toBe(true);
    layout = layout.openPanel(PanelId.Activity);
    expect(layout.dock(DockSide.Left).collapsed).toBe(false);
    expect(layout.dock(DockSide.Left).activePanel).toBe(PanelId.Activity);

    layout = layout.resizeDock(DockSide.Left, 5000.7);
    expect(layout.dock(DockSide.Left).size).toBe(Resources.dockMaximumSize);
    layout = layout.resizeDock(DockSide.Left, 1);
    expect(layout.dock(DockSide.Left).size).toBe(Resources.dockMinimumSize);
    layout = layout.resizeDock(DockSide.Left, null);
    expect(layout.dock(DockSide.Left).size).toBeNull();

    layout = layout.activatePanel(PanelId.Explorer).closePanel(PanelId.Explorer);
    expect(layout.dock(DockSide.Left).panels).toEqual([PanelId.Changes, PanelId.Activity]);
    expect(layout.dock(DockSide.Left).activePanel).toBe(PanelId.Activity);
    layout = layout.closePanel(PanelId.Activity);
    expect(layout.dock(DockSide.Left).activePanel).toBe(PanelId.Changes);
  });

  it("toggles a panel: shown when hidden in any way, closed when shown", () => {
    let layout = Layout.createDefault();

    layout = layout.togglePanel(PanelId.Activity);
    expect(layout.dock(DockSide.Bottom).collapsed).toBe(false);
    layout = layout.togglePanel(PanelId.Activity);
    expect(layout.isOpen(PanelId.Activity)).toBe(false);
    layout = layout.togglePanel(PanelId.Activity);
    expect(layout.dock(DockSide.Bottom).panels).toEqual([PanelId.Activity]);
    layout = layout.movePanel(PanelId.Changes, DockSide.Left).activatePanel(PanelId.Explorer).togglePanel(PanelId.Changes);
    expect(layout.dock(DockSide.Left).activePanel).toBe(PanelId.Changes);
    expect(layout.isOpen(PanelId.Changes)).toBe(true);
  });

  it("keeps the open conversations as tabs", () => {
    let layout = Layout.createDefault().showDocument("c1").showDocument("c2").showDocument("c1");

    expect(layout.documents.open).toEqual(["c1", "c2"]);
    expect(layout.documents.active).toBe("c1");
    layout = layout.showDocument("c3").closeDocument("c3");
    expect(layout.documents.active).toBe("c2");
    layout = layout.closeDocument("c2");
    expect(layout.documents.active).toBe("c1");
    expect(layout.closeDocument("nope")).toBe(layout);
    layout = layout.showDocument("c4").keepDocuments(["c4"]);
    expect(layout.documents.open).toEqual(["c4"]);
    expect(layout.keepDocuments(["c4"])).toBe(layout);
    expect(layout.closeDocument("c4").documents.active).toBeNull();

    let previewed = Layout.createDefault().showDocument("c1").showDocument("c2", true);
    expect(previewed.documents.open).toEqual(["c1", "c2"]);
    expect(previewed.documents.preview).toBe("c2");
    previewed = previewed.showDocument("c3", true);
    expect(previewed.documents.open).toEqual(["c1", "c3"]);
    expect(previewed.documents.preview).toBe("c3");
    expect(previewed.documents.active).toBe("c3");
    previewed = previewed.showDocument("c1", true);
    expect(previewed.documents.preview).toBe("c3");
    expect(previewed.documents.active).toBe("c1");
    previewed = previewed.showDocument("c4");
    expect(previewed.documents.open).toEqual(["c1", "c3", "c4"]);
    expect(previewed.documents.preview).toBe("c3");
    expect(previewed.keepDocumentOpen("c4")).toBe(previewed);
    previewed = previewed.keepDocumentOpen("c3");
    expect(previewed.documents.preview).toBeNull();
    previewed = previewed.showDocument("c5", true);
    expect(previewed.documents.open).toEqual(["c1", "c3", "c4", "c5"]);
    expect(previewed.closeDocument("c5").documents.preview).toBeNull();
    expect(previewed.keepDocuments(["c1", "c3", "c4"]).documents.preview).toBeNull();
    const readPreview = Layout.fromJson(JSON.parse(JSON.stringify(previewed.toJson())));
    expect(readPreview.documents.preview).toBe("c5");
    expect(Layout.fromJson({ documents: { open: ["c1"], active: "c1", preview: "zz" } }).documents.preview).toBeNull();
  });

  it("round-trips through JSON and reads leniently", () => {
    const layout = Layout.createDefault().movePanel(PanelId.Activity, DockSide.Right, 0).resizeDock(DockSide.Right, 300).showDocument("c1");

    const read = Layout.fromJson(JSON.parse(JSON.stringify(layout.toJson())));
    expect(read.toJson()).toEqual(layout.toJson());
    expect(read.dock(DockSide.Right).panels).toEqual([PanelId.Activity, PanelId.Changes]);
    expect(read.dock(DockSide.Right).size).toBe(300);
    expect(read.documents.active).toBe("c1");

    expect(Layout.fromJson("x").toJson()).toEqual(Layout.createDefault().toJson());
    expect(Layout.fromJson([]).toJson()).toEqual(Layout.createDefault().toJson());
    const partial = Layout.fromJson({ docks: { Left: { panels: ["Explorer", "bogus", "Explorer"], activePanel: "bogus", size: "wide", collapsed: "no" } }, documents: 5 });
    expect(partial.dock(DockSide.Left).panels).toEqual([PanelId.Explorer]);
    expect(partial.dock(DockSide.Left).activePanel).toBe(PanelId.Explorer);
    expect(partial.dock(DockSide.Left).size).toBeNull();
    expect(partial.dock(DockSide.Left).collapsed).toBe(false);
    expect(partial.dock(DockSide.Right).panels).toEqual([]);
    expect(partial.documents.open).toEqual([]);
    const twice = Layout.fromJson({ docks: { Left: { panels: ["Changes"] }, Right: { panels: ["Changes"], activePanel: "Changes" } }, documents: { open: ["c1", 2, " "], active: "zz" } });
    expect(twice.dock(DockSide.Left).panels).toEqual([PanelId.Changes]);
    expect(twice.dock(DockSide.Right).panels).toEqual([]);
    expect(twice.documents.open).toEqual(["c1"]);
    expect(twice.documents.active).toBe("c1");
    expect(Layout.fromJson({ docks: [] }).dock(DockSide.Left).panels).toEqual([]);

    const folded = layout.toggleProject("p1").toggleProject("p2");
    expect(folded.collapsedProjects).toEqual(["p1", "p2"]);
    expect(folded.isProjectCollapsed("p1")).toBe(true);
    expect(folded.toggleProject("p1").collapsedProjects).toEqual(["p2"]);
    expect(Layout.fromJson(JSON.parse(JSON.stringify(folded.toJson()))).collapsedProjects).toEqual(["p1", "p2"]);
    expect(folded.resetDocks().collapsedProjects).toEqual(["p1", "p2"]);
    expect(folded.showDocument("c2").collapsedProjects).toEqual(["p1", "p2"]);
    expect(Layout.fromJson({ collapsedProjects: ["p1", 3, " ", "p1"] }).collapsedProjects).toEqual(["p1"]);
    expect(Layout.fromJson({ collapsedProjects: "p1" }).collapsedProjects).toEqual([]);

    const pinned = layout.togglePin("c1").togglePin("c2").togglePin("c3");
    expect(pinned.pinnedConversations).toEqual(["c1", "c2", "c3"]);
    expect(pinned.isPinned("c2")).toBe(true);
    expect(pinned.togglePin("c2").pinnedConversations).toEqual(["c1", "c3"]);
    expect(pinned.orderPins(["c3", "c1", "zz"]).pinnedConversations).toEqual(["c3", "c1", "c2"]);
    expect(pinned.keepDocuments(["c1", "c3"]).pinnedConversations).toEqual(["c1", "c3"]);
    expect(pinned.keepDocuments(["c1", "c2", "c3"])).toBe(pinned);
    const ordered = pinned.orderProjects(["p2", "p1"]);
    expect(ordered.projectOrder).toEqual(["p2", "p1"]);
    expect(ordered.resetDocks().pinnedConversations).toEqual(["c1", "c2", "c3"]);
    expect(ordered.resetDocks().projectOrder).toEqual(["p2", "p1"]);
    const readBack = Layout.fromJson(JSON.parse(JSON.stringify(ordered.toJson())));
    expect(readBack.pinnedConversations).toEqual(["c1", "c2", "c3"]);
    expect(readBack.projectOrder).toEqual(["p2", "p1"]);
    expect(Layout.fromJson({ pinnedConversations: ["c1", 3, " ", "c1"], projectOrder: "p1" }).pinnedConversations).toEqual(["c1"]);
    expect(Layout.fromJson({ projectOrder: "p1" }).projectOrder).toEqual([]);

    const arranged = ordered.orderConversations("p1", ["c3", "c1", " ", "c3"]).orderConversations("p2", ["c9"]);
    expect(arranged.conversationOrderOf("p1")).toEqual(["c3", "c1"]);
    expect(arranged.conversationOrderOf("p2")).toEqual(["c9"]);
    expect(arranged.conversationOrderOf("p3")).toEqual([]);
    expect(arranged.resetDocks().conversationOrderOf("p1")).toEqual(["c3", "c1"]);
    expect(Layout.fromJson(JSON.parse(JSON.stringify(arranged.toJson()))).conversationOrderOf("p1")).toEqual(["c3", "c1"]);
    expect(Layout.fromJson({ conversationOrder: { p1: ["c2", 5], "": ["c1"], p2: "c1" } }).conversationOrderOf("p1")).toEqual(["c2"]);
    expect(Layout.fromJson({ conversationOrder: { p1: ["c2", 5], "": ["c1"], p2: "c1" } }).conversationOrderOf("p2")).toEqual([]);
    expect(Layout.fromJson({ conversationOrder: [] }).conversationOrder.size).toBe(0);
  });

  it("keeps the dock and tab models consistent on their own", () => {
    const dock = new Dock(DockSide.Left, [PanelId.Explorer, PanelId.Explorer], PanelId.Changes, 20, false);
    expect(dock.panels).toEqual([PanelId.Explorer]);
    expect(dock.activePanel).toBe(PanelId.Explorer);
    expect(dock.size).toBe(Resources.dockMinimumSize);
    expect(dock.remove(PanelId.Changes)).toBe(dock);
    expect(dock.activate(PanelId.Changes)).toBe(dock);
    expect(dock.add(PanelId.Changes, 99).panels).toEqual([PanelId.Explorer, PanelId.Changes]);
    expect(dock.add(PanelId.Explorer, 0).activePanel).toBe(PanelId.Explorer);
    expect(Dock.fromJson(DockSide.Left, null).panels).toEqual([]);

    const tabs = new DocumentTabs(["a", "b", "a", ""], "zz");
    expect(tabs.open).toEqual(["a", "b"]);
    expect(tabs.active).toBe("a");
    expect(DocumentTabs.fromJson([]).open).toEqual([]);
    expect(DocumentTabs.fromJson({ open: "a" }).open).toEqual([]);
  });
});
