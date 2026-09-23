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

import { DockSide } from "../enums/dock-side";
import type { PanelId } from "../enums/panel-id";
import { DropTarget } from "../models/drop-target";
import { Resources } from "../resources";
import { LayoutService } from "./layout.service";

@Injectable({ providedIn: "root" })
export class PanelDragService {
  private readonly document: Document = inject(DOCUMENT);
  private readonly layout: LayoutService = inject(LayoutService);
  private readonly draggingSignal: WritableSignal<PanelId | null> = signal(null);
  private readonly targetSignal: WritableSignal<DropTarget | null> = signal(null);
  private readonly pointSignal: WritableSignal<readonly [number, number]> = signal([0, 0]);
  private readonly onMove: (event: PointerEvent) => void = event => this.move(event);
  private readonly onEnd: (event: PointerEvent) => void = event => this.end(event);
  private pending: { panel: PanelId; x: number; y: number } | null = null;

  public readonly dragging: Signal<PanelId | null> = this.draggingSignal.asReadonly();
  public readonly target: Signal<DropTarget | null> = this.targetSignal.asReadonly();
  public readonly point: Signal<readonly [number, number]> = this.pointSignal.asReadonly();

  public begin(panel: PanelId, event: PointerEvent): void {
    if (event.button !== Resources.primaryButton)
      return;
    this.pending = { panel, x: event.clientX, y: event.clientY };
    this.document.addEventListener(Resources.pointerMoveEvent, this.onMove);
    this.document.addEventListener(Resources.pointerUpEvent, this.onEnd);
    this.document.addEventListener(Resources.pointerCancelEvent, this.onEnd);
  }

  public isDropBefore(side: DockSide, index: number): boolean {
    const target = this.targetSignal();
    return !Object.isNull(target) && target.side === side && target.index === index;
  }

  private move(event: PointerEvent): void {
    if (Object.isNull(this.pending))
      return;
    if (Object.isNull(this.draggingSignal())) {
      if (Math.hypot(event.clientX - this.pending.x, event.clientY - this.pending.y) < Resources.dragThreshold)
        return;
      this.draggingSignal.set(this.pending.panel);
      this.document.body.classList.add(Resources.draggingBodyClass);
    }
    this.pointSignal.set([event.clientX, event.clientY]);
    const target = this.targetAt(event.clientX, event.clientY);
    if (!(target?.equals(this.targetSignal()) ?? Object.isNull(this.targetSignal())))
      this.targetSignal.set(target);
  }

  private end(_event: PointerEvent): void {
    const panel = this.draggingSignal();
    const target = this.targetSignal();
    this.document.removeEventListener(Resources.pointerMoveEvent, this.onMove);
    this.document.removeEventListener(Resources.pointerUpEvent, this.onEnd);
    this.document.removeEventListener(Resources.pointerCancelEvent, this.onEnd);
    this.pending = null;
    this.draggingSignal.set(null);
    this.targetSignal.set(null);
    this.document.body.classList.remove(Resources.draggingBodyClass);
    if (!Object.isNull(panel) && !Object.isNull(target))
      this.layout.movePanel(panel, target.side, target.index);
  }

  private targetAt(x: number, y: number): DropTarget | null {
    const element = this.document.elementFromPoint(x, y);
    if (Object.isNull(element))
      return null;
    const zone = element.closest<HTMLElement>(Resources.dropSideSelector);
    if (Object.isNull(zone))
      return null;
    const side = Object.values(DockSide).find(t => t === zone.dataset[Resources.dropSideData]);
    if (Object.isUndefined(side))
      return null;
    const tab = element.closest<HTMLElement>(Resources.tabIndexSelector);
    if (Object.isNull(tab))
      return new DropTarget(side, this.layout.dock(side).panels.length);
    const bounds = tab.getBoundingClientRect();
    const past = x > bounds.left + bounds.width / 2;
    return new DropTarget(side, Number(tab.dataset[Resources.tabIndexData]) + (past ? 1 : 0));
  }
}
