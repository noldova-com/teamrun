/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TreeMoveException } from "../../../src/app/exceptions/tree-move.exception";
import { TreeMove } from "../../../src/app/models/tree-move";
import { TreeNode } from "../../../src/app/models/tree-node";

describe("TreeMove", () => {
  const nodes: readonly TreeNode[] = [
    TreeNode.open("project", "Project", "folder", [
      new TreeNode("source", "Source", "folder", [new TreeNode("app", "App"), new TreeNode("styles", "Styles")]),
      new TreeNode("readme", "Readme")
    ]),
    new TreeNode("notes", "Notes"),
    new TreeNode("trash", "Trash")
  ];

  const shape = (list: readonly TreeNode[]): unknown[] => list.map(t => t.isBranch ? [t.id, shape(t.children)] : t.id);
  const plain = (move: TreeMove | null): (string | number | null)[] | null => move === null ? null : [move.id, move.parentId, move.index];

  it("holds the row moved, its new parent, which is none at the top, and its place among the parent's children once the row has left its old place", () => {
    expect(plain(new TreeMove("notes", "project", 1))).toEqual(["notes", "project", 1]);
    expect(plain(new TreeMove("notes", null, 0))).toEqual(["notes", null, 0]);
  });

  it("applies a move to a copy of the tree, keeping every row's label, icon and open start", () => {
    const moved = new TreeMove("notes", "project", 1).apply(nodes);
    const out = new TreeMove("app", null, 0).apply(nodes);

    expect(shape(moved)).toEqual([["project", [["source", ["app", "styles"]], "notes", "readme"]], "trash"]);
    expect(shape(out)).toEqual(["app", ["project", [["source", ["styles"]], "readme"]], "notes", "trash"]);
    expect([moved[0]?.startsOpen, moved[0]?.icon, moved[0]?.label, shape(nodes)]).toEqual([true, "folder", "Project", [["project", [["source", ["app", "styles"]], "readme"]], "notes", "trash"]]);
  });

  it("refuses a move of a row that is not there, into a parent that is not there or into the row itself or its own descendants, and changes nothing", () => {
    expect(() => new TreeMove("missing", null, 0).apply(nodes)).toThrow(TreeMoveException);
    expect(() => new TreeMove("notes", "missing", 0).apply(nodes)).toThrow("into \"missing\"");
    expect(() => new TreeMove("project", "app", 0).apply(nodes)).toThrow(TreeMoveException);
    expect(() => new TreeMove("project", "project", 0).apply(nodes)).toThrow(TreeMoveException);
    expect(() => new TreeMove("app", null, 0).apply(nodes)).not.toThrow();
  });
});
