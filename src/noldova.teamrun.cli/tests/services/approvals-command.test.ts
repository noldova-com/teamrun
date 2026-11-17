/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ApprovalStatus, ConversationIdParams } from "@noldova/teamrun.protocol";

import { RecordingCliContext } from "../fixtures/recording-cli-context.fixture.js";
import { SampleData } from "../fixtures/sample-data.fixture.js";

@TestClass
export class ApprovalsCommandTests {
  @TestMethod
  public async listsAChatsApprovalsOrOnlyThePendingOnes(): Promise<void> {
    const context = await RecordingCliContext.activateAsync();
    context.answer("teamrun.approvalList", () => [SampleData.approval("q1", ApprovalStatus.Approved).toJson(), SampleData.approval("q2", ApprovalStatus.Pending).toJson()]);

    const all = await context.runAsync("teamrun.listApprovals", { chatId: "c1" });
    const pending = await context.runAsync("teamrun.listApprovals", { chatId: "c1", pending: true });

    Assert.areEqual("q1  Approved  Run npm test  allow (Allow), deny (Deny)\nq2  Pending  Run npm test  allow (Allow), deny (Deny)", all.text);
    Assert.areEqual("q2  Pending  Run npm test  allow (Allow), deny (Deny)", pending.text);
    Assert.areEqual("c1", ConversationIdParams.fromJson(context.payloadsOf("teamrun.approvalList")[0]).conversationId);
  }
}
