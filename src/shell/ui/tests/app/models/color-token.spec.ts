/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ThemeMode } from "../../../src/app/enums/theme-mode";
import { ColorToken } from "../../../src/app/models/color-token";
import { Theme } from "../../../src/app/models/theme";

describe("ColorToken", () => {
  const theme = new Theme(
    "fixture.partial",
    "Partial",
    new Map([["editorWidget.background", "#101010"], ["foreground", "#202020"]]),
    new Map([["teamrun.raisedBackground", "#303030"]]),
    new Map(),
    new Map());

  it("resolves its key, then its fallback key, and nothing when the theme has neither", () => {
    const raised = new ColorToken("--tr-raised", "teamrun.raisedBackground", "editorWidget.background");
    const text = new ColorToken("--tr-text", "foreground");

    expect(raised.variable).toBe("--tr-raised");
    expect(raised.key).toBe("teamrun.raisedBackground");
    expect(raised.fallbackKey).toBe("editorWidget.background");
    expect(text.fallbackKey).toBeNull();
    expect(raised.resolve(theme, ThemeMode.Dark)).toBe("#303030");
    expect(raised.resolve(theme, ThemeMode.Light)).toBe("#101010");
    expect(text.resolve(theme, ThemeMode.Light)).toBe("#202020");
    expect(text.resolve(theme, ThemeMode.Dark)).toBeUndefined();
    expect(new ColorToken("--tr-code", "teamrun.codeBackground", "sideBar.background").resolve(theme, ThemeMode.Light)).toBeUndefined();
  });
});
