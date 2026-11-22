/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class SteadyFrame {
  public readonly elapsed: number;
  public readonly verdict: string;

  public constructor(elapsed: number, verdict: string) {
    this.elapsed = elapsed;
    this.verdict = verdict;
  }
}
