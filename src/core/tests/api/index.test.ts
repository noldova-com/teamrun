/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import * as api from "@noldova/teamrun-core";

@TestClass
export class CoreApiTests {
  @TestMethod
  public exportsTheCompleteCatalog(): void {
    const expected = [
      "ActiveRun", "ApprovalAsk", "ApprovalsService", "AttachmentStore", "ChangeEntity", "ConversationEngine", "ConversationsService", "DatabaseContext", "EventHub",
      "EventSubscription", "ForkRequest", "InitialMigration", "MessagesService", "MigrationCatalog", "ParticipantContext",
        "ProjectActivity", "ProjectsService", "ProviderAccountsService", "ProviderRegistry",
      "ProvidersService", "ReplyRun", "ReplyWork", "RequestDispatcher", "Resources", "SignInCheck", "TeammatesMigration", "TeammatesService",
      "TurnDetail", "TurnOutcome", "TurnRequest", "TurnResult", "TurnStart",
      "WorkingTree", "WorkingTreeChange"
    ];

    expected.push("DatabaseRecovery");
    Assert.areEqual(expected.sort().join(","), Object.keys(api).sort().join(","));
  }
}
