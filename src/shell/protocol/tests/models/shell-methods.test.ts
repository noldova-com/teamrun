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
  public namesTheWorkMethod(): void {
    Assert.areEqual("shell.work", ShellMethods.work.text);
    Assert.isTrue(ShellMethods.work.isShell);
  }

  @TestMethod
  public namesTheProgramsMethod(): void {
    Assert.areEqual("shell.programs", ShellMethods.programs.text);
    Assert.isTrue(ShellMethods.programs.isShell);
  }

  @TestMethod
  public namesTheCommandMethods(): void {
    Assert.areEqual("shell.commands", ShellMethods.commands.text);
    Assert.areEqual("shell.runCommand", ShellMethods.runCommand.text);
  }

  @TestMethod
  public namesTheNotificationMethods(): void {
    Assert.areEqual(
      JSON.stringify(["shell.notifications", "shell.postNotification", "shell.updateNotification", "shell.dismissNotification", "shell.markNotificationsRead", "shell.clearNotifications"]),
      JSON.stringify([
        ShellMethods.notifications, ShellMethods.postNotification, ShellMethods.updateNotification, ShellMethods.dismissNotification,
        ShellMethods.markNotificationsRead, ShellMethods.clearNotifications
      ].map(t => t.text)));
  }

  @TestMethod
  public namesTheWindowStateMethods(): void {
    Assert.areEqual(
      JSON.stringify(["shell.readWindowBounds", "shell.writeWindowBounds", "shell.readWindowLayout", "shell.writeWindowLayout"]),
      JSON.stringify([ShellMethods.readWindowBounds, ShellMethods.writeWindowBounds, ShellMethods.readWindowLayout, ShellMethods.writeWindowLayout].map(t => t.text)));
  }

  @TestMethod
  public namesTheSettingsMethods(): void {
    Assert.areEqual("shell.settings,shell.readSetting,shell.setSetting,shell.resetSetting", [ShellMethods.settings, ShellMethods.readSetting, ShellMethods.setSetting, ShellMethods.resetSetting].map(t => t.text).join(","));
  }

  @TestMethod
  public namesTheRecentCommandsMethods(): void {
    Assert.areEqual("shell.recentCommands,shell.recordCommand", [ShellMethods.recentCommands, ShellMethods.recordCommand].map(t => t.text).join(","));
  }
}
