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
    Assert.areEqual("shell.modules", ShellMethods.modules.text);
    Assert.isTrue(ShellMethods.stop.isShell && ShellMethods.moveAside.isShell && ShellMethods.modules.isShell);
  }

  @TestMethod
  public namesTheCommandMethods(): void {
    Assert.areEqual("shell.commands", ShellMethods.commands.text);
    Assert.areEqual("shell.runCommand", ShellMethods.runCommand.text);
  }

  @TestMethod
  public namesTheWindowStateMethods(): void {
    Assert.areEqual(
      JSON.stringify(["shell.readWindowBounds", "shell.writeWindowBounds", "shell.readWindowLayout", "shell.writeWindowLayout"]),
      JSON.stringify([ShellMethods.readWindowBounds, ShellMethods.writeWindowBounds, ShellMethods.readWindowLayout, ShellMethods.writeWindowLayout].map(t => t.text)));
  }
}
