/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, EnvironmentInjector, type Signal, afterNextRender, computed, effect, inject, input, viewChild
} from "@angular/core";

import "@noldova/teamrun-foundation-core";
import {
  ContextMenuTriggerDirective, IconButtonComponent, MenuComponent, MenuItemComponent, MenuSeparatorComponent, MenuTriggerDirective, OverlayAlignment, OverlaySide,
  PanelCardComponent, PanelSurface, TabComponent, TooltipDirective
} from "@noldova/teamrun-shell-ui";

import { Resources } from "../../../resources";
import type { DockSide } from "../../enums/dock-side";
import type { GroupFrame } from "../../models/layout/group-frame";
import type { Tab } from "../../models/layout/tab";
import type { TabGroup } from "../../models/layout/tab-group";
import { CommandService } from "../../services/command.service";
import { LayoutService } from "../../services/layout.service";
import { TabDragService } from "../../services/tab-drag.service";
import { TabLabelService } from "../../services/tab-label.service";
import { TabStripService } from "../../services/tab-strip.service";
import { TabMenuComponent } from "../tab-menu/tab-menu.component";
import { TabScrollerDirective } from "./tab-scroller.directive";

@Component({
  selector: "tr-tab-group",
  imports: [
    ContextMenuTriggerDirective, IconButtonComponent, MenuComponent, MenuItemComponent, MenuSeparatorComponent, MenuTriggerDirective, PanelCardComponent, TabComponent,
    TabMenuComponent, TabScrollerDirective, TooltipDirective
  ],
  templateUrl: "./tab-group.component.html",
  styleUrl: "./tab-group.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[attr.data-group]": "group().id",
    "[attr.data-side]": "frame().side",
    "[style.left.rem]": "frame().bounds.x",
    "[style.top.rem]": "frame().bounds.y",
    "[style.width.rem]": "frame().bounds.width",
    "[style.height.rem]": "frame().bounds.height",
    "(focusin)": "layout.focusGroup(group().id)"
  }
})
export class TabGroupComponent {
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly environment: EnvironmentInjector = inject(EnvironmentInjector);
  private readonly commands: CommandService = inject(CommandService);
  private readonly scroller: Signal<TabScrollerDirective> = viewChild.required(TabScrollerDirective);
  private readonly overflowTrigger: Signal<MenuTriggerDirective | undefined> = viewChild("overflowTrigger", { read: MenuTriggerDirective });

  protected readonly resources: typeof Resources = Resources;
  protected readonly below: OverlaySide = OverlaySide.below;
  protected readonly besides: OverlaySide = OverlaySide.end;
  protected readonly end: OverlayAlignment = OverlayAlignment.End;
  protected readonly layout: LayoutService = inject(LayoutService);
  protected readonly drag: TabDragService = inject(TabDragService);
  protected readonly labels: TabLabelService = inject(TabLabelService);
  protected readonly group: Signal<TabGroup> = computed(() => this.frame().group);
  protected readonly surface: Signal<PanelSurface> = computed(() => Object.isNull(this.frame().side) ? PanelSurface.Panel : PanelSurface.Shell);
  protected readonly isShell: Signal<boolean> = computed(() => this.surface() === PanelSurface.Shell);
  protected readonly panelId: Signal<string> = computed(() => `${Resources.tabPanelIdPrefix}${this.group().id}`);
  protected readonly activeTabId: Signal<string | null> = computed(() => {
    const index = this.group().tabs.findIndex(t => t.equals(this.group().active));
    return index < 0 ? null : this.tabId(index);
  });
  protected readonly hideSide: Signal<DockSide | null> = computed(() => {
    const side = this.frame().side;
    return !Object.isNull(side) && this.layout.layout().dock(side).root?.cornerGroup.id === this.group().id ? side : null;
  });

  public readonly frame = input.required<GroupFrame>();

  public constructor() {
    const strips = inject(TabStripService);
    effect(() => strips.setOverflowing(this.group().id, this.scroller().isOverflowing()));
    effect(() => {
      const trigger = this.overflowTrigger();
      if (!Object.isUndefined(trigger) && strips.takeListRequest(this.group().id)) {
        trigger.open();
        trigger.getMenu()?.focusFirstItem(Resources.keyboardFocusOrigin);
      }
    });
    inject(DestroyRef).onDestroy(() => strips.setOverflowing(this.group().id, false));
  }

  protected tabId(index: number): string {
    return `${Resources.tabIdPrefix}${this.group().id}${Resources.tabIdSeparator}${index}`;
  }

  protected choose(tab: Tab): void {
    this.layout.activate(tab);
    afterNextRender(() => {
      for (const element of this.host.querySelectorAll<HTMLElement>(Resources.tabKeySelector))
        if (element.dataset[Resources.tabKeyData] === tab.key)
          element.focus();
    }, { injector: this.environment });
  }

  protected keep(tab: Tab): void {
    this.commands.run(Resources.keepTabCommand, { [Resources.tabArgument]: tab.key });
  }

  protected closeAll(): void {
    this.layout.closeTabs(this.group().tabs);
  }

  protected onStripKey(event: KeyboardEvent): void {
    const tabs = this.group().tabs;
    const current = tabs.findIndex(t => t.equals(this.group().active));
    const key = event.ctrlKey || event.metaKey || event.altKey ? String.empty : event.key;
    const tab = tabs[this.indexFor(key, current, tabs.length)];
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
