/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { PlanStepStatus } from "@noldova/teamrun.protocol";

@TestClass
export class PlanStepStatusTests {
  @TestMethod
  public usesMemberNamesAsValues(): void {
    Assert.areEqual("Pending,InProgress,Completed", Object.values(PlanStepStatus).join(","));
  }
}
