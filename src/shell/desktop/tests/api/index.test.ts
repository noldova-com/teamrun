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
        "AppearanceStore",
        "CloseCoordinator",
        "DesktopApplication",
        "DesktopLog",
        "DesktopSettings",
        "DetachedStart",
        "DetachedStartReply",
        "DetachedStartRequest",
        "DeviceIdentity",
        "DeviceIdentityException",
        "OpenWindow",
        "RuntimeStartup",
        "RuntimeWindowStateStore",
        "ScreenArea",
        "SenderInfo",
        "SenderPolicy",
        "StartupState",
        "StartupStateKind",
        "SystemNotifier",
        "TaskbarIdentity",
        "UtilityProcessStarter",
        "WindowAppearance",
        "WindowBoundsKeeper",
        "WindowRecovery",
        "WindowState",
        "WindowStateException",
        "WindowStateUnavailableException"
      ]),
      JSON.stringify(Object.keys(api).sort()));
  }
}
