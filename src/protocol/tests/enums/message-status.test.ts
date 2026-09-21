/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { MessageStatus } from "@noldova/teamrun-protocol";

@TestClass
export class MessageStatusTests {
  @TestMethod
  public usesMemberNamesAsValues(): void {
    Assert.areEqual("Pending", MessageStatus.Pending);
    Assert.areEqual("Running", MessageStatus.Running);
    Assert.areEqual("AwaitingApproval", MessageStatus.AwaitingApproval);
    Assert.areEqual("Completed", MessageStatus.Completed);
    Assert.areEqual("Failed", MessageStatus.Failed);
    Assert.areEqual("Cancelled", MessageStatus.Cancelled);
    Assert.areEqual("Interrupted", MessageStatus.Interrupted);
  }

  @TestMethod
  public valuesAreDistinct(): void {
    const values = Object.values(MessageStatus);

    Assert.areEqual(values.length, new Set(values).size);
  }
}
