/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ThemeMode } from "../../../src/app/enums/theme-mode";
import type { Theme } from "../../../src/app/models/theme";
import { DefaultTheme } from "../../../src/app/models/default-theme";
import { Resources } from "../../../src/resources";
import { AppearanceFixture } from "../../fixtures/appearance.fixture";

describe("DefaultTheme", () => {
  const theme = DefaultTheme.theme;

  it("is the shell's theme", () => {
    expect(theme.id).toBe("shell.default");
    expect(theme.name).toBe("Default");
    expect(theme.readShape("tab")).toBe("pill");
  });

  it("holds the UI standards' light and dark colors", () => {
    const expected: readonly (readonly [string, string, string])[] = [
      ["sideBar.background", "#F8F8F8", "#181818"],
      ["editor.background", "#FFFFFF", "#1F1F1F"],
      ["teamrun.raisedBackground", "#F8F8F8", "#2B2B2B"],
      ["foreground", "#3B3B3B", "#CCCCCC"],
      ["teamrun.mutedForeground", "#616161", "#9D9D9D"],
      ["surface.border", "#E5E5E5", "#252525"],
      ["focusBorder", "#005FB8", "#4DAAFC"],
      ["list.hoverBackground", "#F2F2F2", "#2C2C2C"],
      ["list.inactiveSelectionBackground", "#E6E6E6", "#383838"],
      ["toolbar.hoverBackground", "#B8B8B850", "#5C5C5C50"],
      ["button.secondaryBackground", "#E5E5E5", "#00000000"],
      ["menu.border", "#CECECE", "#454545"],
      ["editorHoverWidget.background", "#F8F8F8", "#202020"],
      ["errorForeground", "#A1260D", "#F48771"],
      ["teamrun.addedForeground", "#3F6212", "#B5CEA8"]
    ];

    for (const [key, light, dark] of expected) {
      expect(theme.readColor(ThemeMode.Light, key)).toBe(light);
      expect(theme.readColor(ThemeMode.Dark, key)).toBe(dark);
    }
  });

  it("holds the UI standards' geometry in rem, with one-pixel borders", () => {
    const expected: readonly (readonly [string, string])[] = [
      ["radius-hover", "0.1875rem"],
      ["radius-small", "0.25rem"],
      ["radius-medium", "0.375rem"],
      ["radius-large", "0.5rem"],
      ["border-width", "1px"],
      ["tab-height", "2rem"],
      ["tab-pill", "1.5rem"],
      ["icon-button", "1.375rem"],
      ["panel-card-gap", "0.25rem"],
      ["sash", "var(--tr-panel-card-gap)"],
      ["panel-card-margin", "0.25rem"],
      ["dock-left-width", "26rem"],
      ["dock-right-width", "25rem"],
      ["dock-bottom-height", "16.25rem"],
      ["dock-min-size", "10rem"],
      ["dock-strip-size", "2.75rem"],
      ["document-min-size", "13.75rem"],
      ["group-min-width", "10rem"],
      ["group-min-height", "6.25rem"],
      ["docking-guide", "2.5rem"],
      ["menu-item-height", "1.625rem"],
      ["tooltip-width", "43.75rem"],
      ["popover-width", "27.5rem"],
      ["dialog-width", "27.5rem"],
      ["dialog-title-padding", "1.375rem 2rem 0.75rem 1.25rem"],
      ["dialog-body-padding", "0 2rem 0 1.25rem"],
      ["dialog-actions-padding", "1.25rem 0.5rem 0.5rem"],
      ["checkbox-size", "1.125rem"],
      ["toast-width", "22.5rem"]
    ];

    for (const [name, value] of expected)
      expect(theme.readLook(name)).toBe(value);
  });
});

describe("DefaultTheme contrast", () => {
  const themes: readonly Theme[] = [DefaultTheme.theme];
  const modes: readonly ThemeMode[] = [ThemeMode.Light, ThemeMode.Dark];
  const textRatio = 4.5;
  const partRatio = 3;
  const surfaces: readonly string[] = ["window", "panel", "raised", "dialog", "hover-widget", "quick-input", "notification", "code", "code-header"];
  const on = (foreground: string, grounds: readonly (readonly string[])[], ratio: number): (readonly [string, readonly string[], number])[] =>
    grounds.map(t => [foreground, t, ratio] as const);
  const pairs: readonly (readonly [string, readonly string[], number])[] = [
    ...on("text", [...surfaces.map(t => [t]), ["window", "hover"], ["panel", "hover"], ["window", "selected"], ["panel", "selected"], ["window", "toolbar-hover"]], textRatio),
    ...on("text-muted", [...surfaces.filter(t => t !== "code").map(t => [t]), ["window", "hover"], ["panel", "hover"]], textRatio),
    ...on("menu-text", [["menu"], ["menu", "hover"], ["menu", "selected"], ["quick-input"], ["quick-input", "selected"]], textRatio),
    ...on("setting-title", [["panel"], ["panel", "hover"]], textRatio),
    ...on("link", [["window"], ["panel"], ["dialog"]], textRatio),
    ...on("list-highlight", [["panel"], ["panel", "hover"], ["quick-input"], ["quick-input", "selected"]], textRatio),
    ...on("input-text", [["input"], ["dropdown"], ["dropdown-list"]], textRatio),
    ...on("placeholder", [["input"]], textRatio),
    ...on("list-active-text", [["list-active"]], textRatio),
    ...on("button-text", [["button"], ["button-hover"]], textRatio),
    ...on("button-secondary-text", [["window", "button-secondary"], ["panel", "button-secondary"], ["panel", "button-secondary-hover"]], textRatio),
    ...on("badge-text", [["badge"]], textRatio),
    ...on("title-bar-text", [["title-bar"]], textRatio),
    ...on("error", [["window"], ["panel"], ["dialog"], ["panel", "hover"]], textRatio),
    ...on("removed", [["panel"], ["code"]], textRatio),
    ...on("added", [["panel"], ["code"]], textRatio),
    ...on("icon-color", [["window"], ["panel"], ["menu"], ["window", "hover"], ["window", "selected"], ["window", "toolbar-hover"], ["panel", "toolbar-hover"]], partRatio),
    ...on("accent", [["window"], ["panel"], ["raised"], ["dialog"], ["menu"], ["quick-input"], ["input"], ["dropdown-list"], ["window", "selected"], ["panel", "selected"], ["menu", "selected"], ["quick-input", "selected"], ["dropdown-list", "list-active"]], partRatio),
    ...on("sash-active", [["window"]], partRatio),
    ...on("progress", [["window"], ["panel"]], partRatio),
    ...on("button", [["window"], ["panel"], ["dialog"]], partRatio),
    ...on("input-border", [["input"], ["window"], ["panel"]], partRatio),
    ...on("dropdown-border", [["dropdown"], ["window"], ["panel"]], partRatio),
    ...on("checkbox-border", [["checkbox"], ["window"], ["panel"]], partRatio),
    ...on("docking-preview-border", [["window"], ["panel"], ["panel", "docking-preview"]], partRatio)
  ];
  const exempt: ReadonlyMap<string, string> = new Map([
    ["card-border", "Decorative card edge; a card stands apart from its surface by its fill and layout."],
    ["border", "Separator between a dock strip's sections, not the boundary of a control."],
    ["button-border", "Decorative edge where the button's fill already identifies the control."],
    ["menu-separator", "Decorative separator between a menu's sections."],
    ["widget-shadow", "Shadow of an overlay, whose border and content identify it."],
    ["widget-border", "Outline of dialogs and search, which the backdrop and their content set apart."],
    ["hover-widget-border", "Edge of a tooltip, whose text identifies it."],
    ["menu-border", "Edge of a menu, whose rows identify it."],
    ["notification-border", "Edge of a notification, whose text identifies it."],
    ["scrollbar", "Scrollbar thumb, kept as a standard scrollbar by decision; the wheel, the keys and touch scroll without it."],
    ["scrollbar-active", "Scrollbar thumb while dragged, kept as a standard scrollbar by decision; the wheel, the keys and touch scroll without it."]
  ]);

  function channels(theme: Theme, mode: ThemeMode, name: string): readonly number[] {
    const token = Resources.colorTokens.find(t => t.variable === `--tr-${name}`);
    const color = token?.resolve(theme, mode) ?? token?.resolve(DefaultTheme.theme, mode);
    if (color === undefined)
      throw new Error(`The theme ${theme.id} has no ${name} color.`);
    const [red = 0, green = 0, blue = 0, alpha = 255] = [1, 3, 5, 7].map(t => Number.parseInt(color.slice(t, t + 2) || "FF", 16));
    return [red, green, blue, alpha / 255];
  }

  function over(top: readonly number[], bottom: readonly number[]): readonly number[] {
    const alpha = top[3] ?? 1;
    return [0, 1, 2].map(t => (top[t] ?? 0) * alpha + (bottom[t] ?? 0) * (1 - alpha)).concat(1);
  }

  function ratio(theme: Theme, mode: ThemeMode, foreground: string, grounds: readonly string[]): number {
    const [surface = "", ...fills] = grounds;
    const base = channels(theme, mode, surface);
    if (base[3] !== 1)
      throw new Error(`The surface ${surface} under a pair must be opaque.`);
    const ground = fills.reduce<readonly number[]>((sum, t) => over(channels(theme, mode, t), sum), base);
    const format = (color: readonly number[]): string => `rgb(${color.slice(0, 3).join(", ")})`;
    return AppearanceFixture.contrast(format(over(channels(theme, mode, foreground), ground)), format(ground));
  }

  it("gives text 4.5:1 and the required boundaries, state cues and icons 3:1 on every surface and state they appear on, in every theme and mode", () => {
    const failures = themes.flatMap(theme => modes.flatMap(mode => pairs
      .map(([foreground, grounds, minimum]) => [`${theme.id} ${mode}: ${foreground} on ${grounds.join(" + ")}`, ratio(theme, mode, foreground, grounds), minimum] as const)
      .filter(([, measured, minimum]) => measured < minimum)
      .map(([pair, measured, minimum]) => `${pair} is ${measured.toFixed(2)}:1, under ${minimum}:1`)));

    expect(failures).toEqual([]);
  });

  it("refuses a pair whose surface is translucent, since nothing lies beneath it to composite over", () => {
    expect(() => ratio(DefaultTheme.theme, ThemeMode.Light, "text", ["toolbar-hover"])).toThrow("The surface toolbar-hover under a pair must be opaque.");
  });

  it("checks or exempts every color of the theme, each exemption with its reason", () => {
    const checked = new Set(pairs.flatMap(([foreground, grounds]) => [foreground, ...grounds]));
    const unaccounted = Resources.colorTokens.map(t => t.variable.slice("--tr-".length)).filter(t => !checked.has(t) && !exempt.has(t));

    expect(unaccounted).toEqual([]);
    expect([...exempt.keys()].filter(t => checked.has(t))).toEqual([]);
    expect([...exempt.values()].every(t => t.length > 0)).toBe(true);
  });
});
