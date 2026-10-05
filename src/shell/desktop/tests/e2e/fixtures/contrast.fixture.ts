/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { Locator } from "@playwright/test";

export default class ContrastFixture {
  public static readonly MINIMUM_TEXT_CONTRAST: number = 4.5;

  public static measureContrast(foreground: string, background: string): number {
    const luminance = (color: string): number => {
      const [red = 0, green = 0, blue = 0] = (color.match(/\d+(\.\d+)?/gu) ?? []).slice(0, 3).map(t => Number(t) / 255)
        .map(t => t <= 0.03928 ? t / 12.92 : ((t + 0.055) / 1.055) ** 2.4);
      return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    };
    const [lighter = 0, darker = 0] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    return (lighter + 0.05) / (darker + 0.05);
  }

  public static async measureLowestTextContrastAsync(row: Locator): Promise<number> {
    const { background, colors } = await row.evaluate(t => ({
      background: getComputedStyle(t).backgroundColor,
      colors: [t, ...t.querySelectorAll("*")]
        .filter(u => [...u.childNodes].some(v => v.nodeType === Node.TEXT_NODE && (v.textContent ?? "").trim() !== ""))
        .map(u => getComputedStyle(u).color)
    }));
    if (colors.length === 0)
      throw new Error("The row shows no text.");
    return Math.min(...colors.map(t => ContrastFixture.measureContrast(t, background)));
  }
}
