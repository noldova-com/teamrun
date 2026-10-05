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

describe("TreePlace", () => {
  const nodes: readonly TreeNode[] = [
    TreeNode.open("project", "Project", "folder", [new TreeNode("source", "Source"), new TreeNode("readme", "Readme")]),
    new TreeNode("notes", "Notes")
  ];

  it("finds a row at any depth for a move, with its siblings and its index, and names the row it cannot find", () => {
    const moved = new TreeMove("readme", null, 0).apply(nodes);
    const back = new TreeMove("notes", "project", 1).apply(nodes);

    expect(moved.map(t => t.id)).toEqual(["readme", "project", "notes"]);
    expect(back[0]?.children.map(t => t.id)).toEqual(["source", "notes", "readme"]);
    expect(() => new TreeMove("missing", null, 0).apply(nodes)).toThrow("missing");
    expect(() => new TreeMove("missing", null, 0).apply(nodes)).toThrow(TreeMoveException);
  });
});
