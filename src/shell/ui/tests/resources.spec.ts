/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ThemeMode } from "../src/app/enums/theme-mode";
import { DefaultTheme } from "../src/app/models/default-theme";
import { Resources } from "../src/resources";

describe("Resources", () => {
  it("formats variables, shape attributes and messages", () => {
    expect(Resources.formatLookVariable("radius-small")).toBe("--tr-radius-small");
    expect(Resources.formatShapeAttribute("tab")).toBe("data-tr-tab-shape");
    expect(Resources.formatMissingThemeValue("shell.default", "foreground")).toBe("The theme \"shell.default\" has no value for \"foreground\".");
    expect(Resources.formatTextSizeOutOfRange("panelSize", 20)).toBe("The panelSize must be from 12 to 18 CSS pixels; 20 is outside that range.");
    expect(Resources.formatCloseTab("Readme")).toBe("Close Readme");
  });

  it("lists every token once, and the default theme resolves each one in both modes", () => {
    const variables = Resources.colorTokens.map(t => t.variable);

    expect(new Set(variables).size).toBe(variables.length);
    expect(new Set(Resources.lookTokens).size).toBe(Resources.lookTokens.length);
    for (const token of Resources.colorTokens)
      for (const mode of [ThemeMode.Light, ThemeMode.Dark])
        expect(token.resolve(DefaultTheme.theme, mode), `${token.key} in ${mode}`).toMatch(/^#[0-9A-F]{6}([0-9A-F]{2})?$/);
    for (const name of Resources.lookTokens)
      expect(DefaultTheme.theme.readLook(name), name).toBeDefined();
  });
});
