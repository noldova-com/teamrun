/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TreeDropPlace } from "../enums/tree-drop-place";
import type { TreeMove } from "./tree-move";
import type { TreeNode } from "./tree.node";

export class TreeDrop {
  public readonly target: TreeNode;
  public readonly row: HTMLElement;
  public readonly place: TreeDropPlace;
  public readonly move: TreeMove;

  public constructor(target: TreeNode, row: HTMLElement, place: TreeDropPlace, move: TreeMove) {
    this.target = target;
    this.row = row;
    this.place = place;
    this.move = move;
  }
}
