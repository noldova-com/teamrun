/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

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
  public readonly insets: readonly [number, number];
  public readonly cardMaxWidth: number;
  public readonly cardChrome: number;
  public readonly gap: number;
  public readonly ends: number;
  public readonly access: readonly [number, number, number];
  public readonly gauge: readonly [number, number] | null;
  public readonly picker: readonly [number, number];
  public readonly line: number | null;

  public constructor(width: number, insets: readonly [number, number], cardMaxWidth: number, cardChrome: number, gap: number, ends: number,
    access: readonly [number, number, number], gauge: readonly [number, number] | null, picker: readonly [number, number], line: number | null) {
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
    const inset = fold < ComposerBar.tight ? this.insets[0] : this.insets[1];
    return Math.min(this.width - inset, this.cardMaxWidth) - this.cardChrome;
  }

  private need(fold: number): number {
    const short = fold < ComposerBar.buttonShort ? 0 : 1;
    const items = [this.access[fold < ComposerBar.accessIcon ? short : 2], this.picker[short], ...(Object.isNull(this.line) || fold >= ComposerBar.lineHidden ? [] : [this.line]),
      ...(Object.isNull(this.gauge) ? [] : [this.gauge[fold < ComposerBar.gaugeTrack ? 0 : 1]])];
    return this.ends + items.reduce((total, t) => total + t, 0) + this.gap * (items.length + 2);
  }
}
