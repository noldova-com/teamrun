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
import type { TreeNode } from "./tree.node";

export class TreePlace {
  public readonly parent: TreeNode | null;
  public readonly siblings: readonly TreeNode[];
  public readonly index: number;
  public readonly node: TreeNode;

  public constructor(parent: TreeNode | null, siblings: readonly TreeNode[], index: number, node: TreeNode) {
    this.parent = parent;
    this.siblings = siblings;
    this.index = index;
    this.node = node;
  }

  public static of(nodes: readonly TreeNode[], id: string): TreePlace {
    const place = TreePlace.find(nodes, id);
    if (Object.isNull(place))
      throw new TreeMoveException(Resources.formatTreeRowMissing(id));
    return place;
  }

  public static find(nodes: readonly TreeNode[], id: string, parent: TreeNode | null = null): TreePlace | null {
    for (const [index, node] of nodes.entries()) {
      if (node.id === id)
        return new TreePlace(parent, nodes, index, node);
      const inner = TreePlace.find(node.children, id, node);
      if (!Object.isNull(inner))
        return inner;
    }
    return null;
  }
}
