/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ShellEvents } from "@noldova/teamrun-shell-protocol";

@TestClass
export class ShellEventsTests {
  @TestMethod
  public namesTheNotificationsEvent(): void {
    Assert.areEqual("shell.notifications", ShellEvents.notifications.text);
    Assert.isTrue(ShellEvents.notifications.isShell);
  }

  @TestMethod
  public namesTheSettingsEvent(): void {
    Assert.areEqual("shell.settingsChanged", ShellEvents.settingsChanged.text);
  }

  @TestMethod
  public namesTheWorkEvent(): void {
    Assert.areEqual("shell.work", ShellEvents.work.text);
  }

  @TestMethod
  public namesTheUpdateEvents(): void {
    Assert.areEqual("shell.updating|shell.updateEnded", [ShellEvents.updating.text, ShellEvents.updateEnded.text].join("|"));
  }

  @TestMethod
  public namesTheQuitEvent(): void {
    Assert.areEqual("shell.quitting", ShellEvents.quitting.text);
  }

  @TestMethod
  public namesTheCommandsEvent(): void {
    Assert.areEqual("shell.commandsChanged", ShellEvents.commandsChanged.text);
  }

  @TestMethod
  public namesTheProgramsEvent(): void {
    Assert.areEqual("shell.programsChanged", ShellEvents.programsChanged.text);
  }

  @TestMethod
  public namesTheRecentCommandsEvent(): void {
    Assert.areEqual("shell.recentCommandsChanged", ShellEvents.recentCommandsChanged.text);
  }
}
