/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ApprovalOutcome } from "@noldova/teamrun-protocol";

@TestClass
export class ApprovalOutcomeTests {
  @TestMethod
  public usesMemberNamesAsValues(): void {
    Assert.areEqual("Approved", ApprovalOutcome.Approved);
    Assert.areEqual("Denied", ApprovalOutcome.Denied);
  }

  @TestMethod
  public valuesAreDistinct(): void {
    const values = Object.values(ApprovalOutcome);

    Assert.areEqual(values.length, new Set(values).size);
  }
}
