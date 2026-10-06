/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type FlakyTest from "../checks/flaky-test.ts";

export default class FlakyOccurrence {
  public readonly test: FlakyTest;
  public readonly jobs: readonly string[];

  public constructor(test: FlakyTest, jobs: readonly string[]) {
    this.test = test;
    this.jobs = [...jobs];
  }
}
