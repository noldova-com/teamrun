/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { StopPolicy } from "@noldova/teamrun-shell-protocol";

@TestClass
export class StopPolicyTests {
  @TestMethod
  public namesEveryPolicyByItsMember(): void {
    Assert.areEqual("IfIdle,StopWork", Object.values(StopPolicy).join(","));
  }
}
