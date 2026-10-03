/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DOCUMENT } from "@angular/common";
import { DestroyRef, Injectable, type Signal, type WritableSignal, computed, effect, inject, signal } from "@angular/core";

import { ModePreference } from "../enums/mode-preference";
import { ThemeMode } from "../enums/theme-mode";
import type { Theme } from "../models/theme";
import { Typography } from "../models/typography";
import { DefaultTheme } from "../themes/default-theme";
import { Resources } from "../../resources";
import { ThemePainter } from "./theme-painter";
import { TypographyPainter } from "./typography-painter";

@Injectable({ providedIn: "root" })
export class AppearanceService {
  private readonly root: HTMLElement = inject(DOCUMENT).documentElement;
  private readonly painter: ThemePainter = new ThemePainter(DefaultTheme.theme);
  private readonly systemScheme: MediaQueryList = matchMedia(Resources.darkSchemeQuery);
  private readonly isSystemDark: WritableSignal<boolean> = signal(this.systemScheme.matches);
  private readonly themeState: WritableSignal<Theme> = signal(DefaultTheme.theme);
  private readonly preferenceState: WritableSignal<ModePreference> = signal(ModePreference.System);
  private readonly typographyState: WritableSignal<Typography> = signal(new Typography());

  public readonly theme: Signal<Theme> = this.themeState.asReadonly();
  public readonly modePreference: Signal<ModePreference> = this.preferenceState.asReadonly();
  public readonly typography: Signal<Typography> = this.typographyState.asReadonly();
  public readonly mode: Signal<ThemeMode> = computed(() => this.resolveMode(this.preferenceState(), this.isSystemDark()));

  public constructor() {
    const listener = (event: MediaQueryListEvent): void => this.isSystemDark.set(event.matches);
    this.systemScheme.addEventListener(Resources.changeEvent, listener);
    inject(DestroyRef).onDestroy(() => {
      this.systemScheme.removeEventListener(Resources.changeEvent, listener);
      this.painter.erase(this.root);
      TypographyPainter.erase(this.root);
    });
    effect(() => this.painter.paint(this.root, this.themeState(), this.mode()));
    effect(() => TypographyPainter.paint(this.root, this.typographyState()));
  }

  public setTheme(theme: Theme): void {
    this.themeState.set(theme);
  }

  public setModePreference(preference: ModePreference): void {
    this.preferenceState.set(preference);
  }

  public setTypography(typography: Typography): void {
    this.typographyState.set(typography);
  }

  private resolveMode(preference: ModePreference, isSystemDark: boolean): ThemeMode {
    if (preference === ModePreference.System)
      return isSystemDark ? ThemeMode.Dark : ThemeMode.Light;
    return preference === ModePreference.Dark ? ThemeMode.Dark : ThemeMode.Light;
  }
}
