/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DOCUMENT } from "@angular/common";
import { Injectable, type Signal, type WritableSignal, inject, signal } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import { DragGesture, PointerDrag } from "@noldova/teamrun-shell-ui";

import { Resources } from "../../resources";
import { ToolbarDropTarget } from "../models/toolbar-drop-target";
import { ToolbarService } from "./toolbar.service";

@Injectable({ providedIn: "root" })
export class ToolbarDragService {
  private readonly document: Document = inject(DOCUMENT);
  private readonly toolbars: ToolbarService = inject(ToolbarService);
  private readonly draggingState: WritableSignal<string | null> = signal(null);
  private readonly targetState: WritableSignal<ToolbarDropTarget | null> = signal(null);
  private pointer: PointerDrag | null = null;

  public readonly dragging: Signal<string | null> = this.draggingState.asReadonly();
  public readonly target: Signal<ToolbarDropTarget | null> = this.targetState.asReadonly();

  public begin(name: string, event: PointerEvent): void {
    if (event.button !== Resources.primaryButton)
      return;
    this.stop();
    const startX = event.clientX;
    const startY = event.clientY;
    this.pointer = new PointerDrag(this.document.documentElement, event, moved => this.move(name, startX, startY, moved), () => this.end(), () => this.stop());
  }

  private move(name: string, startX: number, startY: number, event: PointerEvent): void {
    if (Object.isNull(this.draggingState())) {
      if (!DragGesture.hasStarted(startX, startY, event.clientX, event.clientY))
        return;
      this.draggingState.set(name);
      this.pointer?.start();
    }
    const target = this.targetAt(name, event.clientX, event.clientY);
    if (!(target?.equals(this.targetState()) ?? Object.isNull(this.targetState())))
      this.targetState.set(target);
  }

  private end(): void {
    const name = this.draggingState();
    const target = this.targetState();
    this.stop();
    if (Object.isNull(name) || Object.isNull(target))
      return;
    if (target.isNewRow)
      this.toolbars.moveToNewRow(name, target.row);
    else
      this.toolbars.move(name, target.row, target.index);
  }

  private stop(): void {
    this.pointer?.stop();
    this.pointer = null;
    this.draggingState.set(null);
    this.targetState.set(null);
  }

  private targetAt(name: string, x: number, y: number): ToolbarDropTarget | null {
    const bandElement = this.document.querySelector<HTMLElement>(Resources.toolbarBandSelector);
    const rows = [...this.document.querySelectorAll<HTMLElement>(Resources.toolbarRowSelector)];
    if (Object.isNull(bandElement) || rows.length === 0)
      return null;
    const band = bandElement.getBoundingClientRect();
    if (x < band.left || x > band.right || y < band.top || y > band.bottom)
      return null;
    const element = rows.find(t => y <= t.getBoundingClientRect().bottom) ?? rows[rows.length - 1] as HTMLElement;
    const rect = element.getBoundingClientRect();
    const row = Number(element.dataset[Resources.toolbarRowData]);
    const edge = rect.height / Resources.toolbarEdgeFraction;
    const halfGap = parseFloat(getComputedStyle(bandElement).rowGap) / 2;
    if (y < rect.top + edge)
      return new ToolbarDropTarget(row, 0, true, rect.left, rect.top - halfGap, rect.width);
    if (y > rect.bottom - edge)
      return new ToolbarDropTarget(row + 1, 0, true, rect.left, rect.bottom + halfGap, rect.width);
    return this.rowTarget(name, element, row, rect, x);
  }

  private rowTarget(name: string, element: HTMLElement, row: number, rect: DOMRect, x: number): ToolbarDropTarget {
    const items = [...element.querySelectorAll<HTMLElement>(Resources.toolbarSelector)].filter(t => t.dataset[Resources.toolbarData] !== name);
    const isRightToLeft = getComputedStyle(element).direction === Resources.rightToLeft;
    const start = (box: DOMRect): number => isRightToLeft ? box.right : box.left;
    const end = (box: DOMRect): number => isRightToLeft ? box.left : box.right;
    const isBefore = (box: DOMRect): boolean => isRightToLeft ? x > box.left + box.width / 2 : x < box.left + box.width / 2;
    const next = items.map(t => ({ element: t, box: t.getBoundingClientRect() })).find(t => isBefore(t.box));
    const last = items.at(-1)?.getBoundingClientRect();
    const length = this.toolbars.rows()[row]?.length ?? 0;
    const dragged = this.toolbars.rows().flatMap((t, r) => t.map((u, i) => ({ name: u.name, row: r, index: i }))).find(t => t.name === name);
    const before = Object.isUndefined(next) ? length : Number(next.element.dataset[Resources.toolbarIndexData]);
    const index = dragged?.row === row && dragged.index < before ? before - 1 : before;
    const bar = (element.querySelector<HTMLElement>(Resources.toolbarSelector) ?? element).getBoundingClientRect();
    const edge = Object.isUndefined(next) ? (Object.isUndefined(last) ? start(rect) : end(last)) : start(next.box);
    return new ToolbarDropTarget(row, index, false, edge, bar.top + bar.height / 2, 0);
  }
}
