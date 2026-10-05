/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TreeDropPlace } from "../../../src/app/enums/tree-drop-place";
import { TreeStep } from "../../../src/app/enums/tree-step";
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

  it("steps a row up and down among its siblings, and stops at the first and last", () => {
    expect([TreeStep.Up, TreeStep.Down].map(t => plain(TreeMove.step(nodes, "notes", t)))).toEqual([["notes", null, 0], ["notes", null, 2]]);
    expect([plain(TreeMove.step(nodes, "project", TreeStep.Up)), plain(TreeMove.step(nodes, "trash", TreeStep.Down))]).toEqual([null, null]);
    expect([plain(TreeMove.step(nodes, "styles", TreeStep.Up)), plain(TreeMove.step(nodes, "app", TreeStep.Down))]).toEqual([["styles", "source", 0], ["app", "source", 1]]);
  });

  it("steps a row into the branch before it, as its last child, and out after its parent, and does neither where that cannot be", () => {
    expect([plain(TreeMove.step(nodes, "notes", TreeStep.In)), plain(TreeMove.step(nodes, "app", TreeStep.Out)), plain(TreeMove.step(nodes, "source", TreeStep.Out))])
      .toEqual([["notes", "project", 2], ["app", "project", 1], ["source", null, 1]]);
    expect([TreeStep.In, TreeStep.Out].map(t => plain(TreeMove.step(nodes, "trash", t)))).toEqual([null, null]);
    expect([plain(TreeMove.step(nodes, "source", TreeStep.In)), plain(TreeMove.step(nodes, "missing", TreeStep.Up))]).toEqual([null, null]);
  });

  it("drops a row before or after another, or into a branch, counting the place once the row has left its own", () => {
    const drop = (id: string, target: string, place: TreeDropPlace): (string | number | null)[] | null => plain(TreeMove.drop(nodes, id, target, place));

    expect([drop("notes", "source", TreeDropPlace.Before), drop("notes", "readme", TreeDropPlace.After), drop("notes", "project", TreeDropPlace.Into)])
      .toEqual([["notes", "project", 0], ["notes", "project", 2], ["notes", "project", 2]]);
    expect([drop("trash", "project", TreeDropPlace.Before), drop("project", "trash", TreeDropPlace.After), drop("app", "styles", TreeDropPlace.After)])
      .toEqual([["trash", null, 0], ["project", null, 2], ["app", "source", 1]]);
  });

  it("refuses a drop that changes nothing, into a row without children, onto the row itself or its own descendants, or with a row that is not there", () => {
    const drop = (id: string, target: string, place: TreeDropPlace): TreeMove | null => TreeMove.drop(nodes, id, target, place);

    expect([drop("notes", "trash", TreeDropPlace.Before), drop("notes", "project", TreeDropPlace.After), drop("readme", "project", TreeDropPlace.Into)]).toEqual([null, null, null]);
    expect([drop("notes", "trash", TreeDropPlace.Into), drop("project", "project", TreeDropPlace.Before), drop("project", "app", TreeDropPlace.Into)]).toEqual([null, null, null]);
    expect([drop("missing", "notes", TreeDropPlace.Before), drop("notes", "missing", TreeDropPlace.Before)]).toEqual([null, null]);
  });

  it("applies a move to a copy of the tree, keeping every row's label, icon and open start, and leaves the rows it does not know alone", () => {
    const moved = new TreeMove("notes", "project", 1).apply(nodes);
    const out = new TreeMove("app", null, 0).apply(nodes);

    expect(shape(moved)).toEqual([["project", [["source", ["app", "styles"]], "notes", "readme"]], "trash"]);
    expect(shape(out)).toEqual(["app", ["project", [["source", ["styles"]], "readme"]], "notes", "trash"]);
    expect([moved[0]?.startsOpen, moved[0]?.icon, moved[0]?.label, shape(nodes)]).toEqual([true, "folder", "Project", [["project", [["source", ["app", "styles"]], "readme"]], "notes", "trash"]]);
    expect(new TreeMove("missing", null, 0).apply(nodes)).toBe(nodes);
  });

  it("describes where a row lands: its place, the count beside it and the branch it went into, which is none at the top", () => {
    expect([new TreeMove("notes", null, 0).spot(nodes), new TreeMove("notes", "project", 2).spot(nodes)])
      .toEqual([{ label: "Notes", parentLabel: null, position: 1, count: 3 }, { label: "Notes", parentLabel: "Project", position: 3, count: 3 }]);
  });
});
