/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DOCUMENT } from "@angular/common";
import { DestroyRef, Injectable, inject } from "@angular/core";

import { Resources } from "../../resources";

@Injectable({ providedIn: "root" })
export class ScrollRevealService {
  private readonly document: Document = inject(DOCUMENT);
  private readonly timers: Map<Element, ReturnType<typeof setTimeout>> = new Map();

  public constructor() {
    const listener = (event: Event): void => this.reveal(event.target);
    this.document.addEventListener(Resources.scrollEvent, listener, { capture: true, passive: true });
    inject(DestroyRef).onDestroy(() => {
      this.document.removeEventListener(Resources.scrollEvent, listener, { capture: true });
      for (const [element, timer] of this.timers) {
        clearTimeout(timer);
        element.removeAttribute(Resources.scrollingAttribute);
      }
      this.timers.clear();
    });
  }

  private reveal(target: EventTarget | null): void {
    const element = target instanceof Element ? target : this.document.documentElement;
    clearTimeout(this.timers.get(element));
    if (!element.hasAttribute(Resources.scrollingAttribute))
      element.setAttribute(Resources.scrollingAttribute, String.empty);
    this.timers.set(element, setTimeout(() => this.settle(element), Resources.scrollRevealDelay));
  }

  private settle(element: Element): void {
    this.timers.delete(element);
    element.removeAttribute(Resources.scrollingAttribute);
  }
}
