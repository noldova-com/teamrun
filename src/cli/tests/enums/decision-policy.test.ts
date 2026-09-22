/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DecisionPolicy } from "@noldova/teamrun-cli";

@TestClass
export class DecisionPolicyTests {
  @TestMethod
  public namesEveryPolicy(): void {
    Assert.areEqual("Ask,Approve,Deny", Object.values(DecisionPolicy).join(","));
  }
}
