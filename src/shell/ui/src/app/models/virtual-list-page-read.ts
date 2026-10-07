/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class VirtualListPageRead {
  public readonly start: number;
  public readonly end: number;
  public readonly controller: AbortController = new AbortController();

  public constructor(start: number, end: number) {
    this.start = start;
    this.end = end;
  }
}
