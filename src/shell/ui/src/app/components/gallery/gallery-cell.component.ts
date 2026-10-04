/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, ElementRef, HostAttributeToken, inject, input } from "@angular/core";

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
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  public readonly isLong: boolean = inject(new HostAttributeToken(GalleryResources.longAttribute), { optional: true }) !== null;
  public readonly caption = input.required<string>();
  public readonly isFocusTarget = input<boolean>(false);

  public focus(): void {
    this.host.querySelector<HTMLElement>(GalleryResources.focusableSelector)?.focus();
  }
}
