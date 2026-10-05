/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { userEvent } from "vitest/browser";

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
  public static readonly hiddenThumb: string = "rgba(0, 0, 0, 0)";

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

  public static expectTruncates(element: HTMLElement): void {
    const style = getComputedStyle(element);
    expect([element.hasAttribute("data-truncates"), style.minWidth, style.overflowX, style.textOverflow, style.whiteSpace, element.scrollWidth > element.clientWidth])
      .toEqual([true, "0px", "hidden", "ellipsis", "nowrap", true]);
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

  public static measureLook(name: string): number {
    const probe = document.createElement("div");
    probe.style.height = `var(--tr-${name})`;
    document.body.append(probe);
    const height = probe.getBoundingClientRect().height;
    probe.remove();
    return height;
  }

  public static readShownThumb(): string {
    const probe = document.body.appendChild(document.createElement("div"));
    probe.style.color = "var(--tr-scrollbar)";
    const shown = getComputedStyle(probe).color;
    probe.remove();
    return shown;
  }

  public static async parkPointerAsync(): Promise<HTMLElement> {
    const park = document.body.appendChild(document.createElement("div"));
    park.popover = "manual";
    park.style.cssText = "position: fixed; inset: 0 auto auto 0; width: 4px; height: 4px; margin: 0; padding: 0; border: 0;";
    park.showPopover();
    await userEvent.hover(park);
    return park;
  }

  public static async expectThumbRevealsOnHoverAsync(area: HTMLElement): Promise<void> {
    const thumb = (): string => getComputedStyle(area).getPropertyValue("--tr-scroll-thumb");
    const shown = AppearanceFixture.readShownThumb();

    const park = await AppearanceFixture.parkPointerAsync();
    try {
      await vi.waitFor(() => expect([area.matches(":hover"), thumb()]).toEqual([false, AppearanceFixture.hiddenThumb]));

      expect(shown).not.toBe(AppearanceFixture.hiddenThumb);
      await userEvent.hover(area);
      await vi.waitFor(() => expect(thumb()).toBe(shown));
    }
    finally {
      park.remove();
    }
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
