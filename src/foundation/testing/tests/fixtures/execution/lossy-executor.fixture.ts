/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestClassResult, TestExecutor } from "@noldova/teamrun-foundation-testing";

export class LossyExecutor extends TestExecutor {
  public override async executeAsync(): Promise<TestClassResult[]> {
    return [];
  }
}
