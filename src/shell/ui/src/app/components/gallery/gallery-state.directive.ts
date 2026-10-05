/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Directive, ElementRef, afterNextRender, inject, input } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { GalleryState } from "../../enums/gallery-state";
import { GalleryResources } from "./gallery-resources";

@Directive({
  selector: "[trGalleryHover], [trGalleryFocus]"
})
export class GalleryStateDirective {
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  public readonly hoverPart = input<string | undefined>(undefined, { alias: "trGalleryHover" });
  public readonly focusPart = input<string | undefined>(undefined, { alias: "trGalleryFocus" });

  public constructor() {
    afterNextRender(() => {
      this.mark(this.hoverPart(), GalleryState.Hover);
      this.mark(this.focusPart(), GalleryState.Focus);
    });
  }

  private mark(part: string | undefined, state: GalleryState): void {
    if (Object.isUndefined(part))
      return;
    const target = String.isNullOrEmpty(part) ? this.host : this.host.querySelector(part);
    if (Object.isNull(target))
      throw new ArgumentException(GalleryResources.formatMissingPart(part), "part");
    target.setAttribute(GalleryResources.stateAttribute, state);
  }
}
