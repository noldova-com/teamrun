/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import * as api from "@noldova/teamrun.runtime";

@TestClass
export class RuntimeApiTests {
  @TestMethod
  public exportsTheCompleteCatalog(): void {
    const expected = [
      "TitleModelSetting", "ChangeGuard", "ChangeSubjects", "ChangeView", "ChatPagesRemover", "ChatTerminalsCloser", "CommandTool", "DispatchedMethod", "EventForwarder", "FileShareMethod", "GrantedAttachmentMethod", "HopLimitSetting", "IdleCompactionSetting",
      "HostedMigrations", "InProcessCliContext", "MainProcessMethod", "McpHttpEndpoint", "McpHttpTransport", "MethodFailures", "MethodTool", "ModuleDatabaseConnection", "OutsideConnectionMethod", "OutsideSessions",
      "ModuleDatabaseProvider", "ModuleDatabaseSession", "PanelTool", "PermissionAnswerer", "ProviderKindRegistryFactory", "ReplyFailureNotices", "ReplyWork", "RequestedModeMethod", "Resources", "RuntimeAppDescriptions",
      "RuntimeCommandStarter", "RuntimePart", "RuntimeException", "RuntimePartException", "ProcessNotStartedException", "RuntimeProcessStarter", "RuntimeRememberedAppGrants", "RuntimeToolSession", "RuntimeToolSessions", "SendTool", "ServedCalls", "SharedMcpAccounts", "SharedMcpOauth", "SubAgentTool",
      "SubAgentTools", "CommandTools", "TeammateCommandFolder",
      "TeamRunChange", "TeamRunChanges", "TeamRunTool", "TeamRunTools", "WindowClients", "WorkingMethod",
      "Pages", "TeamRunPagesHost"
    ];

    Assert.areEqual([...expected].sort().join(","), Object.keys(api).sort().join(","));
  }
}
