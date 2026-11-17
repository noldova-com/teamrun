/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { SharedMcpAccount } from "@noldova/teamrun.protocol";

@TestClass
export class SharedMcpAccountTests {
  @TestMethod
  public usesMemberNamesAsValues(): void {
    Assert.areEqual(JSON.stringify(["GitHub"]), JSON.stringify(Object.values(SharedMcpAccount)));
  }
}
