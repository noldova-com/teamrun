/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Directive, ElementRef, effect, inject, input } from "@angular/core";

import { Theme } from "../models/theme";
import { ThemeService } from "../services/theme.service";

@Directive({ selector: "[trThemeScope]", host: { class: "tr-theme-scope" } })
export class ThemeScopeDirective {
  private readonly element: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly themes: ThemeService = inject(ThemeService);

  public readonly theme = input.required<Theme>({ alias: "trThemeScope" });

  public constructor() {
    effect(() => this.themes.paint(this.theme(), this.element.nativeElement.style));
  }
}
