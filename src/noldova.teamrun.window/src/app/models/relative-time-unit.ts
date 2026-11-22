/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class RelativeTimeUnit {
  public readonly unit: Intl.RelativeTimeFormatUnit;
  public readonly minutes: number;

  public constructor(unit: Intl.RelativeTimeFormatUnit, minutes: number) {
    this.unit = unit;
    this.minutes = minutes;
  }
}
