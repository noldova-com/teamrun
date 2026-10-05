/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type Signal, computed, inject, input } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import {
  AppearanceService, ContextMenuTriggerDirective, IconButtonComponent, OverlaySide, PanelCardComponent, PanelSurface, SashComponent, SashOrientation, ToolbarDirective, ToolbarItemDirective, ToolbarOrientation,
  TooltipDirective, ViewBadgeComponent
} from "@noldova/teamrun-shell-ui";

import { Resources } from "../../../resources";
import { DockSide } from "../../enums/dock-side";
import { Bounds } from "../../models/layout/bounds";
import type { Dock } from "../../models/layout/dock";
import type { LayoutNode } from "../../models/layout/layout.node";
import { DockStripIcon } from "../../models/layout/dock-strip-icon";
import type { Tab } from "../../models/layout/tab";
import { TabDropTarget } from "../../models/layout/tab-drop-target";
import type { TabGroup } from "../../models/layout/tab-group";
import { LayoutService } from "../../services/layout.service";
import { TabDragService } from "../../services/tab-drag.service";
import { TabLabelService } from "../../services/tab-label.service";
import { PlaceMenuComponent } from "../place-menu/place-menu.component";

@Component({
  selector: "tr-dock",
  imports: [ContextMenuTriggerDirective, IconButtonComponent, PanelCardComponent, PlaceMenuComponent, SashComponent, ToolbarDirective, ToolbarItemDirective, TooltipDirective, ViewBadgeComponent],
  templateUrl: "./dock.component.html",
  styleUrl: "./dock.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[attr.data-side]": "side()",
    "[class.tr-dock-collapsed]": "isCollapsed()"
  }
})
export class DockComponent {
  private readonly appearance: AppearanceService = inject(AppearanceService);

  protected readonly resources: typeof Resources = Resources;
  protected readonly surface: PanelSurface = PanelSurface.Shell;
  protected readonly layout: LayoutService = inject(LayoutService);
  protected readonly labels: TabLabelService = inject(TabLabelService);
  protected readonly drag: TabDragService = inject(TabDragService);
  protected readonly dock: Signal<Dock> = computed(() => this.layout.layout().dock(this.side()));
  protected readonly bounds: Signal<Bounds> = computed(() => this.layout.geometry().dock(this.side()));
  protected readonly isShown: Signal<boolean> = computed(() => this.layout.geometry().isShown(this.side()));
  protected readonly isCollapsed: Signal<boolean> = computed(() => this.layout.geometry().isCollapsed(this.side()));
  protected readonly orientation: Signal<SashOrientation> = computed(() => this.side() === DockSide.Bottom ? SashOrientation.Horizontal : SashOrientation.Vertical);
  protected readonly size: Signal<number> = computed(() => this.dock().size ?? this.bounds().length(this.dock().axis));
  protected readonly isVertical: Signal<boolean> = computed(() => this.side() !== DockSide.Bottom);
  protected readonly tooltipSide: Signal<OverlaySide> = computed(() => Resources.dockStripTooltipSides[this.side()]);
  protected readonly isRail: Signal<boolean> = computed(() => !Object.isNull(this.layout.geometry().rail(this.side())));
  protected readonly stripBounds: Signal<Bounds | null> = computed(() => this.layout.geometry().rail(this.side()) ?? (this.isCollapsed() ? this.bounds() : null));
  protected readonly stripOrientation: Signal<ToolbarOrientation> = computed(() => this.isVertical() ? ToolbarOrientation.Vertical : ToolbarOrientation.Horizontal);
  protected readonly axis: Signal<string> = computed(() => this.isVertical() ? Resources.verticalOrientation : Resources.horizontalOrientation);
  protected readonly separatorOrientation: Signal<string> = computed(() => this.isVertical() ? Resources.horizontalOrientation : Resources.verticalOrientation);
  protected readonly sash: Signal<Bounds> = computed(() => {
    const bounds = this.bounds();
    const gap = Resources.panelGap;
    switch (this.side()) {
      case DockSide.Left:
        return new Bounds(bounds.right, bounds.y, gap, bounds.height);
      case DockSide.Right:
        return new Bounds(bounds.x - gap, bounds.y, gap, bounds.height);
      default:
        return new Bounds(bounds.x, bounds.y - gap, bounds.width, gap);
    }
  });

  public readonly side = input.required<DockSide>();

  protected iconsOf(root: LayoutNode): readonly (readonly DockStripIcon[])[] {
    const groups = root.groups.map(t => [t, t.tabs.filter(u => u.isAvailable(this.layout.registry()))] as const).filter(([, tabs]) => tabs.length > 0);
    return groups.map(([group, tabs], position) => tabs.map((tab, order) => {
      const index = group.tabs.findIndex(t => t.equals(tab));
      const previous = order === 0 ? groups[position - 1]?.[0] : undefined;
      const before = Object.isUndefined(previous) ? new TabDropTarget(group.id, index) : new TabDropTarget(previous.id, previous.tabs.length);
      return new DockStripIcon(group, tab, before, new TabDropTarget(group.id, index + 1));
    }));
  }

  protected encode(target: TabDropTarget): string {
    return `${target.groupId}${Resources.dropTargetSeparator}${target.index}`;
  }

  protected isShowing(group: TabGroup, tab: Tab): boolean {
    return !this.isCollapsed() && tab.equals(group.active);
  }

  protected toggle(group: TabGroup, tab: Tab): void {
    if (this.isShowing(group, tab))
      this.layout.toggleDock(this.side());
    else {
      this.layout.activate(tab);
      this.layout.keepOpen(this.side());
    }
  }

  protected pixels(rem: number): number {
    return Math.round(rem * this.appearance.typography().rootSize);
  }

  protected resize(delta: number): void {
    const rem = delta / this.appearance.typography().rootSize;
    const grow = this.side() === DockSide.Left ? rem : -rem;
    const size = Math.max(this.dock().minimumSize, Math.min(this.layout.geometry().maximumSize(this.side()), this.size() + grow));
    this.layout.resizeDock(this.side(), size);
  }
}
