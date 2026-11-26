/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ProcessListRow {
  public readonly parent: number;
  public readonly start: number;

  public constructor(parent: number, start: number) {
    this.parent = parent;
    this.start = start;
  }
}
