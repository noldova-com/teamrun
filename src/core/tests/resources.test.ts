/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Resources } from "@noldova/teamrun-core";

@TestClass
export class ResourcesTests {
  @TestMethod
  public namesTheDatabaseFileTablesAndColumns(): void {
    Assert.areEqual("teamrun.db", Resources.databaseFileName);
    Assert.areEqual("providerAccounts", Resources.providerAccountsTable);
    Assert.areEqual("updatedAt", Resources.updatedAtColumn);
    Assert.areEqual("20260908120000_Initial", Resources.initialMigrationId);
    Assert.areEqual("New conversation", Resources.defaultConversationTitle);
  }

  @TestMethod
  public composesTheServiceMessages(): void {
    Assert.areEqual("The approval \"a\" does not exist.", Resources.formatApprovalNotFound("a"));
    Assert.areEqual("The approval \"a\" has already been decided.", Resources.formatApprovalNotPending("a"));
    Assert.areEqual("The conversation \"c\" does not exist.", Resources.formatConversationNotFound("c"));
    Assert.areEqual("The message \"m\" does not exist.", Resources.formatMessageNotFound("m"));
    Assert.areEqual("The message \"m\" is not a running reply.", Resources.formatMessageNotOpen("m"));
    Assert.areEqual("The profile directory \"x\" is not absolute.", Resources.formatProfileDirNotAbsolute("x"));
    Assert.areEqual("Shared working-tree changes (may include other conversations or tools): a.ts, b.ts", Resources.formatWorkingTreeChanges("a.ts, b.ts"));
    Assert.areEqual("--- /dev/null\n+++ b/a.ts\n@@ -0,0 +1,2 @@\n+x\n+y", Resources.formatAddedFileDiff("a.ts", ["x", "y"]));
    Assert.areEqual("m-3.png", Resources.formatImageFileName("m", 3, ".png"));
    Assert.areEqual("The project \"p\" does not exist.", Resources.formatProjectNotFound("p"));
    Assert.areEqual("The provider account \"a\" does not belong to the provider \"codex\".", Resources.formatProviderAccountMismatch("a", "codex"));
    Assert.areEqual("The provider account \"a\" does not exist.", Resources.formatProviderAccountNotFound("a"));
    Assert.areEqual("The provider \"codex\" is already registered.", Resources.formatProviderAlreadyRegistered("codex"));
    Assert.areEqual("The provider \"codex\" is not registered.", Resources.formatProviderNotRegistered("codex"));
    Assert.areEqual("The conversation \"c\" already has a reply in progress.", Resources.formatReplyInProgress("c"));
    Assert.areEqual("The root path \"x\" is not absolute.", Resources.formatRootPathNotAbsolute("x"));
    Assert.areEqual("The provider's turn failed: boom", Resources.formatTurnFailed("boom"));
    Assert.areEqual("The approval \"a\" offers no option \"o\".", Resources.formatUnknownDecisionOption("a", "o"));
    Assert.areEqual("The method \"x\" is not part of the protocol.", Resources.formatUnknownMethod("x"));
  }
}
