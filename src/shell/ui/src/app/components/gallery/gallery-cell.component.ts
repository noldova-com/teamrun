/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, HostAttributeToken, inject, input } from "@angular/core";

import "@noldova/teamrun-foundation-core";

import { GalleryResources } from "./gallery-resources";

@Component({
  selector: "tr-gallery-cell",
  templateUrl: "./gallery-cell.component.html",
  styleUrl: "./gallery-cell.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "role": "group",
    "[attr.aria-label]": "caption()"
  }
})
export class GalleryCellComponent {
  public readonly isLong: boolean = !Object.isNull(inject(new HostAttributeToken(GalleryResources.longAttribute), { optional: true }));
  public readonly caption = input.required<string>();
}
