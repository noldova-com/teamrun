/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod, TestOutcome } from "@noldova/teamrun-foundation-testing";

@TestClass
export class TestOutcomeTests {
  @TestMethod
  public namesTheOutcomesCanonically(): void {
    Assert.areEqual<string>("Passed", TestOutcome.Passed);
    Assert.areEqual<string>("Failed", TestOutcome.Failed);
    Assert.areEqual<string>("Skipped", TestOutcome.Skipped);
  }
}
