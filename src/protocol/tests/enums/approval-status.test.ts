/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ApprovalStatus } from "@noldova/teamrun-protocol";

@TestClass
export class ApprovalStatusTests {
  @TestMethod
  public usesMemberNamesAsValues(): void {
    Assert.areEqual("Pending", ApprovalStatus.Pending);
    Assert.areEqual("Approved", ApprovalStatus.Approved);
    Assert.areEqual("Denied", ApprovalStatus.Denied);
    Assert.areEqual("Cancelled", ApprovalStatus.Cancelled);
  }

  @TestMethod
  public valuesAreDistinct(): void {
    const values = Object.values(ApprovalStatus);

    Assert.areEqual(values.length, new Set(values).size);
  }
}
