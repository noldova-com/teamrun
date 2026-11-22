/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class CheckRun {
  public readonly passed: boolean;
  public readonly lines: readonly string[];

  public constructor(passed: boolean, lines: readonly string[]) {
    this.passed = passed;
    this.lines = lines;
  }
}
