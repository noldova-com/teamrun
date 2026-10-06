/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, type InputSignal, type Signal, type WritableSignal, effect, inject, input, signal,
  untracked } from "@angular/core";

import "@noldova/teamrun-foundation-core";

import type { Tab } from "../../models/layout/tab";
import { LiveViewService } from "../../services/live-view.service";
import type { TabContentComponent } from "../tab-content/tab-content.component";

@Component({
  selector: "tr-tab-slot",
  templateUrl: "./tab-slot.component.html",
  styleUrl: "./tab-slot.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TabSlotComponent {
  private readonly views: LiveViewService = inject(LiveViewService);
  private readonly element: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly contentValue: WritableSignal<TabContentComponent | null> = signal(null);
  private shown: Tab | null = null;

  public readonly tab: InputSignal<Tab> = input.required<Tab>();
  public readonly isDocked: InputSignal<boolean> = input<boolean>(false);
  public readonly content: Signal<TabContentComponent | null> = this.contentValue.asReadonly();

  public constructor() {
    effect(() => {
      const tab = this.tab();
      const isDocked = this.isDocked();
      this.views.destroyed();
      untracked(() => this.show(tab, isDocked));
    });
    inject(DestroyRef).onDestroy(() => this.hide());
  }

  private show(tab: Tab, isDocked: boolean): void {
    if (!Object.isNull(this.shown) && !this.shown.equals(tab))
      this.views.hide(this.shown, this.element);
    this.shown = tab;
    this.contentValue.set(this.views.show(tab, this.element, isDocked));
  }

  private hide(): void {
    if (!Object.isNull(this.shown))
      this.views.hide(this.shown, this.element);
  }
}
