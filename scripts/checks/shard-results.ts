/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { FailedTest } from "./failed-test.ts";

export class ShardResults {
  public readonly isComplete: boolean;
  public readonly failed: readonly FailedTest[];

  public constructor(isComplete: boolean, failed: readonly FailedTest[]) {
    this.isComplete = isComplete;
    this.failed = failed;
  }
}
