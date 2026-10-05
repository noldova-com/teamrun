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
import { TreeNode } from "./tree-node";

export interface TreeSpot {
  readonly label: string;
  readonly parentLabel: string | null;
  readonly position: number;
  readonly count: number;
}

interface TreePlace {
  readonly parent: TreeNode | null;
  readonly siblings: readonly TreeNode[];
  readonly index: number;
}

export class TreeMove {
  public readonly id: string;
  public readonly parentId: string | null;
  public readonly index: number;

  public constructor(id: string, parentId: string | null, index: number) {
    this.id = id;
    this.parentId = parentId;
    this.index = index;
  }

  public static step(nodes: readonly TreeNode[], id: string, step: TreeStep): TreeMove | null {
    const place = TreeMove.locate(nodes, id);
    if (Object.isNull(place))
      return null;
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
        const outer = Object.isNull(place.parent) ? null : TreeMove.locate(nodes, place.parent.id);
        return Object.isNull(outer) ? null : new TreeMove(id, outer.parent?.id ?? null, outer.index + 1);
      }
    }
  }

  public static drop(nodes: readonly TreeNode[], id: string, targetId: string, dropPlace: TreeDropPlace): TreeMove | null {
    const source = TreeMove.locate(nodes, id);
    const target = TreeMove.locate(nodes, targetId);
    const moved = source?.siblings[source.index];
    if (Object.isNull(source) || Object.isNull(target) || Object.isUndefined(moved) || moved.contains(targetId))
      return null;
    const targetNode = target.siblings[target.index] as TreeNode;
    if (dropPlace === TreeDropPlace.Into && !targetNode.isBranch)
      return null;
    const parent = dropPlace === TreeDropPlace.Into ? targetNode : target.parent;
    const raw = dropPlace === TreeDropPlace.Into ? targetNode.children.length : target.index + (dropPlace === TreeDropPlace.After ? 1 : 0);
    const sameParent = (parent?.id ?? null) === (source.parent?.id ?? null);
    const index = raw - (sameParent && source.index < raw ? 1 : 0);
    return sameParent && index === source.index ? null : new TreeMove(id, parent?.id ?? null, index);
  }

  public apply(nodes: readonly TreeNode[]): readonly TreeNode[] {
    const moved = TreeMove.locate(nodes, this.id);
    const node = moved?.siblings[moved.index];
    return Object.isUndefined(node) ? nodes : TreeMove.insert(TreeMove.remove(nodes, this.id), this, node);
  }

  public spot(nodes: readonly TreeNode[]): TreeSpot {
    const place = TreeMove.locate(this.apply(nodes), this.id) as TreePlace;
    return { label: place.siblings[place.index]?.label as string, parentLabel: place.parent?.label ?? null, position: place.index + 1, count: place.siblings.length };
  }

  private static remove(nodes: readonly TreeNode[], id: string): readonly TreeNode[] {
    return nodes.filter(t => t.id !== id).map(t => t.withChildren(TreeMove.remove(t.children, id)));
  }

  private static insert(nodes: readonly TreeNode[], move: TreeMove, node: TreeNode, parentId: string | null = null): readonly TreeNode[] {
    if (parentId === move.parentId)
      return [...nodes.slice(0, move.index), node, ...nodes.slice(move.index)];
    return nodes.map(t => t.withChildren(TreeMove.insert(t.children, move, node, t.id)));
  }

  private static locate(nodes: readonly TreeNode[], id: string, parent: TreeNode | null = null): TreePlace | null {
    const index = nodes.findIndex(t => t.id === id);
    if (index >= 0)
      return { parent, siblings: nodes, index };
    return nodes.map(t => TreeMove.locate(t.children, id, t)).find(t => !Object.isNull(t)) ?? null;
  }
}
