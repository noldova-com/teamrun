/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component } from "@angular/core";

import { GallerySize } from "../../enums/gallery-size";
import { CardComponent } from "../card/card.component";
import { CodeBlockComponent } from "../code-block/code-block.component";
import { InlineCodeComponent } from "../inline-code/inline-code.component";
import { GalleryCellComponent } from "./gallery-cell.component";
import { GalleryRefusingClipboardDirective } from "./gallery-refusing-clipboard.directive";
import { GalleryResources } from "./gallery-resources";
import { GallerySpecimenComponent } from "./gallery-specimen.component";
import { GalleryStateDirective } from "./gallery-state.directive";

@Component({
  selector: "tr-gallery-content",
  imports: [CardComponent, CodeBlockComponent, GalleryCellComponent, GalleryRefusingClipboardDirective, GallerySpecimenComponent, GalleryStateDirective, InlineCodeComponent],
  templateUrl: "./gallery-content.component.html",
  styleUrl: "./gallery-content.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GalleryContentComponent {
  protected readonly text: typeof GalleryResources.text = GalleryResources.text;
  protected readonly sizes: typeof GallerySize = GallerySize;
}
