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
import { TreeDrop } from "../models/tree-drop";
import { TreeGhost } from "../models/tree-ghost";
import { TreeLine } from "../models/tree-line";
import { TreeMove } from "../models/tree-move";
import type { TreeNode } from "../models/tree-node";

export class TreeDragSession {
  private readonly draggingState: WritableSignal<TreeNode | null> = signal(null);
  private readonly dropState: WritableSignal<TreeDrop | null> = signal(null);
  private readonly ghostState: WritableSignal<TreeGhost | null> = signal(null);
  private readonly lineState: WritableSignal<TreeLine | null> = signal(null);
  private readonly document: Document;
  private readonly host: HTMLElement;
  private readonly nodes: Signal<readonly TreeNode[]>;
  private readonly nodeAt: (row: Element) => TreeNode | undefined;
  private readonly isOpen: (node: TreeNode) => boolean;
  private readonly open: (node: TreeNode) => void;
  private readonly commit: (move: TreeMove) => void;
  private stopListening: (() => void) | null = null;
  private hoverTimer: ReturnType<typeof setTimeout> | null = null;
  private hoverId: string | null = null;
  private scrollTimer: ReturnType<typeof setInterval> | null = null;
  private scrollDirection: number = 0;

  public readonly dragging: Signal<TreeNode | null> = this.draggingState.asReadonly();
  public readonly drop: Signal<TreeDrop | null> = this.dropState.asReadonly();
  public readonly ghost: Signal<TreeGhost | null> = this.ghostState.asReadonly();
  public readonly line: Signal<TreeLine | null> = this.lineState.asReadonly();

  public constructor(document: Document, host: HTMLElement, nodes: Signal<readonly TreeNode[]>, nodeAt: (row: Element) => TreeNode | undefined,
    isOpen: (node: TreeNode) => boolean, open: (node: TreeNode) => void, commit: (move: TreeMove) => void) {
    this.document = document;
    this.host = host;
    this.nodes = nodes;
    this.nodeAt = nodeAt;
    this.isOpen = isOpen;
    this.open = open;
    this.commit = commit;
  }

  public begin(event: PointerEvent, node: TreeNode): void {
    if (event.button !== Resources.primaryButton)
      return;
    this.stop();
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const onMove = (moved: PointerEvent): void => this.move(moved, node, event, box);
    const onEnd = (): void => this.end();
    const onCancel = (): void => this.stop();
    const onKey = (key: KeyboardEvent): void => this.cancelOnEscape(key);
    this.document.addEventListener(Resources.pointermoveEvent, onMove);
    this.document.addEventListener(Resources.pointerupEvent, onEnd);
    this.document.addEventListener(Resources.pointercancelEvent, onCancel);
    this.document.addEventListener(Resources.keydownEvent, onKey, { capture: true });
    window.addEventListener(Resources.blurEvent, onCancel);
    this.stopListening = () => {
      this.document.removeEventListener(Resources.pointermoveEvent, onMove);
      this.document.removeEventListener(Resources.pointerupEvent, onEnd);
      this.document.removeEventListener(Resources.pointercancelEvent, onCancel);
      this.document.removeEventListener(Resources.keydownEvent, onKey, { capture: true });
      window.removeEventListener(Resources.blurEvent, onCancel);
    };
  }

  public stop(): void {
    this.stopListening?.();
    this.stopListening = null;
    this.draggingState.set(null);
    this.setTarget(null);
    this.ghostState.set(null);
    this.setScroll(0);
  }

  private move(event: PointerEvent, node: TreeNode, start: PointerEvent, box: DOMRect): void {
    if (Object.isNull(this.draggingState())) {
      if (!DragGesture.hasStarted(start.clientX, start.clientY, event.clientX, event.clientY))
        return;
      this.draggingState.set(node);
    }
    this.ghostState.set(new TreeGhost(event.clientX + Resources.treeGhostOffset, event.clientY - box.height / 2, box.width));
    this.setTarget(this.targetAt(event, node));
    this.setScroll(this.scrollAt(event.clientY, box.height));
  }

  private end(): void {
    const drop = this.dropState();
    const dragged = !Object.isNull(this.draggingState());
    this.stop();
    if (dragged)
      this.swallowClick();
    if (!Object.isNull(drop))
      this.commit(drop.move);
  }

  private swallowClick(): void {
    const swallow = (click: Event): void => click.stopPropagation();
    this.document.addEventListener(Resources.clickEvent, swallow, { capture: true, once: true });
    setTimeout(() => this.document.removeEventListener(Resources.clickEvent, swallow, { capture: true }));
  }

  private cancelOnEscape(event: KeyboardEvent): void {
    if (event.key !== Resources.escapeKey || Object.isNull(this.draggingState()))
      return;
    event.preventDefault();
    event.stopPropagation();
    this.stop();
  }

  private targetAt(event: PointerEvent, dragged: TreeNode): TreeDrop | null {
    const row = (event.target as Element | null)?.closest(Resources.treeItemSelector);
    const node = Object.isNullOrUndefined(row) || !this.host.contains(row) ? undefined : this.nodeAt(row);
    if (Object.isNullOrUndefined(row) || Object.isUndefined(node))
      return null;
    const box = row.getBoundingClientRect();
    const fraction = (event.clientY - box.top) / box.height;
    const edge = 1 / Resources.treeDropEdgeFraction;
    const place = node.isBranch && fraction >= edge && fraction <= 1 - edge ? TreeDropPlace.Into : fraction < 0.5 ? TreeDropPlace.Before : TreeDropPlace.After;
    const move = TreeMove.drop(this.nodes(), dragged.id, node.id, place);
    return Object.isNull(move) ? null : new TreeDrop(node.id, place, move);
  }

  private setTarget(drop: TreeDrop | null): void {
    const current = this.dropState();
    if (current?.targetId === drop?.targetId && current?.place === drop?.place)
      return;
    this.dropState.set(drop);
    this.lineState.set(Object.isNull(drop) ? null : this.lineOf(drop));
    this.watchHover(drop);
  }

  private lineOf(drop: TreeDrop): TreeLine | null {
    if (drop.place === TreeDropPlace.Into)
      return null;
    const row = this.rowOf(drop.targetId) as HTMLElement;
    const box = row.getBoundingClientRect();
    const frame = this.host.getBoundingClientRect();
    const style = getComputedStyle(row);
    const inset = Number.parseFloat(style.paddingInlineStart);
    const isRightToLeft = this.host.matches(Resources.rightToLeftSelector);
    return new TreeLine((drop.place === TreeDropPlace.Before ? box.top : box.bottom) - frame.top, (isRightToLeft ? frame.right - box.right : box.left - frame.left) + inset,
      box.width - inset - Number.parseFloat(style.paddingInlineEnd));
  }

  private watchHover(drop: TreeDrop | null): void {
    const node = Object.isNull(drop) ? undefined : this.nodeAt(this.rowOf(drop.targetId) as HTMLElement);
    if ((node?.id ?? null) === this.hoverId)
      return;
    if (!Object.isNull(this.hoverTimer))
      clearTimeout(this.hoverTimer);
    this.hoverTimer = null;
    this.hoverId = node?.id ?? null;
    if (!Object.isUndefined(node) && node.isBranch && !this.isOpen(node))
      this.hoverTimer = setTimeout(() => this.open(node), Resources.treeHoverOpenDelay);
  }

  private rowOf(id: string): Element | undefined {
    return [...this.host.querySelectorAll(Resources.treeItemSelector)].find(t => this.nodeAt(t)?.id === id);
  }

  private scrollAt(y: number, edge: number): number {
    const area = this.scroller()?.getBoundingClientRect();
    if (Object.isUndefined(area))
      return 0;
    return y < area.top + edge ? -1 : y > area.bottom - edge ? 1 : 0;
  }

  private setScroll(direction: number): void {
    if (direction === this.scrollDirection)
      return;
    this.scrollDirection = direction;
    if (!Object.isNull(this.scrollTimer))
      clearInterval(this.scrollTimer);
    this.scrollTimer = direction === 0 ? null : setInterval(() => {
      (this.scroller() as HTMLElement).scrollTop += direction * Resources.treeScrollStep;
    }, Resources.treeScrollInterval);
  }

  private scroller(): HTMLElement | undefined {
    for (let element: HTMLElement | null = this.host; !Object.isNull(element); element = element.parentElement)
      if (element.scrollHeight > element.clientHeight && /auto|scroll/u.test(getComputedStyle(element).overflowY))
        return element;
    return undefined;
  }
}
