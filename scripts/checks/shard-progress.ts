/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ShardProgress {
  public readonly test: string;
  public readonly isRunning: boolean;

  public constructor(test: string, isRunning: boolean) {
    this.test = test;
    this.isRunning = isRunning;
  }
}
