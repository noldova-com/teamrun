/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeOperation } from "@noldova/context.data";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ChangeEntity } from "@noldova/teamrun.core";
import {
  Approval,
  ApprovalKind,
  ApprovalOption,
  ApprovalOutcome,
  ApprovalQuestion,
  ApprovalScope,
  ApprovalStatus,
  ConversationIdParams,
  DetailKind,
  Message,
  MessageAuthor,
  MessageDetail,
  MessageStatus,
  QuestionOption
} from "@noldova/teamrun.protocol";

import { CoreHost } from "../../fixtures/core-host.fixture.js";

@TestClass
export class ApprovalsServiceTests {
  private static readonly accept: ApprovalOption = new ApprovalOption("accept", "Allow", ApprovalOutcome.Approved, ApprovalScope.Once);

  @TestMethod
  public async insertsListsFindsAndUpdatesApprovals(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const other = await host.createConversationAsync();
    await host.messages.insertAsync(ApprovalsServiceTests.message(conversation.id, "m1"));
    await host.messages.insertAsync(ApprovalsServiceTests.message(other.id, "m2"));
    const first = ApprovalsServiceTests.approval("a1", "m1");
    const second = ApprovalsServiceTests.approval("a2", "m1");
    const elsewhere = ApprovalsServiceTests.approval("a3", "m2");

    await host.approvals.insertAsync(first);
    await host.approvals.insertAsync(second);
    await host.approvals.insertAsync(elsewhere);
    await host.approvals.updateAsync(second.withDecision("accept", "t2"));

    Assert.areEqual("a1", (await host.approvals.listAsync(new ConversationIdParams(conversation.id))).map(t => t.id).join(","));
    Assert.areEqual("a3", (await host.approvals.listAsync(new ConversationIdParams(other.id))).map(t => t.id).join(","));
    Assert.areEqual("a1", (await host.approvals.listPendingAsync("m1")).map(t => t.id).join(","));
    Assert.areEqual(ApprovalStatus.Approved, (await host.approvals.findAsync("a2"))?.status);
    Assert.isNull(await host.approvals.findAsync("nope"));
    const changes = (await host.context.database.changeFeed.readAfterAsync(0)).filter(t => t.entity === ChangeEntity.Approval);
    Assert.areEqual(4, changes.length);
    Assert.areEqual(ChangeOperation.Update, changes.at(-1)?.operation);
  }

  @TestMethod
  public async listsAConversationsQuestionsOfAnyStatusBesideItsPendingApprovals(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    await host.messages.insertAsync(ApprovalsServiceTests.message(conversation.id, "m1"));
    const question = new ApprovalQuestion("q", "Platform", "Which platform?", [new QuestionOption("Desktop app", "The window")], false, false, false);
    const asked = new Approval("a1", "m1", ApprovalKind.Question, "AskUserQuestion", "Which platform?", null, [ApprovalsServiceTests.accept],
      ApprovalStatus.Pending, null, "t", null, [question]);
    const decided = ApprovalsServiceTests.approval("a2", "m1");

    await host.approvals.insertAsync(asked);
    await host.approvals.insertAsync(decided);
    await host.approvals.updateAsync(asked.withCancellation("t2"));
    await host.approvals.updateAsync(decided.withDecision("accept", "t2"));

    Assert.areEqual("a1", (await host.approvals.listAsync(new ConversationIdParams(conversation.id))).map(t => t.id).join(","));
    Assert.areEqual(0, (await host.approvals.listPendingAsync("m1")).length);
  }

  private static message(conversationId: string, id: string): Message {
    return new Message(id, conversationId, 0, MessageAuthor.User, null, MessageStatus.Completed, [new MessageDetail(0, DetailKind.Text, "Hi", null, "t")], null, "t", null, "t");
  }

  private static approval(id: string, messageId: string): Approval {
    return new Approval(id, messageId, ApprovalKind.Command, "commandExecution", "Run", null, [ApprovalsServiceTests.accept], ApprovalStatus.Pending, null, "t", null);
  }
}
