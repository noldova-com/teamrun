/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { TreeDropPlace } from "../enums/tree-drop-place";
import { TreeStep } from "../enums/tree-step";
import { TreeMove } from "./tree-move";
import type { TreeNode } from "./tree-node";
import { TreePlace } from "./tree-place";
import { TreeSpot } from "./tree-spot";

export class TreePlan {
  public static step(nodes: readonly TreeNode[], id: string, step: TreeStep): TreeMove | null {
    const place = TreePlace.of(nodes, id);
    const parentId = place.parent?.id ?? null;
    switch (step) {
      case TreeStep.Up:
        return place.index > 0 ? new TreeMove(id, parentId, place.index - 1) : null;
      case TreeStep.Down:
        return place.index < place.siblings.length - 1 ? new TreeMove(id, parentId, place.index + 1) : null;
      case TreeStep.In: {
        const previous = place.siblings[place.index - 1];
        return previous?.isBranch ? new TreeMove(id, previous.id, previous.children.length) : null;
      }
      case TreeStep.Out: {
        const outer = Object.isNull(place.parent) ? null : TreePlace.find(nodes, place.parent.id);
        return Object.isNull(outer) ? null : new TreeMove(id, outer.parent?.id ?? null, outer.index + 1);
      }
    }
  }

  public static drop(nodes: readonly TreeNode[], id: string, targetId: string, dropPlace: TreeDropPlace): TreeMove | null {
    const source = TreePlace.find(nodes, id);
    const target = TreePlace.find(nodes, targetId);
    if (Object.isNull(source) || Object.isNull(target) || source.node.contains(targetId))
      return null;
    const isInside = dropPlace === TreeDropPlace.Into || dropPlace === TreeDropPlace.Start;
    const parent = isInside ? target.node : target.parent;
    const raw = dropPlace === TreeDropPlace.Into ? target.node.children.length : dropPlace === TreeDropPlace.Start ? 0 : target.index + (dropPlace === TreeDropPlace.After ? 1 : 0);
    const sameParent = (parent?.id ?? null) === (source.parent?.id ?? null);
    const index = raw - (sameParent && source.index < raw ? 1 : 0);
    return sameParent && index === source.index ? null : new TreeMove(id, parent?.id ?? null, index);
  }

  public static spot(move: TreeMove, nodes: readonly TreeNode[]): TreeSpot {
    const place = TreePlace.of(move.apply(nodes), move.id);
    return new TreeSpot(place.node.label, place.parent?.label ?? null, place.index + 1, place.siblings.length);
  }
}
