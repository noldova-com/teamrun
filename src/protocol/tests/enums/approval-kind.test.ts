/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ApprovalKind } from "@noldova/teamrun-protocol";

@TestClass
export class ApprovalKindTests {
  @TestMethod
  public usesMemberNamesAsValues(): void {
    Assert.areEqual("Command", ApprovalKind.Command);
    Assert.areEqual("FileChange", ApprovalKind.FileChange);
    Assert.areEqual("Tool", ApprovalKind.Tool);
  }

  @TestMethod
  public valuesAreDistinct(): void {
    const values = Object.values(ApprovalKind);

    Assert.areEqual(values.length, new Set(values).size);
  }
}
