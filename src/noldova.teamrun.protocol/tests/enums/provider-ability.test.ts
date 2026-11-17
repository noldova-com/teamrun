/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProviderAbility } from "@noldova/teamrun.protocol";

@TestClass
export class ProviderAbilityTests {
  @TestMethod
  public usesMemberNamesAsValues(): void {
    Assert.areEqual(JSON.stringify([
      "RunTurn", "Resume", "Fork", "Compact", "Images", "Files", "SteerTurn", "ChatTitle", "ChooseModel",
      "ChooseEffort", "ChooseSpeed", "ChooseContext", "PlanMode", "ReadOnlyMode", "UnrestrictedMode", "PermissionCards", "ApprovedTools",
      "Questions", "PlanChecklist", "ReplyUsage", "PlanLimits", "SubAgentRows", "BackgroundSubAgents", "StopSubAgent", "BackgroundCommands",
      "Explorer", "GeneratedImages", "TeamRunTools", "SharedStdioServers", "SharedHttpServers", "OwnServersSwitch", "OwnServersList", "SignIn",
      "SignOut", "SeveralAccounts", "Account", "Install", "CompactCommand", "ListedCommands", "BuiltInCommands", "CustomCommands", "LogoutCommand"
    ]), JSON.stringify(Object.values(ProviderAbility)));
  }
}
