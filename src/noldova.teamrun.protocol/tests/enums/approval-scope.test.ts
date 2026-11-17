/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ApprovalScope } from "@noldova/teamrun.protocol";

@TestClass
export class ApprovalScopeTests {
  @TestMethod
  public usesMemberNamesAsValues(): void {
    Assert.areEqual("Once", ApprovalScope.Once);
    Assert.areEqual("Session", ApprovalScope.Session);
    Assert.areEqual("Always", ApprovalScope.Always);
  }

  @TestMethod
  public valuesAreDistinct(): void {
    const values = Object.values(ApprovalScope);

    Assert.areEqual(values.length, new Set(values).size);
  }
}
