/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { FlowBox } from "./flow-box";
import type { FlowNode } from "./flow.node";
import type { FlowPoint } from "./flow-point";

export class FlowRoute {
  public readonly points: readonly FlowPoint[];
  public readonly target: FlowBox | null;

  public constructor(points: readonly FlowPoint[], target: FlowBox | null) {
    this.points = points;
    this.target = target;
  }

  public get path(): string {
    return this.points.map((t, u) => `${u === 0 ? "M" : "L"} ${FlowRoute.round(t.x)} ${FlowRoute.round(t.y)}`).join(" ");
  }

  public static between(nodes: ReadonlyMap<string, FlowNode>, fromKey: string, toKey: string): FlowRoute | null {
    const source = nodes.get(fromKey);
    const target = nodes.get(toKey);
    if (Object.isUndefined(source) || Object.isUndefined(target))
      return null;
    const up = FlowRoute.chainOf(nodes, source);
    const down = FlowRoute.chainOf(nodes, target);
    if (Object.isNull(up) || Object.isNull(down))
      return null;
    const common = up.find(t => down.includes(t));
    if (Object.isUndefined(common))
      return null;
    const points = [...up.slice(0, up.indexOf(common)).flatMap(t => t.uplink),
      ...down.slice(0, down.indexOf(common)).reverse().flatMap(t => [...t.uplink].reverse())];
    return FlowRoute.along(points, target.box);
  }

  public static along(points: readonly FlowPoint[], target: FlowBox | null): FlowRoute | null {
    const joined = FlowRoute.withoutReturns(points);
    return joined.length < 2 ? null : new FlowRoute(joined, target);
  }

  private static withoutReturns(points: readonly FlowPoint[]): FlowPoint[] {
    const kept: FlowPoint[] = [];
    for (const point of points) {
      while (FlowRoute.turnsBack(kept.at(-2), kept.at(-1), point))
        kept.pop();
      if (!FlowRoute.isAt(kept.at(-1), point))
        kept.push(point);
    }
    return kept;
  }

  private static turnsBack(before: FlowPoint | undefined, at: FlowPoint | undefined, next: FlowPoint): boolean {
    if (Object.isUndefined(before) || Object.isUndefined(at))
      return false;
    const across = FlowRoute.round(before.y) === FlowRoute.round(at.y) && FlowRoute.round(at.y) === FlowRoute.round(next.y);
    const along = FlowRoute.round(before.x) === FlowRoute.round(at.x) && FlowRoute.round(at.x) === FlowRoute.round(next.x);
    return across && (at.x - before.x) * (next.x - at.x) < 0 || along && (at.y - before.y) * (next.y - at.y) < 0;
  }

  private static isAt(point: FlowPoint | undefined, other: FlowPoint): boolean {
    return !Object.isUndefined(point) && FlowRoute.round(point.x) === FlowRoute.round(other.x) && FlowRoute.round(point.y) === FlowRoute.round(other.y);
  }

  private static chainOf(nodes: ReadonlyMap<string, FlowNode>, start: FlowNode): FlowNode[] | null {
    const chain: FlowNode[] = [start];
    let next = start.parentKey;
    while (!Object.isNull(next)) {
      const node = nodes.get(next);
      if (Object.isUndefined(node) || chain.includes(node))
        return null;
      chain.push(node);
      next = node.parentKey;
    }
    return chain;
  }

  private static round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
