/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type JsonObject, JsonReader, type JsonValue } from "@noldova/teamrun-foundation-json";
import { FontChoice, ModePreference, Typography } from "@noldova/teamrun-shell-ui";

import { Resources } from "../../resources";

export class AppearancePreferences {
  public readonly theme: string;
  public readonly mode: ModePreference;
  public readonly typography: Typography;

  public constructor(theme: string, mode: ModePreference, typography: Typography) {
    this.theme = theme;
    this.mode = mode;
    this.typography = typography;
  }

  public static fromSettings(read: (name: string) => JsonValue | undefined): AppearancePreferences | null {
    return AppearancePreferences.tryRead(() => new AppearancePreferences(
      AppearancePreferences.text(read(Resources.themeSetting)),
      AppearancePreferences.choice(read(Resources.modeSetting), ModePreference),
      new Typography(
        AppearancePreferences.size(read(Resources.panelSizeSetting)),
        AppearancePreferences.size(read(Resources.messageSizeSetting)),
        AppearancePreferences.size(read(Resources.codeSizeSetting)),
        AppearancePreferences.choice(read(Resources.interfaceFontSetting), FontChoice),
        AppearancePreferences.choice(read(Resources.codeFontSetting), FontChoice))));
  }

  public static fromJson(value: unknown): AppearancePreferences | null {
    return AppearancePreferences.tryRead(() => {
      const json = JsonReader.fromValue(value).toJson();
      return AppearancePreferences.fromSettings(name => json[name]);
    });
  }

  public equals(other: AppearancePreferences | null): boolean {
    return !Object.isNull(other) && JSON.stringify(this.toJson()) === JSON.stringify(other.toJson());
  }

  public toJson(): JsonObject {
    return {
      [Resources.themeSetting]: this.theme,
      [Resources.modeSetting]: this.mode,
      [Resources.interfaceFontSetting]: this.typography.interfaceFont,
      [Resources.codeFontSetting]: this.typography.codeFont,
      [Resources.panelSizeSetting]: this.typography.panelSize,
      [Resources.messageSizeSetting]: this.typography.messageSize,
      [Resources.codeSizeSetting]: this.typography.codeSize
    };
  }

  private static tryRead(read: () => AppearancePreferences | null): AppearancePreferences | null {
    try {
      return read();
    }
    catch {
      return null;
    }
  }

  private static text(value: JsonValue | undefined): string {
    if (typeof value !== "string")
      throw new TypeError(Resources.appearanceUnreadable);
    return value;
  }

  private static size(value: JsonValue | undefined): number {
    if (typeof value !== "number")
      throw new TypeError(Resources.appearanceUnreadable);
    return value;
  }

  private static choice<T extends string>(value: JsonValue | undefined, choices: Readonly<Record<string, T>>): T {
    const found = Object.values(choices).find(t => t === value);
    if (Object.isUndefined(found))
      throw new TypeError(Resources.appearanceUnreadable);
    return found;
  }
}
