/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ListedProcess {
  public readonly id: number;
  public readonly start: number;

  public constructor(id: number, start: number) {
    this.id = id;
    this.start = start;
  }
}
