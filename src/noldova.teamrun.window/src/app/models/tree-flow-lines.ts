/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../../resources";
import { FlowLineShape } from "../enums/flow-line-shape";
import { FlowBox } from "./flow-box";
import { FlowNode } from "./flow.node";
import { FlowPoint } from "./flow-point";

export class TreeFlowLines {
  private readonly origin: DOMRect;
  private readonly scale: number;

  private constructor(container: HTMLElement) {
    this.origin = container.getBoundingClientRect();
    this.scale = this.origin.width > 0 ? this.origin.width / TreeFlowLines.layoutWidthOf(container) : 1;
  }

  public static layoutWidthOf(element: HTMLElement): number {
    const style = getComputedStyle(element);
    const sides = style.boxSizing === Resources.borderBox ? [] : [style.paddingLeft, style.paddingRight, style.borderLeftWidth, style.borderRightWidth];
    return [style.width, ...sides].reduce((t, u) => t + Number.parseFloat(u), 0);
  }

  public static nodesIn(container: HTMLElement): ReadonlyMap<string, FlowNode> {
    const lines = new TreeFlowLines(container);
    const nodes = new Map<string, FlowNode>();
    for (const element of container.querySelectorAll<HTMLElement>(Resources.flowNodeSelector)) {
      const key = String(element.dataset[Resources.flowNodeData]);
      nodes.set(key, new FlowNode(key, element.dataset[Resources.flowParentData] ?? null, lines.boxOf(element), lines.uplinkOf(element)));
    }
    return nodes;
  }

  private uplinkOf(element: HTMLElement): readonly FlowPoint[] {
    const box = this.boxOf(element);
    const shape = element.dataset[Resources.flowShapeData];
    const above = element.previousElementSibling;
    const holder = element.closest(Resources.flowReportsSelector);
    const kid = element.closest(Resources.flowKidSelector);
    const kids = element.closest(Resources.flowKidsSelector);
    if (shape === FlowLineShape.Stem && !Object.isNull(above)) {
      const stem = this.boxOf(above);
      const line = stem.left + stem.width / 2;
      return [new FlowPoint(line, box.top), new FlowPoint(line, stem.top)];
    }
    const x = box.left + box.width / 2;
    if (shape === FlowLineShape.Grid && !Object.isNull(holder)) {
      if (box.top === Math.min(...this.cardsOf(holder).map(t => t.top)))
        return [new FlowPoint(x, box.top), ...this.overGrid(holder, x)];
      return this.pastGrid(holder, box, this.sideOf(holder, box.left));
    }
    if (shape === FlowLineShape.Bus && !Object.isNull(kid) && !Object.isNull(kids)) {
      const one = this.boxOf(kid);
      const all = this.boxOf(kids);
      const middle = all.left + all.width / 2;
      const grid = TreeFlowLines.previousOf(kids, Resources.flowReportsSelector);
      if (Object.isNull(grid))
        return [new FlowPoint(x, box.top), new FlowPoint(x, one.top), new FlowPoint(middle, one.top), new FlowPoint(middle, all.top)];
      const side = this.sideOf(grid, x);
      if (side >= box.left && side <= box.left + box.width)
        return this.pastGrid(grid, box, side);
      return [new FlowPoint(x, box.top), new FlowPoint(x, one.top), new FlowPoint(side, one.top), ...this.overGrid(grid, side)];
    }
    return [];
  }

  private pastGrid(grid: Element, box: FlowBox, side: number): readonly FlowPoint[] {
    const y = box.top + TreeFlowLines.gapOf(grid);
    return [new FlowPoint(box.left + box.width / 2, y), new FlowPoint(side, y), ...this.overGrid(grid, side)];
  }

  private sideOf(grid: Element, x: number): number {
    const gap = TreeFlowLines.gapOf(grid);
    const row = this.firstRowOf(grid);
    const sides = row.length > 1 ? row.slice(1).map(t => t.left - gap) : row.flatMap(t => [t.left - gap, t.left + t.width + gap]);
    return sides.reduce((t, u) => Math.abs(u - x) < Math.abs(t - x) ? u : t);
  }

  private overGrid(grid: Element, x: number): readonly FlowPoint[] {
    const reports = this.boxOf(grid);
    const row = this.firstRowOf(grid);
    const outside = x < Math.min(...row.map(t => t.left)) || x > Math.max(...row.map(t => t.left + t.width));
    const y = outside ? reports.top - TreeFlowLines.gapOf(grid) : reports.top + TreeFlowLines.pixels(getComputedStyle(grid, Resources.afterPseudo).top);
    const middle = reports.left + reports.width / 2;
    return [new FlowPoint(x, y), new FlowPoint(middle, y), new FlowPoint(middle, reports.top)];
  }

  private cardsOf(grid: Element): FlowBox[] {
    return [...grid.children].map(t => this.boxOf(t));
  }

  private firstRowOf(grid: Element): FlowBox[] {
    const cards = this.cardsOf(grid);
    const top = Math.min(...cards.map(t => t.top));
    return cards.filter(t => t.top === top).sort((t, u) => t.left - u.left);
  }

  private static gapOf(grid: Element): number {
    return TreeFlowLines.pixels(getComputedStyle(grid).columnGap) / 2;
  }

  private static previousOf(element: Element, selector: string): Element | null {
    let sibling = element.previousElementSibling;
    while (!Object.isNull(sibling) && !sibling.matches(selector))
      sibling = sibling.previousElementSibling;
    return sibling;
  }

  private static pixels(value: string): number {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  private boxOf(element: Element): FlowBox {
    const rect = element.getBoundingClientRect();
    return new FlowBox(this.toLocal(rect.left - this.origin.left), this.toLocal(rect.top - this.origin.top), this.toLocal(rect.width), this.toLocal(rect.height));
  }

  private toLocal(value: number): number {
    return value / this.scale;
  }
}
