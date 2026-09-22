/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import * as api from "@noldova/teamrun-cli";

@TestClass
export class CliApiTests {
  @TestMethod
  public exportsTheCompleteCatalog(): void {
    const expected = [
      "TeammatesCommand", "TeammateNewCommand", "TeammateUpdateCommand", "TeammateDeleteCommand", "MembersCommand", "MemberAddCommand", "MemberRemoveCommand",
      "AccountAddCommand", "AccountCheckCommand", "AccountRemoveCommand", "AccountsCommand", "ApprovalsCommand", "ApproveCommand", "CancelCommand",
      "ChatCommand", "CliApplication", "CliEntry", "CliSettings", "CommandContext", "CommandFailedException", "CommandLine", "CommandRegistry",
      "ConversationDeleteCommand", "ConversationMoveCommand", "ConversationNewCommand", "ConversationRenameCommand", "ConversationsCommand",
      "DecisionPolicy", "EntityFormatter",
      "EventSubscription", "HelpCommand", "LauncherConnectionFactory", "LauncherConnectionFactoryBuilder", "LiveCheckCommand", "LiveCheckReport",
      "MessagesCommand", "ModelsCommand", "OutputFormat", "OutputWriter", "ProjectForgetCommand", "ProjectOpenCommand", "ProjectsCommand",
      "ProvidersCommand", "RepliesFollower", "ReplyFollower", "ReplyOutcome", "Resources", "RewindCommand", "RuntimeCommand",
        "RuntimeSession", "SearchCommand", "SendCommand", "SessionListener",
      "StatusCommand", "TerminalConsole", "UsageException"
    ];

    Assert.areEqual([...expected].sort().join(","), Object.keys(api).sort().join(","));
  }
}
