/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Theme, ThemeMode } from "@noldova/ui.components.angular";

export class ThemeLook {
  public readonly look: string;
  public readonly theme: Theme;
  public readonly mode: ThemeMode;

  public constructor(look: string, theme: Theme, mode: ThemeMode) {
    this.look = look;
    this.theme = theme;
    this.mode = mode;
  }
}
