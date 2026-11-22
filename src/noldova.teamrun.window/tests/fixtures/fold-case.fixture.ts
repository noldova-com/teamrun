/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class FoldCase {
  public readonly where: string;
  public readonly level: number;
  public readonly narrowest: boolean;

  public constructor(where: string, level: number, narrowest: boolean) {
    this.where = where;
    this.level = level;
    this.narrowest = narrowest;
  }
}
