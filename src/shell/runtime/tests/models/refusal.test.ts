/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Failure, FailureCode, ShellMethods } from "@noldova/teamrun-shell-protocol";
import { Refusal } from "@noldova/teamrun-shell-runtime";

@TestClass
export class RefusalTests {
  @TestMethod
  public keepsTheFailureAndTheAllowedMethod(): void {
    const failure = new Failure(FailureCode.PreShellData, "Move the old data aside.");

    const refusal = new Refusal(failure, ShellMethods.moveAside);

    Assert.areEqual(failure, refusal.failure);
    Assert.areEqual(ShellMethods.moveAside, refusal.method);
  }
}
