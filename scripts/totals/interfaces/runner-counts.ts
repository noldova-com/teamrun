/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default interface IRunnerCounts {
  readonly discovered: number;
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly unselected: number;
  readonly unreached: number;
}
