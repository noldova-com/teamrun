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
import { BottomDockSpan } from "../enums/bottom-dock-span";
import { DockSide } from "../enums/dock-side";
import { PanelEdge } from "../enums/panel-edge";
import type { DropTarget } from "../models/layout/drop-target";
import { GroupDropTarget } from "../models/layout/group-drop-target";
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
  private pointer: PointerDrag | null = null;

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
    this.pointer = new PointerDrag(this.document.documentElement, event, moved => this.move(tab, startX, startY, moved), () => this.end(), () => this.stop());
  }

  public isDropBefore(groupId: number, index: number): boolean {
    return new TabDropTarget(groupId, index).equals(this.targetState());
  }

  private move(tab: Tab, startX: number, startY: number, event: PointerEvent): void {
    if (Object.isNull(this.draggingState())) {
      if (!DragGesture.hasStarted(startX, startY, event.clientX, event.clientY))
        return;
      this.draggingState.set(tab);
      this.pointer?.start();
      this.document.body.classList.add(Resources.draggingClass);
    }
    this.pointerXState.set(event.clientX);
    this.pointerYState.set(event.clientY);
    const element = this.document.elementFromPoint(event.clientX, event.clientY);
    const group = this.groupAt(element);
    const isOverRow = !Object.isNull(element?.closest(Resources.dropTabsSelector) ?? null);
    this.hoveredState.set(isOverRow ? null : group?.id ?? null);
    const target = Object.isNull(element) ? null : this.targetAt(tab, element, group, isOverRow, event.clientX, event.clientY);
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

  private stop(): void {
    this.pointer?.stop();
    this.pointer = null;
    this.draggingState.set(null);
    this.targetState.set(null);
    this.hoveredState.set(null);
    this.document.body.classList.remove(Resources.draggingClass);
  }

  private groupAt(element: Element | null): TabGroup | null {
    const zone = element?.closest<HTMLElement>(Resources.dropGroupSelector) ?? null;
    return Object.isNull(zone) ? null : this.layout.layout().group(Number(zone.dataset[Resources.dropGroupData]));
  }

  private targetAt(tab: Tab, element: Element, group: TabGroup | null, isOverRow: boolean, x: number, y: number): DropTarget | null {
    const docking = this.dockingTargetAt(tab, element, group);
    if (!Object.isNull(docking))
      return docking;
    const icon = element.closest<HTMLElement>(Resources.dropBeforeSelector);
    if (!Object.isNull(icon))
      return this.iconTargetAt(tab, icon, x, y);
    return Object.isNull(group) || !isOverRow ? null : this.rowTargetAt(tab, element, group, x);
  }

  private iconTargetAt(tab: Tab, icon: HTMLElement, x: number, y: number): DropTarget | null {
    const bounds = icon.getBoundingClientRect();
    const isBefore = icon.dataset[Resources.dropAxisData] === Resources.verticalOrientation ? y < bounds.top + bounds.height / 2 : !this.isAfter(icon, x);
    const encoded = String(icon.dataset[isBefore ? Resources.dropBeforeData : Resources.dropAfterData]);
    const separator = encoded.indexOf(Resources.dropTargetSeparator);
    const group = this.layout.layout().group(Number(encoded.slice(0, separator)));
    return Object.isNull(group) || !group.accepts(tab) ? null : new TabDropTarget(group.id, Number(encoded.slice(separator + 1)));
  }

  private dockingTargetAt(tab: Tab, element: Element, group: TabGroup | null): DropTarget | null {
    const sideGuide = tab.isMovable ? element.closest<HTMLElement>(Resources.dropSideSelector) : null;
    const side = Object.values(DockSide).find(t => t === sideGuide?.dataset[Resources.dropSideData]);
    if (!Object.isUndefined(side))
      return new SideDropTarget(side, Object.values(BottomDockSpan).find(t => t === sideGuide?.dataset[Resources.dropSpanData]) ?? null);
    const plate = element.closest(Resources.dropPlateSelector);
    const guide = element.closest<HTMLElement>(Resources.directionSelector);
    if (Object.isNull(plate) || Object.isNull(guide) || Object.isNull(group) || !group.accepts(tab))
      return null;
    const edge = Object.values(PanelEdge).find(t => t === guide.dataset[Resources.directionData]);
    return Object.isUndefined(edge) ? new GroupDropTarget(group.id) : new SplitDropTarget(group.id, edge);
  }

  private rowTargetAt(tab: Tab, element: Element, group: TabGroup, x: number): DropTarget | null {
    if (!group.accepts(tab))
      return null;
    const marker = element.closest<HTMLElement>(Resources.tabIndexSelector);
    if (Object.isNull(marker))
      return new TabDropTarget(group.id, group.tabs.length);
    return new TabDropTarget(group.id, Number(marker.dataset[Resources.tabIndexData]) + (this.isAfter(marker, x) ? 1 : 0));
  }

  private isAfter(marker: HTMLElement, x: number): boolean {
    const bounds = marker.getBoundingClientRect();
    const isRight = x > bounds.left + bounds.width / 2;
    return getComputedStyle(marker).direction === Resources.rightToLeft ? !isRight : isRight;
  }
}
