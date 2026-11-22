/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class WidthBand {
  public readonly widths: string;
  public readonly band: number;

  public constructor(widths: string, band: number) {
    this.widths = widths;
    this.band = band;
  }
}
