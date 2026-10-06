/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import type { JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../../../resources";
import type { DockSide } from "../../enums/dock-side";
import type { PanelEdge } from "../../enums/panel-edge";
import { SplitAxis } from "../../enums/split-axis";
import type { Bounds } from "./bounds";
import type { GroupFrame } from "./group-frame";
import type { LayoutMetrics } from "./layout-metrics";
import { LayoutNode } from "./layout.node";
import { SplitHandle } from "./split-handle";
import { SplitPart } from "./split-part";
import type { TabGroup } from "./tab-group";
import type { ViewRegistry } from "./view-registry";

export class SplitNode extends LayoutNode {
  private readonly first: LayoutNode;
  private readonly last: LayoutNode;
  public readonly axis: SplitAxis;
  public readonly parts: readonly SplitPart[];

  public constructor(id: number, axis: SplitAxis, parts: readonly SplitPart[]) {
    super(id);
    const [first] = parts;
    const last = parts.at(-1);
    const total = parts.reduce((sum, t) => sum + t.weight, 0);
    if (Object.isUndefined(first) || Object.isUndefined(last) || parts.length < 2 || parts.some(t => !Number.isFinite(t.weight) || t.weight < 0) ||
      !(total > 0))
      throw new ArgumentException(Resources.invalidSplit, "parts");

    this.first = first.node;
    this.last = last.node;
    this.axis = axis;
    this.parts = parts.map(t => new SplitPart(t.node, t.weight / total));
  }

  public static beside(node: LayoutNode, added: LayoutNode, edge: PanelEdge, id: number): SplitNode {
    const nodes = Resources.leadingEdges.includes(edge) ? [added, node] : [node, added];
    return new SplitNode(id, Resources.edgeAxes[edge], nodes.map(t => new SplitPart(t, 1)));
  }

  public static join(id: number, axis: SplitAxis, parts: readonly SplitPart[]): LayoutNode | null {
    if (parts.length < 2)
      return parts[0]?.node ?? null;
    return new SplitNode(id, axis, parts.some(t => t.weight > 0) ? parts : parts.map(t => new SplitPart(t.node, 1)));
  }

  public override get groups(): readonly TabGroup[] {
    return this.parts.flatMap(t => t.node.groups);
  }

  public override get nodeIds(): readonly number[] {
    return [this.id, ...this.parts.flatMap(t => t.node.nodeIds)];
  }

  public override get cornerGroup(): TabGroup {
    return (this.axis === SplitAxis.Horizontal ? this.last : this.first).cornerGroup;
  }

  public override minimumLength(axis: SplitAxis, metrics: LayoutMetrics): number {
    const minimums = this.parts.map(t => t.node.minimumLength(axis, metrics));
    if (axis !== this.axis)
      return Math.max(...minimums);
    return minimums.reduce((sum, t) => sum + t, metrics.gap * (minimums.length - 1));
  }

  public override withGroup(group: TabGroup): LayoutNode {
    return this.withChildren(t => t.withGroup(group));
  }

  public override withoutGroup(id: number): LayoutNode | null {
    return this.withKept(t => t.withoutGroup(id));
  }

  public override splitGroup(id: number, added: TabGroup, edge: PanelEdge, splitId: number): LayoutNode {
    return this.withChildren(t => t.splitGroup(id, added, edge, splitId));
  }

  public override withSplit(split: SplitNode): LayoutNode {
    return split.id === this.id ? split : this.withChildren(t => t.withSplit(split));
  }

  public override withVisibleTabs(registry: ViewRegistry): LayoutNode | null {
    return this.withKept(t => t.withVisibleTabs(registry));
  }

  public override arrange(bounds: Bounds, side: DockSide | null, frames: GroupFrame[], handles: SplitHandle[], metrics: LayoutMetrics): void {
    const start = this.axis === SplitAxis.Horizontal ? bounds.x : bounds.y;
    const total = bounds.length(this.axis);
    const available = Math.max(0, total - metrics.gap * (this.parts.length - 1));
    const floor = this.parts.reduce((sum, t) => sum + t.node.minimumLength(this.axis, metrics), 0);
    const shared = available - floor;
    let position = start;
    this.parts.forEach((part, index) => {
      const minimum = part.node.minimumLength(this.axis, metrics);
      const isLast = index === this.parts.length - 1;
      const length = isLast ? Math.max(0, start + total - position) : shared >= 0 ? minimum + shared * part.weight : available * minimum / floor;
      part.node.arrange(bounds.slice(this.axis, position, length), side, frames, handles, metrics);
      if (isLast)
        return;
      handles.push(new SplitHandle(this, index, bounds.slice(this.axis, position + length, metrics.gap), length, minimum, shared));
      position += length + metrics.gap;
    });
  }

  public override toJson(): JsonObject {
    return {
      [Resources.axisField]: this.axis,
      [Resources.childrenField]: this.parts.map(t => ({ ...t.node.toJson(), [Resources.weightField]: t.weight }))
    };
  }

  private withChildren(change: (node: LayoutNode) => LayoutNode): LayoutNode {
    let isChanged = false;
    const parts = this.parts.map(t => {
      const node = change(t.node);
      if (node !== t.node)
        isChanged = true;
      return new SplitPart(node, t.weight);
    });
    return isChanged ? new SplitNode(this.id, this.axis, parts) : this;
  }

  private withKept(change: (node: LayoutNode) => LayoutNode | null): LayoutNode | null {
    const parts: SplitPart[] = [];
    let isChanged = false;
    for (const part of this.parts) {
      const node = change(part.node);
      if (node !== part.node)
        isChanged = true;
      if (!Object.isNull(node))
        parts.push(new SplitPart(node, part.weight));
    }
    return isChanged ? SplitNode.join(this.id, this.axis, parts) : this;
  }
}
