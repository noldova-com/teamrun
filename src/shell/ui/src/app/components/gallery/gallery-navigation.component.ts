/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component } from "@angular/core";

import { GallerySize } from "../../enums/gallery-size";
import { PanelSurface } from "../../enums/panel-surface";
import { SashOrientation } from "../../enums/sash-orientation";
import { IconButtonComponent } from "../icon-button/icon-button.component";
import { PanelCardComponent } from "../panel-card/panel-card.component";
import { SashComponent } from "../sash/sash.component";
import { TabComponent } from "../tab/tab.component";
import { ToolbarButtonComponent } from "../toolbar-button/toolbar-button.component";
import { ToolbarItemDirective } from "../toolbar/toolbar-item.directive";
import { ToolbarDirective } from "../toolbar/toolbar.directive";
import { ViewBadgeComponent } from "../view-badge/view-badge.component";
import { GalleryResources } from "./gallery-resources";
import { GalleryCellComponent } from "./gallery-cell.component";
import { GalleryHoverDirective } from "./gallery-hover.directive";
import { GallerySpecimenComponent } from "./gallery-specimen.component";

@Component({
  selector: "tr-gallery-navigation",
  imports: [GalleryCellComponent, GalleryHoverDirective, GallerySpecimenComponent, IconButtonComponent, PanelCardComponent, SashComponent, TabComponent, ToolbarButtonComponent, ToolbarDirective, ToolbarItemDirective, ViewBadgeComponent],
  templateUrl: "./gallery-navigation.component.html",
  styleUrl: "./gallery-navigation.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GalleryNavigationComponent {
  protected readonly text: typeof GalleryResources.text = GalleryResources.text;
  protected readonly sizes: typeof GallerySize = GallerySize;
  protected readonly surfaces: typeof PanelSurface = PanelSurface;
  protected readonly orientations: typeof SashOrientation = SashOrientation;
}
