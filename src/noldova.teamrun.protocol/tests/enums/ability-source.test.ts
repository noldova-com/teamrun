/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AbilitySource } from "@noldova/teamrun.protocol";

@TestClass
export class AbilitySourceTests {
  @TestMethod
  public usesMemberNamesAsValues(): void {
    Assert.areEqual(JSON.stringify(["Acp", "AcpAddition", "Outside"]), JSON.stringify(Object.values(AbilitySource)));
  }
}
