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
      "BuildIdentity", "Cancel", "CommandInfo", "CommandList", "CommandRun", "Event", "Failure", "FailureCode", "FrameReader", "FrameWriter", "Handshake", "KeyChord", "KeyName", "ModuleState", "ModuleStatus", "ModuleStatusList", "Notification", "NotificationAction",
      "NotificationList", "NotificationPost", "NotificationReference", "NotificationSeverity", "NotificationUpdate", "PreShellData",
      "ProtocolException", "QualifiedName", "Request", "Response", "RunningWork", "RuntimeHandover", "ShellEvents", "ShellMethods", "StopPolicy", "StopRequest", "WindowStateKey", "WindowStateValue", "WindowStateWrite", "WireContract", "WireDecoder", "WireMessage", "WireMessageKind"
    ];

    Assert.areEqual(exportNames.sort().join(","), Object.keys(api).sort().join(","));
  }
}
