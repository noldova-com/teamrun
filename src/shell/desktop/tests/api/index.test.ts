/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import * as api from "@noldova/teamrun-shell-desktop";

@TestClass
export class DesktopApiTests {
  @TestMethod
  public exportsTheCompleteRuntimeSurface(): void {
    Assert.areEqual(
      JSON.stringify([
        "ChildProgramHost",
        "CloseCoordinator",
        "DesktopApplication",
        "DesktopLog",
        "DesktopSettings",
        "DetachedStart",
        "DetachedStartReply",
        "DetachedStartRequest",
        "DeviceFileStore",
        "DeviceIdentity",
        "DeviceIdentityException",
        "LinkPolicy",
        "MainProcessFailureKind",
        "MainProcessRecovery",
        "OneTimeHints",
        "OpenWindow",
        "PathCommand",
        "PathCommandException",
        "PathCommandOutcome",
        "ProgramException",
        "QuitChoice",
        "QuitCoordinator",
        "QuitFlow",
        "QuitOutcome",
        "QuitQuestion",
        "RuntimeStartup",
        "RuntimeWindowStateStore",
        "ScreenArea",
        "SenderInfo",
        "SenderPolicy",
        "SpellChecker",
        "SpellingDictionaries",
        "StartedProgram",
        "StartupState",
        "StartupStateKind",
        "SystemNotifier",
        "TaskbarIdentity",
        "TrayHostWatcher",
        "UtilityProcessStarter",
        "WindowAppearance",
        "WindowBoundsKeeper",
        "WindowErrorAdmission",
        "WindowErrorLimit",
        "WindowRecovery",
        "WindowState",
        "WindowStateException",
        "WindowStateUnavailableException"
      ]),
      JSON.stringify(Object.keys(api).sort()));
  }
}
