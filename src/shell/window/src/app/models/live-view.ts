/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ComponentRef } from "@angular/core";

import "@noldova/teamrun-foundation-core";

import type { TabContentComponent } from "../components/tab-content/tab-content.component";
import type { Tab } from "./layout/tab";
import { ScrollOffset } from "./scroll-offset";
import { Resources } from "../../resources";

export class LiveView {
  private readonly offsets: Map<Element, ScrollOffset> = new Map();
  private focused: HTMLElement | null = null;
  private slotValue: HTMLElement | null = null;

  public readonly tab: Tab;
  public readonly ref: ComponentRef<TabContentComponent>;

  public constructor(tab: Tab, ref: ComponentRef<TabContentComponent>) {
    this.tab = tab;
    this.ref = ref;
    this.element.addEventListener(Resources.scrollEvent, event => this.keep(event), { capture: true, passive: true });
  }

  public get element(): HTMLElement {
    return this.ref.instance.element;
  }

  public get slot(): HTMLElement | null {
    return this.slotValue;
  }

  public leave(): void {
    const active = this.element.ownerDocument.activeElement;
    this.focused = active instanceof HTMLElement && this.element.contains(active) ? active : null;
    this.element.remove();
    this.slotValue = null;
  }

  public enter(slot: HTMLElement): void {
    slot.append(this.element);
    this.slotValue = slot;
  }

  public restore(): void {
    for (const [element, offset] of this.offsets)
      if (this.element.contains(element))
        offset.restore();
      else
        this.offsets.delete(element);
    const focused = this.focused;
    this.focused = null;
    const document = this.element.ownerDocument;
    if (!Object.isNull(focused) && document.activeElement === document.body && this.element.isConnected && this.element.contains(focused))
      focused.focus({ preventScroll: true });
  }

  private keep(event: Event): void {
    if (event.target instanceof Element)
      this.offsets.set(event.target, ScrollOffset.of(event.target));
  }
}
