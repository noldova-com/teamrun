/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class AccessWidths {
  public readonly labelled: number;
  public readonly short: number;
  public readonly glyph: number;

  public constructor(labelled: number, short: number, glyph: number) {
    this.labelled = labelled;
    this.short = short;
    this.glyph = glyph;
  }
}
