/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ShellMethods } from "@noldova/teamrun-shell-protocol";

@TestClass
export class ShellMethodsTests {
  @TestMethod
  public pinsTheCrossBuildMethodNames(): void {
    Assert.areEqual("shell.stop", ShellMethods.stop.text);
    Assert.areEqual("shell.moveAside", ShellMethods.moveAside.text);
    Assert.isTrue(ShellMethods.stop.isShell && ShellMethods.moveAside.isShell);
  }
}
