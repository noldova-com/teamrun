/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TreeNode } from "../../../src/app/models/tree-node";

describe("TreeNode", () => {
  it("holds its id, label and icon, which is none by default, and is a branch only when it has children", () => {
    const leaf = new TreeNode("notes", "Notes");

    expect([leaf.id, leaf.label, leaf.icon, leaf.children, leaf.isBranch, leaf.startsOpen]).toEqual(["notes", "Notes", null, [], false, false]);
    expect(new TreeNode("project", "Project", "folder", [leaf]).isBranch).toBe(true);
  });

  it("lists the branches that start open at any depth, and never a leaf", () => {
    const leaf = new TreeNode("app", "App");
    const inner = TreeNode.open("source", "Source", null, [leaf]);
    const outer = new TreeNode("project", "Project", null, [inner, new TreeNode("docs", "Docs", null, [leaf])]);
    const opened = TreeNode.open("top", "Top", null, [outer]);

    expect([opened.startsOpen, outer.startsOpen, opened.startOpenBranches.map(t => t.id), outer.startOpenBranches.map(t => t.id), leaf.startOpenBranches])
      .toEqual([true, false, ["top", "source"], ["source"], []]);
    expect(new TreeNode("leaf", "Leaf", null, [], true).startOpenBranches).toEqual([]);
  });
});
