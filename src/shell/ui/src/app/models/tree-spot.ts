/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class TreeSpot {
  public readonly label: string;
  public readonly parentLabel: string | null;
  public readonly position: number;
  public readonly count: number;

  public constructor(label: string, parentLabel: string | null, position: number, count: number) {
    this.label = label;
    this.parentLabel = parentLabel;
    this.position = position;
    this.count = count;
  }
}
