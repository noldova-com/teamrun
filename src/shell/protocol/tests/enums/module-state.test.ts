/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ModuleState } from "@noldova/teamrun-shell-protocol";

@TestClass
export class ModuleStateTests {
  @TestMethod
  public namesEveryStateByItsMember(): void {
    Assert.areEqual("Active,Failed,Blocked", Object.values(ModuleState).join(","));
  }
}
