/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DestroyRef, Directive, ElementRef, effect, inject, input } from "@angular/core";

import { ThemeMode } from "../../enums/theme-mode";
import type { Theme } from "../../models/theme";
import { ThemePainter } from "../../services/theme-painter";
import { DefaultTheme } from "../../models/default-theme";
import { GalleryResources } from "./gallery-resources";

@Directive({
  selector: "[trGalleryScope]",
  host: {
    "[class]": "scopeClass"
  }
})
export class GalleryScopeDirective {
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly painter: ThemePainter = new ThemePainter(DefaultTheme.theme);

  protected readonly scopeClass: string = GalleryResources.scopeClass;

  public readonly theme = input.required<Theme>({ alias: "trGalleryScope" });
  public readonly mode = input.required<ThemeMode>({ alias: "trGalleryMode" });

  public constructor() {
    effect(() => this.painter.paint(this.host, this.theme(), this.mode()));
    inject(DestroyRef).onDestroy(() => this.painter.erase(this.host));
  }
}
