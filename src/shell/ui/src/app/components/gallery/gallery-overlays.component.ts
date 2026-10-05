/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, Injector, type WritableSignal, inject, signal } from "@angular/core";

import { ButtonVariant } from "../../enums/button-variant";
import { DialogSize } from "../../enums/dialog-size";
import { DockingDirection } from "../../enums/docking-direction";
import { GallerySize } from "../../enums/gallery-size";
import { DialogTokens } from "../../models/dialog-tokens";
import { OverlaySide } from "../../models/overlay-side";
import { QueryMatcher } from "../../models/query-matcher";
import { QuickInputItem } from "../../models/quick-input-item";
import { ButtonComponent } from "../button/button.component";
import { DialogComponent } from "../dialog/dialog.component";
import { DockingGuideComponent } from "../docking-guide/docking-guide.component";
import { DockingPlateComponent } from "../docking-plate/docking-plate.component";
import { ContextMenuTriggerDirective } from "../menu/context-menu-trigger.directive";
import { MenuItemComponent } from "../menu/menu-item.component";
import { MenuSeparatorComponent } from "../menu/menu-separator.component";
import { MenuTriggerDirective } from "../menu/menu-trigger.directive";
import { MenuComponent } from "../menu/menu.component";
import { MenuBarItemComponent } from "../menu-bar/menu-bar-item.component";
import { MenuBarComponent } from "../menu-bar/menu-bar.component";
import { PopoverDirective } from "../popover/popover.directive";
import { PopoverTriggerDirective } from "../popover/popover-trigger.directive";
import { QuickInputComponent } from "../quick-input/quick-input.component";
import { TooltipComponent } from "../tooltip/tooltip.component";
import { TooltipDirective } from "../tooltip/tooltip.directive";
import { GalleryCellComponent } from "./gallery-cell.component";
import { GalleryResources } from "./gallery-resources";
import { GallerySpecimenComponent } from "./gallery-specimen.component";
import { GalleryStateDirective } from "./gallery-state.directive";

@Component({
  selector: "tr-gallery-overlays",
  imports: [
    ButtonComponent, ContextMenuTriggerDirective, DialogComponent, DockingGuideComponent, DockingPlateComponent, GalleryCellComponent, GallerySpecimenComponent, GalleryStateDirective, MenuBarComponent, MenuBarItemComponent,
    MenuComponent, MenuItemComponent, MenuSeparatorComponent, MenuTriggerDirective, NgTemplateOutlet, PopoverDirective, PopoverTriggerDirective, QuickInputComponent, TooltipComponent, TooltipDirective
  ],
  templateUrl: "./gallery-overlays.component.html",
  styleUrl: "./gallery-overlays.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GalleryOverlaysComponent {
  private static count: number = 0;

  private readonly injector: Injector = inject(Injector);

  protected readonly text: typeof GalleryResources.text = GalleryResources.text;
  protected readonly dialogInjector: Injector = this.createDialogInjector();
  protected readonly largeDialogInjector: Injector = this.createDialogInjector();
  protected readonly sizes: typeof GallerySize = GallerySize;
  protected readonly dialogSizes: typeof DialogSize = DialogSize;
  protected readonly variants: typeof ButtonVariant = ButtonVariant;
  protected readonly directions: typeof DockingDirection = DockingDirection;
  protected readonly below: OverlaySide = OverlaySide.below;
  protected readonly isChecked: WritableSignal<boolean> = signal(true);
  protected readonly items: readonly QuickInputItem[] = [
    new QuickInputItem("one", GalleryResources.text.quickInputOne, GalleryResources.text.glyphAdd, GalleryResources.text.quickInputDetail, GalleryResources.text.quickInputKey,
      QueryMatcher.find(GalleryResources.text.quickInputQuery, GalleryResources.text.quickInputOne)),
    new QuickInputItem("two", GalleryResources.text.quickInputTwo, null, null, null, QueryMatcher.find(GalleryResources.text.quickInputQuery, GalleryResources.text.quickInputTwo)),
    new QuickInputItem("three", GalleryResources.text.quickInputLong, GalleryResources.text.glyphSave, GalleryResources.text.quickInputDetail, null,
      QueryMatcher.find(GalleryResources.text.quickInputQuery, GalleryResources.text.quickInputLong))
  ];

  private createDialogInjector(): Injector {
    return Injector.create({
      providers: [{ provide: DialogTokens.titleId, useValue: `${GalleryResources.dialogTitleIdPrefix}${GalleryOverlaysComponent.count++}` }],
      parent: this.injector
    });
  }
}
