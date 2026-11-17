/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { CommandKind } from "@noldova/teamrun.providers";

@TestClass
export class CommandKindTests {
  @TestMethod
  public namesEveryKind(): void {
    Assert.areEqual("Search,Read,ReadStart,ReadEnd,List,ChangeFolder,Git", Object.values(CommandKind).join(","));
  }
}
