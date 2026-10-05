/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { Resources } from "../../resources";
import { TreeMoveException } from "../exceptions/tree-move.exception";
import { TreeNode } from "./tree-node";
import { TreePlace } from "./tree-place";

export class TreeMove {
  public readonly id: string;
  public readonly parentId: string | null;
  public readonly index: number;

  public constructor(id: string, parentId: string | null, index: number) {
    this.id = id;
    this.parentId = parentId;
    this.index = index;
  }

  public apply(nodes: readonly TreeNode[]): readonly TreeNode[] {
    const moved = TreePlace.of(nodes, this.id);
    if (!Object.isNull(this.parentId) && (moved.node.contains(this.parentId) || Object.isNull(TreePlace.find(nodes, this.parentId))))
      throw new TreeMoveException(Resources.formatTreeMoveRefused(this.id, this.parentId));
    return TreeMove.insert(TreeMove.remove(nodes, this.id), this, moved.node);
  }

  private static remove(nodes: readonly TreeNode[], id: string): readonly TreeNode[] {
    return nodes.filter(t => t.id !== id).map(t => t.withChildren(TreeMove.remove(t.children, id)));
  }

  private static insert(nodes: readonly TreeNode[], move: TreeMove, node: TreeNode, parentId: string | null = null): readonly TreeNode[] {
    if (parentId === move.parentId)
      return [...nodes.slice(0, move.index), node, ...nodes.slice(move.index)];
    return nodes.map(t => t.withChildren(TreeMove.insert(t.children, move, node, t.id)));
  }
}
