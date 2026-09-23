/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type InputSignal, type Signal, computed, inject, input } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatTooltipModule, type TooltipPosition } from "@angular/material/tooltip";

import "@noldova/teamrun-foundation-core";

import { DockSide } from "../../enums/dock-side";
import { PanelEdge } from "../../enums/panel-edge";
import { PanelId } from "../../enums/panel-id";
import type { Dock } from "../../models/dock";
import { Resources } from "../../resources";
import { LayoutService } from "../../services/layout.service";
import { PanelDragService } from "../../services/panel-drag.service";
import { ShellService } from "../../services/shell.service";
import { ActivityPanelComponent } from "../activity-panel/activity-panel.component";
import { ChangesPanelComponent } from "../changes-panel/changes-panel.component";
import { ResizeHandleComponent } from "../resize-handle/resize-handle.component";
import { SidebarComponent } from "../sidebar/sidebar.component";

@Component({
  selector: "tr-dock",
  imports: [ActivityPanelComponent, ChangesPanelComponent, MatButtonModule, MatIconModule, MatTooltipModule, ResizeHandleComponent, SidebarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "relative flex min-h-0 min-w-0 flex-col", "[class.hidden]": "isEmpty()", "[attr.data-side]": "side()" },
  templateUrl: "./dock.component.html"
})
export class DockComponent {
  public readonly side: InputSignal<DockSide> = input.required<DockSide>();
  protected readonly resources: typeof Resources = Resources;
  protected readonly layout: LayoutService = inject(LayoutService);
  protected readonly drag: PanelDragService = inject(PanelDragService);
  private readonly shell: ShellService = inject(ShellService);
  protected readonly explorer: PanelId = PanelId.Explorer;
  protected readonly changes: PanelId = PanelId.Changes;
  protected readonly activity: PanelId = PanelId.Activity;
  protected readonly dock: Signal<Dock> = computed(() => this.layout.layout().dock(this.side()));
  protected readonly isEmpty: Signal<boolean> = computed(() => this.dock().panels.length === 0);
  protected readonly isVertical: Signal<boolean> = computed(() => this.side() !== DockSide.Bottom);
  protected readonly handleEdge: Signal<PanelEdge> = computed(() => Resources.dockHandleEdges[this.side()]);
  protected readonly tooltipPosition: Signal<TooltipPosition> = computed(() => Resources.dockTooltipPositions[this.side()]);

  protected close(event: globalThis.Event, panel: PanelId): void {
    event.stopPropagation();
    this.layout.closePanel(panel);
  }

  protected onTabMouseDown(event: MouseEvent): void {
    if (event.button === Resources.middleButton)
      event.preventDefault();
  }

  protected onTabAuxClick(event: MouseEvent, panel: PanelId): void {
    if (event.button !== Resources.middleButton)
      return;
    event.preventDefault();
    this.close(event, panel);
  }

  protected resize(size: number): void {
    this.layout.resizeDock(this.side(), Math.min(size, this.shell.maximumSize(this.side())));
  }
}
