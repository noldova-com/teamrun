/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class PaintedSelection {
  public readonly band: string;
  public readonly text: string;

  public constructor(band: string, text: string) {
    this.band = band;
    this.text = text;
  }
}
