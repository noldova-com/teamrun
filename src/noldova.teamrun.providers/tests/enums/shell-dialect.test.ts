/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ShellDialect } from "@noldova/teamrun.providers";

@TestClass
export class ShellDialectTests {
  @TestMethod
  public namesEveryDialect(): void {
    Assert.areEqual("Posix,PowerShell,Cmd", Object.values(ShellDialect).join(","));
  }
}
