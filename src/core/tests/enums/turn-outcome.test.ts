/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { TurnOutcome } from "@noldova/teamrun-core";

@TestClass
export class TurnOutcomeTests {
  @TestMethod
  public namesTheThreeOutcomes(): void {
    Assert.areEqual("Completed", TurnOutcome.Completed);
    Assert.areEqual("Failed", TurnOutcome.Failed);
    Assert.areEqual("Interrupted", TurnOutcome.Interrupted);
    Assert.areEqual(3, Object.values(TurnOutcome).length);
  }
}
