/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type Signal, computed, contentChildren, input } from "@angular/core";

import { ButtonVariant } from "../../enums/button-variant";
import { GallerySize } from "../../enums/gallery-size";
import { ButtonComponent } from "../button/button.component";
import { GalleryCellComponent } from "./gallery-cell.component";
import { GalleryResources } from "./gallery-resources";

@Component({
  selector: "tr-gallery-specimen",
  imports: [ButtonComponent],
  templateUrl: "./gallery-specimen.component.html",
  styleUrl: "./gallery-specimen.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GallerySpecimenComponent {
  private readonly cells: Signal<readonly GalleryCellComponent[]> = contentChildren(GalleryCellComponent);

  protected readonly text: typeof GalleryResources.text = GalleryResources.text;
  protected readonly variants: typeof ButtonVariant = ButtonVariant;
  protected readonly focusTarget: Signal<GalleryCellComponent | undefined> = computed(() => this.cells().find(t => t.isFocusTarget()));
  protected readonly hasLongText: Signal<boolean> = computed(() => this.cells().some(t => t.isLong));
  protected readonly focusLabel: Signal<string> = computed(() => GalleryResources.formatShowFocus(this.name()));

  public readonly name = input.required<string>();
  public readonly size = input<GallerySize>(GallerySize.Regular);
}
