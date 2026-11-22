/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ThemeMode } from "@noldova/ui.components.angular";

export class SurfaceLookCase {
  public readonly look: string;
  public readonly mode: ThemeMode;
  public readonly surface: string;

  public constructor(look: string, mode: ThemeMode, surface: string) {
    this.look = look;
    this.mode = mode;
    this.surface = surface;
  }
}
