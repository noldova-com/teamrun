/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { Resources } from "../resources";

export class Theme {
  public readonly id: string;
  public readonly name: string;
  public readonly dark: boolean;
  private readonly colors: ReadonlyMap<string, string>;

  public constructor(id: string, name: string, dark: boolean, colors: ReadonlyMap<string, string>) {
    this.id = id;
    this.name = name;
    this.dark = dark;
    this.colors = colors;
  }

  public static fromJson(id: string, value: unknown): Theme | null {
    if (!Object.isObject(value) || Array.isArray(value))
      return null;
    const record: Record<string, unknown> = { ...value };
    const name = record[Resources.themeNameField];
    if (!Object.isString(name) || String.isNullOrWhitespace(name))
      return null;
    const colors = new Map<string, string>();
    const stored = record[Resources.themeColorsField];
    if (Object.isObject(stored) && !Array.isArray(stored))
      for (const [key, color] of Object.entries(stored))
        if (Object.isString(color) && Resources.themeColorPattern.test(color))
          colors.set(key, color);

    return new Theme(id, name, record[Resources.themeTypeField] !== Resources.lightThemeType, colors);
  }

  public color(key: string): string | null {
    return this.colors.get(key) ?? null;
  }
}
