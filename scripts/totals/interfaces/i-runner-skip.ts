/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type ITestName from "./i-test-name.ts";

export default interface IRunnerSkip extends ITestName {
  readonly reason: string;
}
