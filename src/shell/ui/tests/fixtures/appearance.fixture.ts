/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ThemeMode } from "../../src/app/enums/theme-mode";
import type { Theme } from "../../src/app/models/theme";
import { Typography } from "../../src/app/models/typography";
import { ThemePainter } from "../../src/app/services/theme-painter";
import { TypographyPainter } from "../../src/app/services/typography-painter";
import { DefaultTheme } from "../../src/app/themes/default-theme";
import { FixtureTheme } from "./fixture-theme";

export class AppearanceFixture {
  private static readonly ROOT_SIZE: number = 16;
  private static readonly PANEL_SIZE: number = 13;
  private static readonly SHAPE_ATTRIBUTE: string = "data-tr-tab-shape";
  private static readonly LAYOUT_TOLERANCE: number = 1 / 32;
  private static readonly PIXEL_LENGTH: RegExp = /^-?[\d.]+px$/;

  public static readonly modes: readonly ThemeMode[] = [ThemeMode.Light, ThemeMode.Dark];
  public static readonly themes: readonly Theme[] = [DefaultTheme.theme, FixtureTheme.theme];
  public static readonly panelSizes: readonly number[] = [12, 13, 14, 15, 16, 17, 18];

  public static apply(theme: Theme = DefaultTheme.theme, mode: ThemeMode = ThemeMode.Light, panelSize: number = AppearanceFixture.PANEL_SIZE): void {
    const root = document.documentElement;
    new ThemePainter(DefaultTheme.theme).paint(root, theme, mode);
    TypographyPainter.paint(root, new Typography(panelSize));
  }

  public static reset(): void {
    const root = document.documentElement;
    root.removeAttribute("style");
    root.removeAttribute(AppearanceFixture.SHAPE_ATTRIBUTE);
  }

  public static toPixels(rem: number, panelSize: number = AppearanceFixture.PANEL_SIZE): number {
    return rem * AppearanceFixture.ROOT_SIZE * panelSize / AppearanceFixture.PANEL_SIZE;
  }

  public static expectPixels(actual: number, expected: number): void {
    expect(Math.abs(actual - expected)).toBeLessThan(AppearanceFixture.LAYOUT_TOLERANCE);
  }

  public static expectRem(actual: string, rem: number, panelSize: number = AppearanceFixture.PANEL_SIZE): void {
    expect(actual.endsWith("px")).toBe(true);
    AppearanceFixture.expectPixels(Number.parseFloat(actual), AppearanceFixture.toPixels(rem, panelSize));
  }

  public static expectLook(actual: string, theme: Theme, name: string, property: string, shorthand: string = property): void {
    const value = theme.readLook(name);
    if (value === undefined)
      throw new Error(`The theme ${theme.id} has no ${name} value.`);
    const probe = document.createElement("div");
    probe.style.borderStyle = "solid";
    probe.style.setProperty(shorthand, value);
    document.body.append(probe);
    const resolved = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    if (AppearanceFixture.PIXEL_LENGTH.test(resolved) && AppearanceFixture.PIXEL_LENGTH.test(actual))
      AppearanceFixture.expectPixels(Number.parseFloat(actual), Number.parseFloat(resolved));
    else
      expect(actual).toBe(resolved);
  }

  public static readColor(theme: Theme, mode: ThemeMode, key: string): string {
    const color = theme.readColor(mode, key);
    if (color === undefined)
      throw new Error(`The theme ${theme.id} has no ${key} color.`);
    const red = Number.parseInt(color.slice(1, 3), 16);
    const green = Number.parseInt(color.slice(3, 5), 16);
    const blue = Number.parseInt(color.slice(5, 7), 16);
    return `rgb(${red}, ${green}, ${blue})`;
  }

  public static contrast(foreground: string, background: string): number {
    const luminance = (color: string): number => {
      const [red = 0, green = 0, blue = 0] = (color.match(/\d+(\.\d+)?/gu) ?? []).slice(0, 3).map(t => Number(t) / 255)
        .map(t => t <= 0.03928 ? t / 12.92 : ((t + 0.055) / 1.055) ** 2.4);
      return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    };
    const [lighter = 0, darker = 0] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    return (lighter + 0.05) / (darker + 0.05);
  }
}
