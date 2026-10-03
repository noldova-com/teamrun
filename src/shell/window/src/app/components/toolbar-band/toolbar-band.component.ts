/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import { ContextMenuTriggerDirective } from "@noldova/teamrun-shell-ui";

import { Resources } from "../../../resources";
import type { Toolbar } from "../../models/toolbar";
import { ToolbarDragService } from "../../services/toolbar-drag.service";
import { ToolbarService } from "../../services/toolbar.service";
import { PlaceMenuComponent } from "../place-menu/place-menu.component";
import { ToolbarComponent } from "../toolbar/toolbar.component";

@Component({
  selector: "tr-toolbar-band",
  imports: [ContextMenuTriggerDirective, NgTemplateOutlet, PlaceMenuComponent, ToolbarComponent],
  templateUrl: "./toolbar-band.component.html",
  styleUrl: "./toolbar-band.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ToolbarBandComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly toolbars: ToolbarService = inject(ToolbarService);
  protected readonly drag: ToolbarDragService = inject(ToolbarDragService);

  protected hasContent(row: readonly Toolbar[]): boolean {
    return row.some(t => t.sections.length > 0);
  }
}
