/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Theme } from "@noldova/ui.components.angular";

export class GeometryCase {
  public readonly geometry: string;
  public readonly theme: Theme;

  public constructor(geometry: string, theme: Theme) {
    this.geometry = geometry;
    this.theme = theme;
  }
}
