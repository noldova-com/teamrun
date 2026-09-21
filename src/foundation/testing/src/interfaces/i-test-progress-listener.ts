/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TestClassResult } from "../models/results/test-class-result.js";

export interface ITestProgressListener {
  onClassCompleted(result: TestClassResult): void;
}
