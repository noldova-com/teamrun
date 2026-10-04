/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, input } from "@angular/core";

@Component({
  selector: "tr-gallery-specimen",
  templateUrl: "./gallery-specimen.component.html",
  styleUrl: "./gallery-specimen.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GallerySpecimenComponent {
  public readonly name = input.required<string>();
}
