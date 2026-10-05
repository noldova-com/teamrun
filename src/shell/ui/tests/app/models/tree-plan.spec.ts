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
import { TreePlan } from "../../../src/app/models/tree-plan";
import { TreeNode } from "../../../src/app/models/tree-node";

describe("TreePlan", () => {
  const nodes: readonly TreeNode[] = [
    TreeNode.open("project", "Project", "folder", [
      new TreeNode("source", "Source", "folder", [new TreeNode("app", "App"), new TreeNode("styles", "Styles")]),
      new TreeNode("readme", "Readme")
    ]),
    new TreeNode("notes", "Notes"),
    new TreeNode("trash", "Trash")
  ];

  const plain = (move: TreeMove | null): (string | number | null)[] | null => move === null ? null : [move.id, move.parentId, move.index];

  it("steps a row up and down among its siblings, and stops at the first and last", () => {
    expect([TreeStep.Up, TreeStep.Down].map(t => plain(TreePlan.step(nodes, "notes", t)))).toEqual([["notes", null, 0], ["notes", null, 2]]);
    expect([plain(TreePlan.step(nodes, "project", TreeStep.Up)), plain(TreePlan.step(nodes, "trash", TreeStep.Down))]).toEqual([null, null]);
    expect([plain(TreePlan.step(nodes, "styles", TreeStep.Up)), plain(TreePlan.step(nodes, "app", TreeStep.Down))]).toEqual([["styles", "source", 0], ["app", "source", 1]]);
  });

  it("steps a row into the branch before it, as its last child, and out after its parent, and does neither where that cannot be", () => {
    expect([plain(TreePlan.step(nodes, "notes", TreeStep.In)), plain(TreePlan.step(nodes, "app", TreeStep.Out)), plain(TreePlan.step(nodes, "source", TreeStep.Out))])
      .toEqual([["notes", "project", 2], ["app", "project", 1], ["source", null, 1]]);
    expect([TreeStep.In, TreeStep.Out].map(t => plain(TreePlan.step(nodes, "trash", t)))).toEqual([null, null]);
    expect([plain(TreePlan.step(nodes, "source", TreeStep.In)), plain(TreePlan.step(nodes, "missing", TreeStep.Up))]).toEqual([null, null]);
  });

  it("drops a row before or after another, or into a branch, counting the place once the row has left its own", () => {
    const drop = (id: string, target: string, place: TreeDropPlace): (string | number | null)[] | null => plain(TreePlan.drop(nodes, id, target, place));

    expect([drop("notes", "source", TreeDropPlace.Before), drop("notes", "readme", TreeDropPlace.After), drop("notes", "project", TreeDropPlace.Into)])
      .toEqual([["notes", "project", 0], ["notes", "project", 2], ["notes", "project", 2]]);
    expect([drop("trash", "project", TreeDropPlace.Before), drop("project", "trash", TreeDropPlace.After), drop("app", "styles", TreeDropPlace.After)])
      .toEqual([["trash", null, 0], ["project", null, 2], ["app", "source", 1]]);
  });

  it("refuses a drop that changes nothing, into a row without children, onto the row itself or its own descendants, or with a row that is not there", () => {
    const drop = (id: string, target: string, place: TreeDropPlace): TreeMove | null => TreePlan.drop(nodes, id, target, place);

    expect([drop("notes", "trash", TreeDropPlace.Before), drop("notes", "project", TreeDropPlace.After), drop("readme", "project", TreeDropPlace.Into)]).toEqual([null, null, null]);
    expect([drop("notes", "trash", TreeDropPlace.Into), drop("project", "project", TreeDropPlace.Before), drop("project", "app", TreeDropPlace.Into)]).toEqual([null, null, null]);
    expect([drop("missing", "notes", TreeDropPlace.Before), drop("notes", "missing", TreeDropPlace.Before)]).toEqual([null, null]);
  });

  it("drops a row into the start of an open branch, counting from the first child", () => {
    expect([plain(TreePlan.drop(nodes, "notes", "project", TreeDropPlace.Start)), plain(TreePlan.drop(nodes, "styles", "source", TreeDropPlace.Start)), plain(TreePlan.drop(nodes, "app", "source", TreeDropPlace.Start))])
      .toEqual([["notes", "project", 0], ["styles", "source", 0], null]);
    expect(plain(TreePlan.drop(nodes, "notes", "trash", TreeDropPlace.Start))).toBeNull();
  });

  it("describes where a row lands: its place, the count beside it and the branch it went into, which is none at the top", () => {
    expect([TreePlan.spot(new TreeMove("notes", null, 0), nodes), TreePlan.spot(new TreeMove("notes", "project", 2), nodes)])
      .toEqual([{ label: "Notes", parentLabel: null, position: 1, count: 3 }, { label: "Notes", parentLabel: "Project", position: 3, count: 3 }]);
  });
});
