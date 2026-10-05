/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TreeMoveException } from "../../../src/app/exceptions/tree-move.exception";
import { TreeNode } from "../../../src/app/models/tree-node";
import { TreePlace } from "../../../src/app/models/tree-place";

describe("TreePlace", () => {
  const nodes: readonly TreeNode[] = [
    TreeNode.open("project", "Project", "folder", [new TreeNode("source", "Source"), new TreeNode("readme", "Readme")]),
    new TreeNode("notes", "Notes")
  ];

  it("finds a row at any depth with its parent, its siblings and its index, and finds none for a row that is not there", () => {
    const inner = TreePlace.find(nodes, "readme");
    const top = TreePlace.find(nodes, "notes");

    expect([inner?.parent?.id, inner?.siblings.map(t => t.id), inner?.index, inner?.node.id]).toEqual(["project", ["source", "readme"], 1, "readme"]);
    expect([top?.parent, top?.index, TreePlace.find(nodes, "missing")]).toEqual([null, 1, null]);
  });

  it("names the row it cannot find", () => {
    expect(TreePlace.of(nodes, "source").node.id).toBe("source");
    expect(() => TreePlace.of(nodes, "missing")).toThrow(TreeMoveException);
    expect(() => TreePlace.of(nodes, "missing")).toThrow("missing");
  });
});
