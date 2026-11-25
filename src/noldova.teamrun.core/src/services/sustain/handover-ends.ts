/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class HandoverEnds {
  public readonly start: string;
  public readonly end: string;

  public constructor(start: string, end: string) {
    this.start = start;
    this.end = end;
  }
}
