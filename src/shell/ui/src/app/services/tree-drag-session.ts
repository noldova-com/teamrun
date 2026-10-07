/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Signal, type WritableSignal, signal } from "@angular/core";

import "@noldova/teamrun-foundation-core";

import { Resources } from "../../resources";
import { TreeDropPlace } from "../enums/tree-drop-place";
import { DragGesture } from "../models/drag-gesture";
import type { TreeDragHooks } from "../models/tree-drag-hooks";
import { TreeDrop } from "../models/tree-drop";
import { TreeGhost } from "../models/tree-ghost";
import { TreeLine } from "../models/tree-line";
import type { TreeNode } from "../models/tree.node";
import { TreePlan } from "../models/tree-plan";
import { PointerDrag } from "./pointer-drag";

export class TreeDragSession {
  private readonly draggingState: WritableSignal<TreeNode | null> = signal(null);
  private readonly dropState: WritableSignal<TreeDrop | null> = signal(null);
  private readonly ghostState: WritableSignal<TreeGhost | null> = signal(null);
  private readonly lineState: WritableSignal<TreeLine | null> = signal(null);
  private readonly document: Document;
  private readonly host: HTMLElement;
  private readonly nodes: Signal<readonly TreeNode[]>;
  private readonly hooks: TreeDragHooks;
  private pointer: PointerDrag | null = null;
  private releaseClick: (() => void) | null = null;
  private hoverTimer: ReturnType<typeof setTimeout> | null = null;
  private hoverId: string | null = null;
  private scrollTimer: ReturnType<typeof setInterval> | null = null;
  private scrollDirection: number = 0;
  private scrollArea: HTMLElement;
  private rowGap: number = 0;
  private pointerX: number = 0;
  private pointerY: number = 0;
  private targetRow: HTMLElement | null = null;
  private targetPlace: TreeDropPlace | null = null;

  public readonly dragging: Signal<TreeNode | null> = this.draggingState.asReadonly();
  public readonly drop: Signal<TreeDrop | null> = this.dropState.asReadonly();
  public readonly ghost: Signal<TreeGhost | null> = this.ghostState.asReadonly();
  public readonly line: Signal<TreeLine | null> = this.lineState.asReadonly();

  public constructor(document: Document, host: HTMLElement, nodes: Signal<readonly TreeNode[]>, hooks: TreeDragHooks) {
    this.document = document;
    this.host = host;
    this.scrollArea = host;
    this.nodes = nodes;
    this.hooks = hooks;
  }

  public begin(event: PointerEvent, node: TreeNode, element: HTMLElement): void {
    if (event.button !== Resources.primaryButton)
      return;
    this.stop();
    const box = element.getBoundingClientRect();
    this.pointer = new PointerDrag(this.document.documentElement, event, moved => this.move(moved, node, event, box), () => this.end(), () => this.stop());
  }

  public reevaluate(): void {
    const dragged = this.draggingState();
    if (Object.isNull(dragged))
      return;
    this.targetRow = null;
    this.targetPlace = null;
    this.refresh(dragged);
  }

  public stop(): void {
    this.releaseClick?.();
    this.releaseClick = null;
    this.pointer?.stop();
    this.pointer = null;
    this.draggingState.set(null);
    this.setTarget(null, null, null);
    this.ghostState.set(null);
    this.setScroll(0, null);
  }

  private move(event: PointerEvent, node: TreeNode, start: PointerEvent, box: DOMRect): void {
    if (Object.isNull(this.draggingState())) {
      if (!DragGesture.hasStarted(start.clientX, start.clientY, event.clientX, event.clientY))
        return;
      this.draggingState.set(node);
      this.pointer?.start();
      this.scrollArea = this.scroller() ?? this.host;
      this.rowGap = this.hooks.gap();
    }
    const isRightToLeft = this.host.matches(Resources.rightToLeftSelector);
    const x = isRightToLeft ? this.document.documentElement.clientWidth - event.clientX : event.clientX;
    this.ghostState.set(new TreeGhost(x + Resources.treeGhostOffset, event.clientY - box.height / 2, box.width, isRightToLeft));
    this.pointerX = event.clientX;
    this.pointerY = event.clientY;
    this.refresh(node);
    this.setScroll(this.scrollAt(event.clientY, box.height), node);
  }

  private end(): void {
    const drop = this.dropState();
    const dragged = !Object.isNull(this.draggingState());
    this.stop();
    if (dragged)
      this.swallowClick();
    if (!Object.isNull(drop))
      this.hooks.commit(drop.move);
  }

  private swallowClick(): void {
    const swallow = (click: Event): void => click.stopPropagation();
    const release = (): void => this.document.removeEventListener(Resources.clickEvent, swallow, { capture: true });
    this.document.addEventListener(Resources.clickEvent, swallow, { capture: true, once: true });
    this.releaseClick = release;
    setTimeout(release);
  }

  private refresh(dragged: TreeNode): void {
    const row = this.rowAtPointer();
    const node = Object.isUndefined(row) ? undefined : this.hooks.nodeAt(row);
    if (Object.isUndefined(row) || Object.isUndefined(node))
      return this.setTarget(null, null, null);
    const box = row.getBoundingClientRect();
    const fraction = (this.pointerY - box.top) / box.height;
    const edge = Resources.treeDropEdge;
    const place = node.isBranch && fraction >= edge && fraction <= 1 - edge ? TreeDropPlace.Into
      : fraction < 0.5 ? TreeDropPlace.Before : node.isBranch && this.hooks.isOpen(node) ? TreeDropPlace.Start : TreeDropPlace.After;
    if (row === this.targetRow && place === this.targetPlace)
      return;
    const move = TreePlan.drop(this.nodes(), dragged.id, node.id, place);
    this.setTarget(Object.isNull(move) ? null : new TreeDrop(node, row, place, move), row, place);
  }

  private rowAtPointer(): HTMLElement | undefined {
    for (const offset of [0, -this.rowGap, this.rowGap]) {
      const row = this.document.elementFromPoint(this.pointerX, this.pointerY + offset)?.closest<HTMLElement>(Resources.treeItemSelector);
      if (!Object.isNullOrUndefined(row) && this.host.contains(row))
        return row;
    }
    return undefined;
  }

  private setTarget(drop: TreeDrop | null, row: HTMLElement | null, place: TreeDropPlace | null): void {
    this.targetRow = row;
    this.targetPlace = place;
    const current = this.dropState();
    if (current?.target.id === drop?.target.id && current?.place === drop?.place)
      return;
    this.dropState.set(drop);
    this.lineState.set(Object.isNull(drop) ? null : this.lineOf(drop));
    this.watchHover(drop?.target);
  }

  private lineOf(drop: TreeDrop): TreeLine | null {
    if (drop.place === TreeDropPlace.Into)
      return null;
    const box = drop.row.getBoundingClientRect();
    const frame = this.host.getBoundingClientRect();
    const [first] = (drop.place === TreeDropPlace.Start ? drop.target.children : []).slice(0, 1).map(t => this.hooks.rowOf(t));
    const style = getComputedStyle(first ?? drop.row);
    const inset = Number.parseFloat(style.paddingInlineStart);
    const isRightToLeft = this.host.matches(Resources.rightToLeftSelector);
    const top = drop.place === TreeDropPlace.Before ? box.top - this.rowGap / 2 : box.bottom + this.rowGap / 2;
    return new TreeLine(top - frame.top, (isRightToLeft ? frame.right - box.right : box.left - frame.left) + inset, box.width - inset - Number.parseFloat(style.paddingInlineEnd));
  }

  private watchHover(node: TreeNode | undefined): void {
    if ((node?.id ?? null) === this.hoverId)
      return;
    if (!Object.isNull(this.hoverTimer))
      clearTimeout(this.hoverTimer);
    this.hoverTimer = null;
    this.hoverId = node?.id ?? null;
    if (!Object.isUndefined(node) && node.isBranch && !this.hooks.isOpen(node))
      this.hoverTimer = setTimeout(() => this.hooks.open(node), Resources.treeHoverOpenDelay);
  }

  private scrollAt(y: number, edge: number): number {
    const area = this.scrollArea.getBoundingClientRect();
    return y < area.top + edge ? -1 : y > area.bottom - edge ? 1 : 0;
  }

  private setScroll(direction: number, dragged: TreeNode | null): void {
    if (direction === this.scrollDirection)
      return;
    this.scrollDirection = direction;
    if (!Object.isNull(this.scrollTimer))
      clearInterval(this.scrollTimer);
    this.scrollTimer = direction === 0 || Object.isNull(dragged) ? null : setInterval(() => this.scrollBy(direction, dragged), Resources.treeScrollInterval);
  }

  private scrollBy(direction: number, dragged: TreeNode): void {
    this.scrollArea.scrollTop += direction * Resources.treeScrollStep;
    this.refresh(dragged);
  }

  private scroller(): HTMLElement | undefined {
    for (let element: HTMLElement | null = this.host; !Object.isNull(element); element = element.parentElement)
      if (element.scrollHeight > element.clientHeight && Resources.scrollOverflow.test(getComputedStyle(element).overflowY))
        return element;
    return undefined;
  }
}
