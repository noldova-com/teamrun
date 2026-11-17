/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ReplyStatRow {
  public readonly label: string;
  public readonly value: string;
  public readonly isPart: boolean;

  public constructor(label: string, value: string, isPart: boolean = false) {
    this.label = label;
    this.value = value;
    this.isPart = isPart;
  }
}
