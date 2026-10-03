/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { FontChoice, ModePreference } from "@noldova/teamrun-shell-ui";

import { AppearancePreferences } from "../../../src/app/models/appearance-preferences";

describe("AppearancePreferences", () => {
  const values: Record<string, JsonValue> = {
    "shell.theme": "shell.default",
    "shell.mode": "Dark",
    "shell.interfaceFont": "System",
    "shell.codeFont": "Noldova",
    "shell.panelSize": 15,
    "shell.messageSize": 16,
    "shell.codeSize": 12
  };

  it("reads the appearance settings, writes them under their names and reads them back", () => {
    const preferences = AppearancePreferences.fromSettings(name => values[name]);
    const again = AppearancePreferences.fromJson(preferences?.toJson());

    expect([preferences?.theme, preferences?.mode, preferences?.typography.interfaceFont, preferences?.typography.panelSize, preferences?.typography.codeSize])
      .toEqual(["shell.default", ModePreference.Dark, FontChoice.System, 15, 12]);
    expect(preferences?.toJson()).toEqual(values);
    expect(preferences?.equals(again ?? null)).toBe(true);
    expect(preferences?.equals(null)).toBe(false);
    expect(preferences?.equals(AppearancePreferences.fromSettings(name => name === "shell.mode" ? "Light" : values[name]))).toBe(false);
  });

  it("reads nothing from values that are missing, of another type, not a choice, out of range or not an object", () => {
    const without = (name: string, value?: JsonValue): AppearancePreferences | null => AppearancePreferences.fromSettings(t => t === name ? value : values[t]);

    expect([
      without("shell.theme"),
      without("shell.theme", 1),
      without("shell.mode", "Sepia"),
      without("shell.codeFont", "Comic"),
      without("shell.panelSize", "15"),
      without("shell.messageSize", 30),
      AppearancePreferences.fromJson(["Dark"]),
      AppearancePreferences.fromJson(null)
    ]).toEqual([null, null, null, null, null, null, null, null]);
  });
});
