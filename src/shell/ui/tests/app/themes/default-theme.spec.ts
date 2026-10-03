/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ThemeMode } from "../../../src/app/enums/theme-mode";
import { DefaultTheme } from "../../../src/app/themes/default-theme";

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
      ["surface.border", "#E5E5E5", "#252526"],
      ["focusBorder", "#005FB8", "#4DAAFC"],
      ["list.hoverBackground", "#F2F2F2", "#2A2D2E"],
      ["list.inactiveSelectionBackground", "#E4E6F1", "#37373D"],
      ["toolbar.hoverBackground", "#B8B8B850", "#5A5D5E50"],
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
      ["sash", "0.25rem"],
      ["docking-guide", "2.5rem"],
      ["menu-item-height", "1.625rem"],
      ["tooltip-width", "43.75rem"],
      ["popover-width", "27.5rem"],
      ["checkbox-size", "1.125rem"],
      ["toast-width", "22.5rem"]
    ];

    for (const [name, value] of expected)
      expect(theme.readLook(name)).toBe(value);
  });
});
