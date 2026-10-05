/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type Signal, computed, contentChildren, input } from "@angular/core";

import { GallerySize } from "../../enums/gallery-size";
import { GalleryCellComponent } from "./gallery-cell.component";

@Component({
  selector: "tr-gallery-specimen",
  templateUrl: "./gallery-specimen.component.html",
  styleUrl: "./gallery-specimen.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GallerySpecimenComponent {
  private readonly cells: Signal<readonly GalleryCellComponent[]> = contentChildren(GalleryCellComponent);

  protected readonly hasLongText: Signal<boolean> = computed(() => this.cells().some(t => t.isLong));

  public readonly name = input.required<string>();
  public readonly size = input<GallerySize>(GallerySize.Regular);
}
