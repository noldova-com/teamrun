/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ThemeMode } from "@noldova/ui.components.angular";

export class ChipLookCase {
  public readonly look: string;
  public readonly mode: ThemeMode;
  public readonly forcedColors: string;
  public readonly merged: string;

  public constructor(look: string, mode: ThemeMode, forcedColors: string, merged: string) {
    this.look = look;
    this.mode = mode;
    this.forcedColors = forcedColors;
    this.merged = merged;
  }
}
