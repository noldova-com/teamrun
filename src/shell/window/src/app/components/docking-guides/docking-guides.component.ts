/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type Signal, computed, inject } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import { DockingDirection, DockingGuideComponent, DockingPlateComponent } from "@noldova/teamrun-shell-ui";

import { Resources } from "../../../resources";
import { BottomDockSpan } from "../../enums/bottom-dock-span";
import { DockSide } from "../../enums/dock-side";
import type { Bounds } from "../../models/layout/bounds";
import { DockingOverlay } from "../../models/layout/docking-overlay";
import { GroupDropTarget } from "../../models/layout/group-drop-target";
import type { GroupFrame } from "../../models/layout/group-frame";
import { SideDropTarget } from "../../models/layout/side-drop-target";
import { SplitDropTarget } from "../../models/layout/split-drop-target";
import { LayoutService } from "../../services/layout.service";
import { TabDragService } from "../../services/tab-drag.service";
import { TabLabelService } from "../../services/tab-label.service";

@Component({
  selector: "tr-docking-guides",
  imports: [DockingGuideComponent, DockingPlateComponent],
  templateUrl: "./docking-guides.component.html",
  styleUrl: "./docking-guides.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DockingGuidesComponent {
  private readonly layout: LayoutService = inject(LayoutService);

  protected readonly resources: typeof Resources = Resources;
  protected readonly drag: TabDragService = inject(TabDragService);
  protected readonly labels: TabLabelService = inject(TabLabelService);
  protected readonly sides: readonly DockSide[] = Object.values(DockSide);
  protected readonly overlay: Signal<DockingOverlay> = computed(() => new DockingOverlay(this.layout.geometry()));
  protected readonly preview: Signal<Bounds | null> = computed(() => this.drag.target()?.preview(this.layout.geometry()) ?? null);
  protected readonly plateFrame: Signal<GroupFrame | null> = computed(() => {
    const tab = this.drag.dragging();
    const id = this.drag.hoveredGroup();
    const frame = Object.isNull(id) ? null : this.layout.geometry().frameOf(id);
    if (Object.isNull(tab) || Object.isNull(frame) || !this.layout.layout().canSplit(tab, frame.group.id))
      return null;
    return frame;
  });

  protected readonly outerTarget: SideDropTarget = new SideDropTarget(DockSide.Bottom, BottomDockSpan.Full);

  protected targetOf(side: DockSide): SideDropTarget {
    return new SideDropTarget(side, side === DockSide.Bottom ? BottomDockSpan.Between : null);
  }

  protected isChosen(target: SideDropTarget): boolean {
    return target.equals(this.drag.target());
  }

  protected plateChoice(frame: GroupFrame): DockingDirection | null {
    const target = this.drag.target();
    if (target instanceof SplitDropTarget)
      return Resources.edgeDirections[target.edge];
    return new GroupDropTarget(frame.group.id).equals(target) ? DockingDirection.Center : null;
  }
}
