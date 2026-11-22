/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class StatRow {
  public readonly kind: string;
  public readonly label: string;
  public readonly value: string;

  public constructor(kind: string, label: string, value: string) {
    this.kind = kind;
    this.label = label;
    this.value = value;
  }
}
