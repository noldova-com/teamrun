/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ProjectsGroup } from "../../../src/app/enums/projects-group";
import { ProjectsLayout } from "../../../src/app/models/projects-layout";

describe("ProjectsLayout", () => {
  it("starts with nothing collapsed, pinned or ordered", () => {
    const layout = new ProjectsLayout();

    expect(layout.collapsedProjects).toEqual([]);
    expect(layout.pinnedConversations).toEqual([]);
    expect(layout.projectOrder).toEqual([]);
    expect(layout.conversationOrderOf("p1")).toEqual([]);
  });

  it("keeps each id once and drops blank ids and blank projects", () => {
    const layout = new ProjectsLayout(["p1", "p1", " "], ["c1", "", "c1"], ["p2", "p2"], new Map([["p1", ["c2", "c2", ""]], [" ", ["c3"]]]));

    expect(layout.collapsedProjects).toEqual(["p1"]);
    expect(layout.pinnedConversations).toEqual(["c1"]);
    expect(layout.projectOrder).toEqual(["p2"]);
    expect([...layout.conversationOrder]).toEqual([["p1", ["c2"]]]);
  });

  it("round-trips through JSON", () => {
    const layout = new ProjectsLayout(["p1"], ["c1", "c2"], ["p2", "p1"], new Map([["p1", ["c3", "c1"]]]));

    const read = ProjectsLayout.fromJson(JSON.parse(JSON.stringify(layout.toJson())));

    expect(read.toJson()).toEqual(layout.toJson());
    expect(layout.toJson()).toEqual({ collapsedProjects: ["p1"], pinnedChats: ["c1", "c2"], projectOrder: ["p2", "p1"], chatOrder: { p1: ["c3", "c1"] }, collapsedGroups: [] });
  });

  it("reads anything but an object as an empty layout, and skips fields of the wrong shape", () => {
    for (const value of [null, 1, "text", [], undefined])
      expect(ProjectsLayout.fromJson(value).toJson()).toEqual(new ProjectsLayout().toJson());

    const read = ProjectsLayout.fromJson({ collapsedProjects: "p1", pinnedChats: ["c1", 2], projectOrder: null, chatOrder: ["p1"] });

    expect(read.collapsedProjects).toEqual([]);
    expect(read.pinnedConversations).toEqual(["c1"]);
    expect(read.projectOrder).toEqual([]);
    expect([...read.conversationOrder]).toEqual([]);
    expect([...ProjectsLayout.fromJson({ chatOrder: { p1: "c1", p2: ["c2"] } }).conversationOrder]).toEqual([["p1", []], ["p2", ["c2"]]]);
  });

  it("reads a layout an earlier version left in local storage under its earlier names, and the new names over them", () => {
    const earlier = { collapsedProjects: ["p1"], pinnedConversations: ["c1"], conversationOrder: { p1: ["c2", "c1"] } };
    const both = { ...earlier, pinnedChats: ["c3"], chatOrder: { p1: ["c4"] } };

    expect(ProjectsLayout.fromJson(earlier).toJson()).toEqual({ collapsedProjects: ["p1"], pinnedChats: ["c1"], projectOrder: [], chatOrder: { p1: ["c2", "c1"] }, collapsedGroups: [] });
    expect(ProjectsLayout.fromJson(both).toJson()).toEqual({ collapsedProjects: ["p1"], pinnedChats: ["c3"], projectOrder: [], chatOrder: { p1: ["c4"] }, collapsedGroups: [] });
  });

  it("pins a conversation at the end and unpins it, leaving the other fields", () => {
    const layout = new ProjectsLayout(["p1"], ["c1"], ["p2"], new Map([["p1", ["c1"]]]));

    const pinned = layout.togglePin("c2");
    const unpinned = pinned.togglePin("c1");

    expect(pinned.pinnedConversations).toEqual(["c1", "c2"]);
    expect(pinned.isPinned("c2")).toBe(true);
    expect(unpinned.pinnedConversations).toEqual(["c2"]);
    expect(unpinned.isPinned("c1")).toBe(false);
    expect(unpinned.collapsedProjects).toEqual(["p1"]);
    expect(unpinned.projectOrder).toEqual(["p2"]);
    expect(unpinned.conversationOrderOf("p1")).toEqual(["c1"]);
    expect(layout.pinnedConversations).toEqual(["c1"]);
  });

  it("orders the pins it has, keeping the unnamed ones after them and ignoring ids it does not pin", () => {
    const layout = new ProjectsLayout([], ["c1", "c2", "c3"]);

    expect(layout.orderPins(["c3", "c9", "c1"]).pinnedConversations).toEqual(["c3", "c1", "c2"]);
  });

  it("orders projects and a project's conversations", () => {
    const layout = new ProjectsLayout(["p1"], ["c1"]).orderProjects(["p2", "p1"]).orderConversations("p1", ["c3", "c2"]);

    expect(layout.projectOrder).toEqual(["p2", "p1"]);
    expect(layout.conversationOrderOf("p1")).toEqual(["c3", "c2"]);
    expect(layout.conversationOrderOf("p2")).toEqual([]);
    expect(layout.collapsedProjects).toEqual(["p1"]);
    expect(layout.pinnedConversations).toEqual(["c1"]);
  });

  it("collapses a project and opens it again, leaving the other fields", () => {
    const layout = new ProjectsLayout([], ["c1"], ["p2"], new Map([["p1", ["c1"]]]));

    const collapsed = layout.toggleProject("p1");

    expect(collapsed.isProjectCollapsed("p1")).toBe(true);
    expect(collapsed.toggleProject("p1").isProjectCollapsed("p1")).toBe(false);
    expect(collapsed.pinnedConversations).toEqual(["c1"]);
    expect(collapsed.projectOrder).toEqual(["p2"]);
    expect(collapsed.conversationOrderOf("p1")).toEqual(["c1"]);
  });

  it("collapses a group and opens it again, keeping it through JSON and through the other changes", () => {
    const layout = new ProjectsLayout(["p1"], ["c1"], ["p2"], new Map([["p1", ["c1"]]]), [ProjectsGroup.Chats, ProjectsGroup.Chats]);

    const collapsed = layout.withGroupCollapsed(ProjectsGroup.Pinned, true);
    const changed = collapsed.toggleProject("p2").togglePin("c2").orderPins(["c2", "c1"]).orderProjects(["p1"]).orderConversations("p1", ["c3"]);

    expect(layout.collapsedGroups).toEqual([ProjectsGroup.Chats]);
    expect([collapsed.isGroupCollapsed(ProjectsGroup.Pinned), collapsed.isGroupCollapsed(ProjectsGroup.Projects)]).toEqual([true, false]);
    expect(collapsed.withGroupCollapsed(ProjectsGroup.Pinned, true).collapsedGroups).toEqual([ProjectsGroup.Chats, ProjectsGroup.Pinned]);
    expect(collapsed.withGroupCollapsed(ProjectsGroup.Chats, false).collapsedGroups).toEqual([ProjectsGroup.Pinned]);
    expect(changed.collapsedGroups).toEqual([ProjectsGroup.Chats, ProjectsGroup.Pinned]);
    expect(ProjectsLayout.fromJson(JSON.parse(JSON.stringify(collapsed.toJson()))).collapsedGroups).toEqual([ProjectsGroup.Chats, ProjectsGroup.Pinned]);
    expect([collapsed.collapsedProjects, collapsed.pinnedConversations, collapsed.projectOrder, collapsed.conversationOrderOf("p1")]).toEqual([["p1"], ["c1"], ["p2"], ["c1"]]);
  });

  it("reads only the group names it knows, and no groups from a field of the wrong shape", () => {
    expect(ProjectsLayout.fromJson({ collapsedGroups: ["Projects", "Later", 1, "chats", "Pinned"] }).collapsedGroups).toEqual([ProjectsGroup.Projects, ProjectsGroup.Pinned]);
    expect(ProjectsLayout.fromJson({ collapsedGroups: "Projects" }).collapsedGroups).toEqual([]);
    expect(ProjectsLayout.fromJson({ collapsedProjects: ["p1"] }).collapsedGroups).toEqual([]);
  });
});
