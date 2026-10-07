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
        "AppImageHandoff",
        "AppImageReplacement",
        "AppImageRestart",
        "ChildProgramHost",
        "CloseCoordinator",
        "DesktopApplication",
        "DesktopLog",
        "DesktopRecord",
        "DesktopSettings",
        "DetachedStart",
        "DetachedStartReply",
        "DetachedStartRequest",
        "DeviceFileStore",
        "DeviceIdentity",
        "DeviceIdentityException",
        "DeviceState",
        "FeedProvider",
        "FeedSource",
        "FeedUpdater",
        "InstallerHandoff",
        "InstallerStart",
        "LinkPolicy",
        "MainProcessFailureKind",
        "MainProcessRecovery",
        "OpenWindow",
        "PathCommand",
        "PathCommandException",
        "PathCommandOutcome",
        "ProgramException",
        "PublisherCheck",
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
        "ShipItProcess",
        "SpellChecker",
        "SpellingDictionaries",
        "SquirrelHandoff",
        "StaleUpdateException",
        "StartedProgram",
        "StartupState",
        "StartupStateKind",
        "SystemNotifier",
        "TaskbarIdentity",
        "TrayHostWatcher",
        "UpdateBarrierGate",
        "UpdateBarrierWatch",
        "UpdateCheckLock",
        "UpdateController",
        "UpdateException",
        "UpdateHandoffException",
        "UpdateReadyRecord",
        "UpdateSaveCoordinator",
        "UpdateStateKind",
        "UpdateStatus",
        "UpdateStop",
        "UpdateStopException",
        "UpdateWorkQuestion",
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
