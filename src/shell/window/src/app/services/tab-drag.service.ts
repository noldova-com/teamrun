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
import { BottomDockSpan } from "../enums/bottom-dock-span";
import { DockSide } from "../enums/dock-side";
import { PanelEdge } from "../enums/panel-edge";
import type { DropTarget } from "../models/layout/drop-target";
import { SideDropTarget } from "../models/layout/side-drop-target";
import { SplitDropTarget } from "../models/layout/split-drop-target";
import type { Tab } from "../models/layout/tab";
import type { TabGroup } from "../models/layout/tab-group";
import { TabDropTarget } from "../models/layout/tab-drop-target";
import { LayoutService } from "./layout.service";

@Injectable({ providedIn: "root" })
export class TabDragService {
  private readonly document: Document = inject(DOCUMENT);
  private readonly layout: LayoutService = inject(LayoutService);
  private readonly draggingState: WritableSignal<Tab | null> = signal(null);
  private readonly targetState: WritableSignal<DropTarget | null> = signal(null);
  private readonly hoveredState: WritableSignal<number | null> = signal(null);
  private readonly pointerXState: WritableSignal<number> = signal(0);
  private readonly pointerYState: WritableSignal<number> = signal(0);
  private stopListening: (() => void) | null = null;

  public readonly dragging: Signal<Tab | null> = this.draggingState.asReadonly();
  public readonly target: Signal<DropTarget | null> = this.targetState.asReadonly();
  public readonly hoveredGroup: Signal<number | null> = this.hoveredState.asReadonly();
  public readonly pointerX: Signal<number> = this.pointerXState.asReadonly();
  public readonly pointerY: Signal<number> = this.pointerYState.asReadonly();

  public begin(tab: Tab, event: PointerEvent): void {
    if (event.button !== Resources.primaryButton || (event.target instanceof Element && !Object.isNull(event.target.closest(Resources.tabCloseSelector))))
      return;
    this.stop();
    const startX = event.clientX;
    const startY = event.clientY;
    const onMove = (moved: PointerEvent): void => this.move(tab, startX, startY, moved);
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

  public isDropBefore(groupId: number, index: number): boolean {
    return new TabDropTarget(groupId, index).equals(this.targetState());
  }

  private move(tab: Tab, startX: number, startY: number, event: PointerEvent): void {
    if (Object.isNull(this.draggingState())) {
      if (Math.hypot(event.clientX - startX, event.clientY - startY) < Resources.dragThreshold)
        return;
      this.draggingState.set(tab);
      this.document.body.classList.add(Resources.draggingClass);
    }
    this.pointerXState.set(event.clientX);
    this.pointerYState.set(event.clientY);
    const element = this.document.elementFromPoint(event.clientX, event.clientY);
    this.hoveredState.set(this.groupAt(element)?.id ?? null);
    const target = this.targetAt(tab, element, event.clientX);
    if (!(target?.equals(this.targetState()) ?? Object.isNull(this.targetState())))
      this.targetState.set(target);
  }

  private end(): void {
    const tab = this.draggingState();
    const target = this.targetState();
    this.stop();
    if (!Object.isNull(tab) && !Object.isNull(target))
      this.layout.place(tab, target);
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
    this.hoveredState.set(null);
    this.document.body.classList.remove(Resources.draggingClass);
  }

  private groupAt(element: Element | null): TabGroup | null {
    const zone = element?.closest<HTMLElement>(Resources.dropGroupSelector) ?? null;
    return Object.isNull(zone) ? null : this.layout.layout().group(Number(zone.dataset[Resources.dropGroupData]));
  }

  private targetAt(tab: Tab, element: Element | null, x: number): DropTarget | null {
    if (Object.isNull(element))
      return null;
    const group = this.groupAt(element);
    const docking = tab.isMovable ? this.dockingTargetAt(element, group) : null;
    if (!Object.isNull(docking))
      return docking;
    return Object.isNull(group) ? null : this.stripTargetAt(tab, element, group, x);
  }

  private dockingTargetAt(element: Element, group: TabGroup | null): DropTarget | null {
    const sideGuide = element.closest<HTMLElement>(Resources.dropSideSelector);
    const side = Object.values(DockSide).find(t => t === sideGuide?.dataset[Resources.dropSideData]);
    if (!Object.isUndefined(side))
      return new SideDropTarget(side, Object.values(BottomDockSpan).find(t => t === sideGuide?.dataset[Resources.dropSpanData]) ?? null);
    const plate = element.closest(Resources.dropPlateSelector);
    const guide = element.closest<HTMLElement>(Resources.directionSelector);
    if (Object.isNull(plate) || Object.isNull(guide) || Object.isNull(group))
      return null;
    const edge = Object.values(PanelEdge).find(t => t === guide.dataset[Resources.directionData]);
    return Object.isUndefined(edge) ? new TabDropTarget(group.id, group.tabs.length) : new SplitDropTarget(group.id, edge);
  }

  private stripTargetAt(tab: Tab, element: Element, group: TabGroup, x: number): DropTarget | null {
    if (Object.isNull(element.closest(Resources.dropTabsSelector)) || !group.accepts(tab) || (!tab.isMovable && !group.has(tab)))
      return null;
    const marker = element.closest<HTMLElement>(Resources.tabIndexSelector);
    if (Object.isNull(marker))
      return new TabDropTarget(group.id, group.tabs.length);
    const bounds = marker.getBoundingClientRect();
    return new TabDropTarget(group.id, Number(marker.dataset[Resources.tabIndexData]) + (x > bounds.left + bounds.width / 2 ? 1 : 0));
  }
}
