/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Directive, ElementRef, afterNextRender, inject, input } from "@angular/core";

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
      this.mark(this.hoverPart(), GalleryResources.hoverState);
      this.mark(this.focusPart(), GalleryResources.focusState);
    });
  }

  private mark(part: string | undefined, state: string): void {
    if (part === undefined)
      return;
    const target = part === "" ? this.host : this.host.querySelector(part);
    target?.setAttribute(GalleryResources.stateAttribute, state);
  }
}
