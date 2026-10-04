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

import { Resources } from "../../resources";
import { ToolbarDropTarget } from "../models/toolbar-drop-target";
import { ToolbarService } from "./toolbar.service";

@Injectable({ providedIn: "root" })
export class ToolbarDragService {
  private readonly document: Document = inject(DOCUMENT);
  private readonly toolbars: ToolbarService = inject(ToolbarService);
  private readonly draggingState: WritableSignal<string | null> = signal(null);
  private readonly targetState: WritableSignal<ToolbarDropTarget | null> = signal(null);
  private stopListening: (() => void) | null = null;

  public readonly dragging: Signal<string | null> = this.draggingState.asReadonly();
  public readonly target: Signal<ToolbarDropTarget | null> = this.targetState.asReadonly();

  public begin(name: string, event: PointerEvent): void {
    if (event.button !== Resources.primaryButton)
      return;
    this.stop();
    const startX = event.clientX;
    const startY = event.clientY;
    const onMove = (moved: PointerEvent): void => this.move(name, startX, startY, moved);
    const onEnd = (): void => this.end();
    const onCancel = (): void => this.stop();
    const onKey = (key: KeyboardEvent): void => this.cancelOnEscape(key);
    this.document.addEventListener(Resources.pointerMoveEvent, onMove);
    this.document.addEventListener(Resources.pointerUpEvent, onEnd);
    this.document.addEventListener(Resources.pointerCancelEvent, onCancel);
    this.document.addEventListener(Resources.keyDownEvent, onKey, { capture: true });
    window.addEventListener(Resources.blurEvent, onCancel);
    this.stopListening = () => {
      this.document.removeEventListener(Resources.pointerMoveEvent, onMove);
      this.document.removeEventListener(Resources.pointerUpEvent, onEnd);
      this.document.removeEventListener(Resources.pointerCancelEvent, onCancel);
      this.document.removeEventListener(Resources.keyDownEvent, onKey, { capture: true });
      window.removeEventListener(Resources.blurEvent, onCancel);
    };
  }

  private move(name: string, startX: number, startY: number, event: PointerEvent): void {
    if (Object.isNull(this.draggingState())) {
      if (Math.hypot(event.clientX - startX, event.clientY - startY) < Resources.dragThreshold)
        return;
      this.draggingState.set(name);
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

  private cancelOnEscape(event: KeyboardEvent): void {
    if (event.key !== Resources.escapeKey || Object.isNull(this.draggingState()))
      return;
    event.preventDefault();
    event.stopPropagation();
    this.stop();
  }

  private stop(): void {
    this.stopListening?.();
    this.stopListening = null;
    this.draggingState.set(null);
    this.targetState.set(null);
  }

  private targetAt(name: string, x: number, y: number): ToolbarDropTarget | null {
    const band = this.document.querySelector<HTMLElement>(Resources.toolbarBandSelector)?.getBoundingClientRect();
    const rows = [...this.document.querySelectorAll<HTMLElement>(Resources.toolbarRowSelector)];
    if (Object.isUndefined(band) || rows.length === 0 || x < band.left || x > band.right || y < band.top || y > band.bottom)
      return null;
    const element = rows.find(t => y <= t.getBoundingClientRect().bottom) ?? rows[rows.length - 1] as HTMLElement;
    const rect = element.getBoundingClientRect();
    const row = Number(element.dataset[Resources.toolbarRowData]);
    const edge = rect.height / Resources.toolbarEdgeFraction;
    if (y < rect.top + edge)
      return new ToolbarDropTarget(row, 0, true, rect.left, rect.top, rect.width);
    if (y > rect.bottom - edge)
      return new ToolbarDropTarget(row + 1, 0, true, rect.left, rect.bottom, rect.width);
    return this.rowTarget(name, element, row, rect, x);
  }

  private rowTarget(name: string, element: HTMLElement, row: number, rect: DOMRect, x: number): ToolbarDropTarget {
    const items = [...element.querySelectorAll<HTMLElement>(Resources.toolbarSelector)].filter(t => t.dataset[Resources.toolbarData] !== name);
    const next = items.find(t => x < t.getBoundingClientRect().left + t.getBoundingClientRect().width / 2);
    const last = items.at(-1)?.getBoundingClientRect();
    const length = this.toolbars.rows()[row]?.length ?? 0;
    const dragged = this.toolbars.rows().flatMap((t, r) => t.map((u, i) => ({ name: u.name, row: r, index: i }))).find(t => t.name === name);
    const before = Object.isUndefined(next) ? length : Number(next.dataset[Resources.toolbarIndexData]);
    const index = dragged?.row === row && dragged.index < before ? before - 1 : before;
    return new ToolbarDropTarget(row, index, false, next?.getBoundingClientRect().left ?? last?.right ?? rect.left, rect.top, rect.height);
  }
}
