/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class TimedSegment {
  public readonly key: number;
  public readonly at: number;

  public constructor(key: number, at: number) {
    this.key = key;
    this.at = at;
  }
}
