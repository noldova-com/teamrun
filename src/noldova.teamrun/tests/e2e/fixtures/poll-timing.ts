/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class PollTiming {
  public readonly timeout: number;
  public readonly intervals: number[];

  public constructor(timeout: number, intervals: readonly number[]) {
    this.timeout = timeout;
    this.intervals = [...intervals];
  }
}
