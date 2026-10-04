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
  selector: "[trGalleryHover]"
})
export class GalleryHoverDirective {
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  public readonly part = input<string>("", { alias: "trGalleryHover" });

  public constructor() {
    afterNextRender(() => {
      const target = this.part() === "" ? this.host : this.host.querySelector(this.part());
      target?.setAttribute(GalleryResources.stateAttribute, GalleryResources.hoverState);
    });
  }
}
