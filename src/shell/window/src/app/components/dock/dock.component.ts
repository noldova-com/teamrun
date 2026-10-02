/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type Signal, computed, inject, input } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import { AppearanceService, IconButtonComponent, PanelCardComponent, PanelSurface, SashComponent, SashOrientation } from "@noldova/teamrun-shell-ui";

import { Resources } from "../../../resources";
import { DockSide } from "../../enums/dock-side";
import { Bounds } from "../../models/layout/bounds";
import type { Dock } from "../../models/layout/dock";
import type { LayoutNode } from "../../models/layout/layout.node";
import type { Tab } from "../../models/layout/tab";
import { LayoutService } from "../../services/layout.service";
import { TabLabelService } from "../../services/tab-label.service";

@Component({
  selector: "tr-dock",
  imports: [IconButtonComponent, PanelCardComponent, SashComponent],
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
  protected readonly dock: Signal<Dock> = computed(() => this.layout.layout().dock(this.side()));
  protected readonly bounds: Signal<Bounds> = computed(() => this.layout.geometry().dock(this.side()));
  protected readonly isShown: Signal<boolean> = computed(() => this.layout.geometry().isShown(this.side()));
  protected readonly isCollapsed: Signal<boolean> = computed(() => this.layout.geometry().isCollapsed(this.side()));
  protected readonly orientation: Signal<SashOrientation> = computed(() => this.side() === DockSide.Bottom ? SashOrientation.Horizontal : SashOrientation.Vertical);
  protected readonly size: Signal<number> = computed(() => this.dock().size ?? this.bounds().length(this.dock().axis));
  protected readonly isVertical: Signal<boolean> = computed(() => this.side() !== DockSide.Bottom);
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

  protected tabsOf(root: LayoutNode): readonly Tab[] {
    return root.groups.flatMap(t => t.tabs).filter(t => t.isAvailable(this.layout.registry()));
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
