/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ShellTokenKind } from "@noldova/teamrun.providers";

@TestClass
export class ShellTokenKindTests {
  @TestMethod
  public namesEveryKind(): void {
    Assert.areEqual("Word,Separator,Redirect,Open,Close", Object.values(ShellTokenKind).join(","));
  }
}
