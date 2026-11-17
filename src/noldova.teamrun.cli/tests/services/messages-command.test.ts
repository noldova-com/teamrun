/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UsageException } from "@noldova/desktop.cli";
import { type Conversation, ConversationListParams, DetailKind, Message, MessageAuthor, MessagePage, MessagePageParams, MessageSender, MessageStatus }
  from "@noldova/teamrun.protocol";

import { RecordingCliContext } from "../fixtures/recording-cli-context.fixture.js";
import { SampleData } from "../fixtures/sample-data.fixture.js";

@TestClass
export class MessagesCommandTests {
  @TestMethod
  public async listsEachMessagesSequenceAuthorStatusAndText(): Promise<void> {
    const context = await RecordingCliContext.activateAsync();
    const page = new MessagePage([
      SampleData.user("m1", "c1", 0, "Check the notes"),
      SampleData.reply("m2", "c1", 1, MessageStatus.Completed, [
        SampleData.detail(0, DetailKind.Text, "Looked."), SampleData.detail(1, DetailKind.Command, "> ls"), SampleData.detail(2, DetailKind.Text, "All good.")
      ], SampleData.alice),
      SampleData.reply("m3", "c1", 2, MessageStatus.Running)
    ], true, false, 3);
    context.answer("teamrun.messagePage", () => page.toJson());

    const result = await context.runAsync("teamrun.listMessages", { chatId: "c1", limit: 20 });

    Assert.areEqual("#0 User (Completed): Check the notes\n#1 Alice (Completed): Looked. All good.\n#2 Provider (Running): ", result.text);
    Assert.areEqual(JSON.stringify(page.toJson()), JSON.stringify(result.value));
    const params = MessagePageParams.fromJson(context.payloadsOf("teamrun.messagePage")[0]);
    Assert.areEqual("c1 null null 20", `${params.conversationId} ${params.beforeSequence} ${params.afterSequence} ${params.limit}`);
  }

  @TestMethod
  public async namesAMessageATeammateSentFromAnotherChatByTheTeammateAndThatChat(): Promise<void> {
    const context = await RecordingCliContext.activateAsync();
    const sent = (id: string, sequence: number, sender: MessageSender): Message => new Message(id, "c1", sequence, MessageAuthor.User, null,
      MessageStatus.Completed, [SampleData.detail(0, DetailKind.Text, "Please review")], null, SampleData.time, null, SampleData.time, [], null, null, [], sender);
    const page = new MessagePage([
      SampleData.user("m1", "c1", 0, "Check the notes"),
      sent("m2", 1, new MessageSender("c2", "t1", "Alice")),
      sent("m3", 2, new MessageSender("c2", null, "Codex")),
      sent("m4", 3, new MessageSender("c9", "t1", "Alice")),
      sent("m5", 4, new MessageSender("c4", "t1", "Alice"))
    ], false, false, 5);
    const chats = new Map<string | null, readonly Conversation[]>([["p1", [SampleData.release]], ["p2", [SampleData.notes]], [null, [SampleData.scratch]]]);
    context.answer("teamrun.messagePage", () => page.toJson())
      .answer("teamrun.projectList", () => SampleData.listed.map(t => t.toJson()))
      .answer("teamrun.conversationList", t => (chats.get(ConversationListParams.fromJson(t).projectId) ?? []).map(u => u.toJson()));

    const result = await context.runAsync("teamrun.listMessages", { chatId: "c1", limit: 20 });

    Assert.areEqual([
      "#0 User (Completed): Check the notes",
      "#1 @Alice in chat \"Notes\" (c2) (Completed): Please review",
      "#2 the default teammate (Codex) in chat \"Notes\" (c2) (Completed): Please review",
      "#3 @Alice in a deleted chat (c9) (Completed): Please review",
      "#4 @Alice in chat \"Scratch\" (c4) (Completed): Please review"
    ].join("\n"), result.text);
  }

  @TestMethod
  public async refusesALimitOrSequenceThatIsNotAWholeNumberAsAUsageMistake(): Promise<void> {
    const context = await RecordingCliContext.activateAsync();

    const limit = await Assert.throwsAsync(() => context.runAsync("teamrun.listMessages", { chatId: "c1", limit: 2.5 }), UsageException);
    const before = await Assert.throwsAsync(() => context.runAsync("teamrun.listMessages", { chatId: "c1", before: 1.5, limit: 20 }), UsageException);

    Assert.areEqual("--limit takes a whole number.", limit.message);
    Assert.areEqual("--before takes a whole number.", before.message);
    Assert.areEqual(0, context.payloadsOf("teamrun.messagePage").length);
  }

  @TestMethod
  public async pagesBackFromTheGivenSequence(): Promise<void> {
    const context = await RecordingCliContext.activateAsync();
    context.answer("teamrun.messagePage", () => new MessagePage([], false, true, 41).toJson());

    const result = await context.runAsync("teamrun.listMessages", { chatId: "c1", before: 40, limit: 10 });

    Assert.areEqual("(none)", result.text);
    const params = MessagePageParams.fromJson(context.payloadsOf("teamrun.messagePage")[0]);
    Assert.areEqual("40 10", `${params.beforeSequence} ${params.limit}`);
  }
}
