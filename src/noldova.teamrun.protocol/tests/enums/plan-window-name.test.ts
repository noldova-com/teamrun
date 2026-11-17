/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { PlanWindowName } from "@noldova/teamrun.protocol";

@TestClass
export class PlanWindowNameTests {
  @TestMethod
  public usesMemberNamesAsValues(): void {
    for (const [name, value] of Object.entries(PlanWindowName))
      Assert.areEqual(name, value);
    Assert.areEqual(11, Object.values(PlanWindowName).length);
  }
}
