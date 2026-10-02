/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  ChangeDetectionStrategy, Component, ElementRef, type Signal, type WritableSignal, afterRenderEffect, computed, inject, input, signal, viewChild
} from "@angular/core";
import { MatMenuModule } from "@angular/material/menu";

import "@noldova/teamrun-foundation-core";
import { AppearanceService, IconButtonComponent, PanelCardComponent, PanelSurface, TabComponent } from "@noldova/teamrun-shell-ui";

import { Resources } from "../../../resources";
import type { DockSide } from "../../enums/dock-side";
import type { GroupFrame } from "../../models/layout/group-frame";
import type { Tab } from "../../models/layout/tab";
import type { TabGroup } from "../../models/layout/tab-group";
import { LayoutService } from "../../services/layout.service";
import { TabDragService } from "../../services/tab-drag.service";
import { TabLabelService } from "../../services/tab-label.service";
import { TabMenuComponent } from "../tab-menu/tab-menu.component";

@Component({
  selector: "tr-tab-group",
  imports: [IconButtonComponent, MatMenuModule, PanelCardComponent, TabComponent, TabMenuComponent],
  templateUrl: "./tab-group.component.html",
  styleUrl: "./tab-group.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[attr.data-group]": "group().id",
    "[attr.data-side]": "frame().side",
    "[style.left.rem]": "frame().bounds.x",
    "[style.top.rem]": "frame().bounds.y",
    "[style.width.rem]": "frame().bounds.width",
    "[style.height.rem]": "frame().bounds.height"
  }
})
export class TabGroupComponent {
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly scroller: Signal<ElementRef<HTMLElement>> = viewChild.required<ElementRef<HTMLElement>>("scroller");
  private readonly actions: Signal<ElementRef<HTMLElement>> = viewChild.required<ElementRef<HTMLElement>>("actions");

  protected readonly resources: typeof Resources = Resources;
  protected readonly layout: LayoutService = inject(LayoutService);
  protected readonly drag: TabDragService = inject(TabDragService);
  protected readonly labels: TabLabelService = inject(TabLabelService);
  protected readonly isOverflowing: WritableSignal<boolean> = signal(false);
  protected readonly group: Signal<TabGroup> = computed(() => this.frame().group);
  protected readonly surface: Signal<PanelSurface> = computed(() => Object.isNull(this.frame().side) ? PanelSurface.Panel : PanelSurface.Shell);
  protected readonly isShell: Signal<boolean> = computed(() => this.surface() === PanelSurface.Shell);
  protected readonly hideSide: Signal<DockSide | null> = computed(() => {
    const side = this.frame().side;
    return !Object.isNull(side) && this.layout.layout().dock(side).root?.cornerGroup.id === this.group().id ? side : null;
  });

  public readonly frame = input.required<GroupFrame>();

  public constructor() {
    const appearance = inject(AppearanceService);
    afterRenderEffect(() => {
      this.frame();
      this.isOverflowing();
      appearance.typography();
      const scroller = this.scroller().nativeElement;
      scroller.style.scrollPaddingInlineEnd = `${this.actions().nativeElement.offsetWidth}px`;
      scroller.querySelectorAll(Resources.selectedTabSelector).forEach(t => t.scrollIntoView(Resources.revealOptions));
      this.isOverflowing.set(scroller.scrollWidth > scroller.clientWidth);
    });
  }

  protected choose(tab: Tab): void {
    this.layout.activate(tab);
    for (const element of this.host.querySelectorAll<HTMLElement>(Resources.tabKeySelector))
      if (element.dataset[Resources.tabKeyData] === tab.key)
        element.focus();
  }

  protected scrollAcross(event: WheelEvent, scroller: HTMLElement): void {
    if (event.deltaX !== 0 || event.deltaY === 0 || scroller.scrollWidth <= scroller.clientWidth)
      return;
    event.preventDefault();
    scroller.scrollLeft += event.deltaY;
  }

  protected onStripKey(event: KeyboardEvent): void {
    const tabs = this.group().tabs;
    const current = tabs.findIndex(t => t.equals(this.group().active));
    const tab = tabs[this.indexFor(event.key, current, tabs.length)];
    if (Object.isUndefined(tab))
      return;
    event.preventDefault();
    this.choose(tab);
  }

  private indexFor(key: string, current: number, count: number): number {
    switch (key) {
      case Resources.arrowLeftKey:
        return (current - 1 + count) % count;
      case Resources.arrowRightKey:
        return (current + 1) % count;
      case Resources.homeKey:
        return 0;
      case Resources.endKey:
        return count - 1;
      default:
        return -1;
    }
  }
}
