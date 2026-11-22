/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ThemeMode } from "@noldova/ui.components.angular";

export class ThemeCase {
  public static readonly every: readonly ThemeCase[] = [
    new ThemeCase("the fixture theme", ThemeMode.Light, "none"),
    new ThemeCase("dark", ThemeMode.Dark, "none"),
    new ThemeCase("forced colors", ThemeMode.Light, "active")
  ];

  public readonly look: string;
  public readonly mode: ThemeMode;
  public readonly forcedColors: string;

  public constructor(look: string, mode: ThemeMode, forcedColors: string) {
    this.look = look;
    this.mode = mode;
    this.forcedColors = forcedColors;
  }
}
