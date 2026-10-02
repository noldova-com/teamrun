/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ThemeMode } from "../../../src/app/enums/theme-mode";
import { Theme } from "../../../src/app/models/theme";

describe("Theme", () => {
  it("reads colors for the requested mode, look values and shapes, and leaves out what it does not define", () => {
    const theme = new Theme(
      "fixture.theme",
      "Fixture",
      new Map([["foreground", "#111111"]]),
      new Map([["foreground", "#EEEEEE"]]),
      new Map([["radius-small", "1rem"]]),
      new Map([["tab", "pill"]]));

    expect(theme.id).toBe("fixture.theme");
    expect(theme.name).toBe("Fixture");
    expect(theme.readColor(ThemeMode.Light, "foreground")).toBe("#111111");
    expect(theme.readColor(ThemeMode.Dark, "foreground")).toBe("#EEEEEE");
    expect(theme.readColor(ThemeMode.Dark, "editor.background")).toBeUndefined();
    expect(theme.readLook("radius-small")).toBe("1rem");
    expect(theme.readLook("radius-large")).toBeUndefined();
    expect(theme.readShape("tab")).toBe("pill");
    expect(theme.readShape("menu")).toBeUndefined();
  });
});
