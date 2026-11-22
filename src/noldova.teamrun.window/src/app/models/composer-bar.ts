/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { AccessWidths } from "./access-widths";
import type { FoldWidths } from "./fold-widths";

export class ComposerBar {
  public static readonly unfolded: number = 0;
  public static readonly lineHidden: number = 1;
  public static readonly tight: number = 2;
  public static readonly buttonShort: number = 3;
  public static readonly gaugeTrack: number = 4;
  public static readonly accessIcon: number = 5;
  public static readonly accessInMenu: number = 6;

  private static readonly tolerance: number = 0.01;

  public readonly width: number;
  public readonly insets: FoldWidths;
  public readonly cardMaxWidth: number;
  public readonly cardChrome: number;
  public readonly gap: number;
  public readonly ends: number;
  public readonly access: AccessWidths;
  public readonly gauge: FoldWidths | null;
  public readonly picker: FoldWidths;
  public readonly line: number | null;

  public constructor(width: number, insets: FoldWidths, cardMaxWidth: number, cardChrome: number, gap: number, ends: number, access: AccessWidths,
    gauge: FoldWidths | null, picker: FoldWidths, line: number | null) {
    this.width = width;
    this.insets = insets;
    this.cardMaxWidth = cardMaxWidth;
    this.cardChrome = cardChrome;
    this.gap = gap;
    this.ends = ends;
    this.access = access;
    this.gauge = gauge;
    this.picker = picker;
    this.line = line;
  }

  public fold(): number {
    for (let fold = ComposerBar.unfolded; fold < ComposerBar.accessInMenu; fold++)
      if (this.need(fold) <= this.room(fold) + ComposerBar.tolerance)
        return fold;
    return ComposerBar.accessInMenu;
  }

  private room(fold: number): number {
    return Math.min(this.width - this.insets.widthAt(fold >= ComposerBar.tight), this.cardMaxWidth) - this.cardChrome;
  }

  private need(fold: number): number {
    const short = fold >= ComposerBar.buttonShort;
    const access = fold >= ComposerBar.accessIcon ? this.access.glyph : short ? this.access.short : this.access.labelled;
    const items = [access, this.picker.widthAt(short), ...(Object.isNull(this.line) || fold >= ComposerBar.lineHidden ? [] : [this.line]),
      ...(Object.isNull(this.gauge) ? [] : [this.gauge.widthAt(fold >= ComposerBar.gaugeTrack)])];
    return this.ends + items.reduce((total, t) => total + t, 0) + this.gap * (items.length + 2);
  }
}
