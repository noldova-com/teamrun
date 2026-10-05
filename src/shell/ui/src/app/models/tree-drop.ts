/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TreeDropPlace } from "../enums/tree-drop-place";
import { TreeMove } from "./tree-move";

export class TreeDrop {
  public readonly targetId: string;
  public readonly place: TreeDropPlace;
  public readonly move: TreeMove;

  public constructor(targetId: string, place: TreeDropPlace, move: TreeMove) {
    this.targetId = targetId;
    this.place = place;
    this.move = move;
  }
}
