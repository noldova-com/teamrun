/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Directive, ElementRef, type Signal, type WritableSignal, afterRenderEffect, inject, input, signal } from "@angular/core";

import { AppearanceService } from "@noldova/teamrun-shell-ui";

import type { GroupFrame } from "../../models/layout/group-frame";
import { Resources } from "../../../resources";

@Directive({
  selector: "[trTabScroller]",
  exportAs: "trTabScroller",
  host: {
    "(wheel)": "scrollAcross($event)"
  }
})
export class TabScrollerDirective {
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly isOverflowingValue: WritableSignal<boolean> = signal(false);

  public readonly actionBar = input.required<HTMLElement>({ alias: "trTabScroller" });
  public readonly frame = input.required<GroupFrame>({ alias: "trTabScrollerFrame" });
  public readonly isOverflowing: Signal<boolean> = this.isOverflowingValue.asReadonly();

  public constructor() {
    const appearance = inject(AppearanceService);
    afterRenderEffect(() => {
      this.frame();
      this.isOverflowingValue();
      appearance.typography();
      this.host.style.scrollPaddingInlineEnd = `${this.actionBar().offsetWidth}px`;
      this.host.querySelectorAll(Resources.selectedTabSelector).forEach(t => t.scrollIntoView(Resources.revealOptions));
      this.isOverflowingValue.set(this.host.scrollWidth > this.host.clientWidth);
    });
  }

  protected scrollAcross(event: WheelEvent): void {
    if (event.deltaX !== 0 || event.deltaY === 0 || this.host.scrollWidth <= this.host.clientWidth)
      return;
    event.preventDefault();
    this.host.scrollLeft += event.deltaY;
  }
}
