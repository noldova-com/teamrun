/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import type { ThemeMode } from "../enums/theme-mode";
import type { Theme } from "./theme";

export class ColorToken {
  public readonly variable: string;
  public readonly key: string;
  public readonly fallbackKey: string | null;

  public constructor(variable: string, key: string, fallbackKey: string | null = null) {
    this.variable = variable;
    this.key = key;
    this.fallbackKey = fallbackKey;
  }

  public resolve(theme: Theme, mode: ThemeMode): string | undefined {
    const color = theme.readColor(mode, this.key);
    if (!Object.isUndefined(color) || Object.isNull(this.fallbackKey))
      return color;
    return theme.readColor(mode, this.fallbackKey);
  }
}
