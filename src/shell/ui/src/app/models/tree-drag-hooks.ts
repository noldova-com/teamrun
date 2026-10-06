/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TreeMove } from "./tree-move";
import type { TreeNode } from "./tree.node";

export class TreeDragHooks {
  public readonly nodeAt: (row: Element) => TreeNode | undefined;
  public readonly rowOf: (node: TreeNode) => HTMLElement | undefined;
  public readonly gap: () => number;
  public readonly isOpen: (node: TreeNode) => boolean;
  public readonly open: (node: TreeNode) => void;
  public readonly commit: (move: TreeMove) => void;

  public constructor(nodeAt: (row: Element) => TreeNode | undefined, rowOf: (node: TreeNode) => HTMLElement | undefined, gap: () => number,
    isOpen: (node: TreeNode) => boolean, open: (node: TreeNode) => void, commit: (move: TreeMove) => void) {
    this.nodeAt = nodeAt;
    this.rowOf = rowOf;
    this.gap = gap;
    this.isOpen = isOpen;
    this.open = open;
    this.commit = commit;
  }
}
