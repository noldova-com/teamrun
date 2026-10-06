/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as api from "@noldova/teamrun-shell-protocol";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class ProtocolApiTests {
  @TestMethod
  public exportsTheCompleteCatalog(): void {
    const exportNames = [
      "BuildIdentity", "Cancel", "CommandInfo", "CommandList", "CommandRun", "Event", "Failure", "FailureCode", "FrameReader", "FrameWriter", "Handshake", "KeptRuntime", "KeyChord", "KeyName", "ModuleState", "ModuleStatus", "ModuleStatusList", "Notification", "NotificationAction", "NotificationBroadcast",
      "NotificationList", "NotificationPost", "NotificationReference", "NotificationState", "NotificationSeverity", "NotificationUpdate", "NotificationsQuery", "PreShellData", "ProgramStatus", "ProgramStatusList",
      "ProtocolException", "QualifiedName", "RecentCommandUse", "RecentCommands", "RecentCommandsQuery", "Request", "Response", "RunningWork", "RuntimeHandover", "SettingChange", "SettingDefinition", "SettingEntry", "SettingKey", "SettingKind", "SettingLocality", "SettingOption",
      "SettingScope", "SettingType", "SettingValue", "SettingsQuery", "SettingsSnapshot", "ShellEvents", "ShellMethods", "ShellNotifications", "StopPolicy", "StopRequest", "UpdateProcess", "UpdateReady", "UpdateRequest", "UpdateSaved", "WindowStateKey", "WindowStateValue", "WindowStateWrite", "WireContract", "WireDecoder", "WireMessage", "WireMessageKind", "WorkReport"
    ];

    Assert.areEqual(exportNames.sort().join(","), Object.keys(api).sort().join(","));
  }
}
