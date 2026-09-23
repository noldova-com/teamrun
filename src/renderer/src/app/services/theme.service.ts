/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DOCUMENT } from "@angular/common";
import { Injectable, type Signal, type WritableSignal, computed, effect, inject, signal } from "@angular/core";

import "@noldova/teamrun-foundation-core";

import { Theme } from "../models/theme";
import { Resources } from "../resources";
import darkModern from "../themes/dark-modern.json";
import lightModern from "../themes/light-modern.json";
import { PreferencesService } from "./preferences.service";

@Injectable({ providedIn: "root" })
export class ThemeService {
  private readonly document: Document = inject(DOCUMENT);
  private readonly preferences: PreferencesService = inject(PreferencesService);
  private readonly darkDefault: Theme = ThemeService.builtIn(Resources.darkModernThemeId, darkModern);
  private readonly lightDefault: Theme = ThemeService.builtIn(Resources.lightModernThemeId, lightModern);
  private readonly systemScheme: MediaQueryList | null = ThemeService.watchSystemScheme(this.document.defaultView);
  private readonly systemDark: WritableSignal<boolean> = signal(this.systemScheme?.matches ?? true);

  public readonly themes: readonly Theme[] = [this.darkDefault, this.lightDefault];
  public readonly active: Signal<Theme> = computed(() => this.resolve(this.preferences.theme(), this.systemDark()));
  public readonly dark: Signal<boolean> = computed(() => this.active().dark);

  public constructor() {
    effect(() => this.apply(this.active()));
    this.systemScheme?.addEventListener(Resources.changeEvent, event => this.systemDark.set(event.matches));
  }

  private static builtIn(id: string, value: unknown): Theme {
    const theme = Theme.fromJson(id, value);
    if (Object.isNull(theme))
      throw new TypeError(Resources.formatThemeUnreadable(id));

    return theme;
  }

  private static watchSystemScheme(view: Window | null): MediaQueryList | null {
    return Object.isNull(view) || !Object.isFunction(view.matchMedia) ? null : view.matchMedia(Resources.darkSchemeQuery);
  }

  private resolve(id: string, systemDark: boolean): Theme {
    const chosen = this.themes.find(t => t.id === id);
    if (!Object.isUndefined(chosen))
      return chosen;

    return systemDark ? this.darkDefault : this.lightDefault;
  }

  public paint(theme: Theme, style: CSSStyleDeclaration): void {
    style.colorScheme = theme.dark ? Resources.darkScheme : Resources.lightScheme;
    for (const token of Resources.themeTokens) {
      const color = token.resolve(theme);
      if (Object.isNull(color))
        style.removeProperty(token.variable);
      else
        style.setProperty(token.variable, color);
    }
  }

  private apply(theme: Theme): void {
    this.paint(theme, this.document.documentElement.style);
  }
}
