/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import { ChangeOperation } from "@noldova/context.data";
import { SqlQuery } from "@noldova/context.data.sql";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ChangeEntity, Resources } from "@noldova/teamrun.core";
import {
  ContextUsage,
  ConversationMemberParams,
  DetailKind,
  Harness,
  Message,
  MessageAttachment,
  MessageAuthor,
  MessageDetail,
  MessageListParams,
  MessagePageParams,
  MessageStatus,
  ObservedSettings,
  Provenance,
  RequestedSettings,
  type ReplyPage,
  ReplyPanel,
  ReplyPlan,
  ReplyUsage,
  TeammateCreateParams
} from "@noldova/teamrun.protocol";

import { CoreHost } from "../../fixtures/core-host.fixture.js";

@TestClass
export class MessagesServiceTests {
  @TestMethod
  public async pagesMatchingRepliesWithSmallSummariesAndExclusiveCursors(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const activity: number[] = [];
    const changes: number[] = [];
    for (let i = 0; i < 180; i++) {
      const details = [new MessageDetail(0, DetailKind.Text, "answer".repeat(100), null, "t")];
      if (i % 3 === 0) {
        details.push(new MessageDetail(1, DetailKind.Command, "$ run\n" + "output".repeat(1000), null, "t"));
        activity.push(i);
      }
      if (i % 10 === 0) {
        details.push(new MessageDetail(2, DetailKind.FileChange, "changes", { source: "workingTree", changes: [{ path: "a.ts", diff: "-old\n+new" }] }, "t"));
        changes.push(i);
      }
      await host.messages.insertAsync(MessagesServiceTests.reply(conversation.id, i, MessageStatus.Running).withDetails(details).withStatus(MessageStatus.Completed, "t2"));
    }
    for (const [panel, sequences] of [[ReplyPanel.Activity, activity], [ReplyPanel.Changes, changes]] as const) {
      const newest = await host.messages.replyPageAsync(new MessagePageParams(conversation.id, null, null, 5), panel);
      Assert.areEqual(sequences.slice(-5).toReversed().join(","), newest.replies.map(t => t.preview.sequence).join(","));
      Assert.isTrue(newest.hasEarlier);
      Assert.isFalse(newest.hasLater);
      const cursor = newest.replies.at(-1)?.preview.sequence ?? 0;
      const older = await host.messages.replyPageAsync(new MessagePageParams(conversation.id, cursor, null, 5), panel);
      Assert.areEqual(sequences.slice(-10, -5).toReversed().join(","), older.replies.map(t => t.preview.sequence).join(","));
      Assert.isTrue(older.hasLater);
      const newer = await host.messages.replyPageAsync(new MessagePageParams(conversation.id, null, older.replies[0]?.preview.sequence ?? 0, 2), panel);
      Assert.areEqual(sequences.slice(-5, -3).toReversed().join(","), newer.replies.map(t => t.preview.sequence).join(","));
      Assert.isTrue(newer.hasEarlier);
      Assert.isTrue(newer.hasLater);
      const earliest = await host.messages.replyPageAsync(new MessagePageParams(conversation.id, 1, null, 50), panel);
      Assert.areEqual(1, earliest.replies.length);
      Assert.isFalse(earliest.hasEarlier);
      const empty = await host.messages.replyPageAsync(new MessagePageParams(conversation.id, 0, null, 50), panel);
      Assert.areEqual(0, empty.replies.length);
      Assert.isFalse(empty.hasLater);
      Assert.isFalse(JSON.stringify(newest.toJson()).includes("outputoutput"));
      Assert.isFalse(JSON.stringify(newest.toJson()).includes("-old"));
    }
  }

  @TestMethod
  public async matchesClaudeEditsAndExcludesOtherConversationsImagesAndMalformedChanges(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const details = [new MessageDetail(0, DetailKind.FileChange, "Bad changes", { changes: ["junk", 5, {}, { path: " " }] }, "t"),
      new MessageDetail(1, DetailKind.Note, "Image", { itemType: "imageGeneration" }, "t"),
      new MessageDetail(2, DetailKind.Error, "failed", null, "t"),
      new MessageDetail(3, DetailKind.FileChange, "Write", { tool: "Write", input: { file_path: "x", content: "a\nb" } }, "t")];
    await host.messages.insertAsync(MessagesServiceTests.reply(conversation.id, 1, MessageStatus.Running).withDetails(details));
    await host.messages.insertAsync(MessagesServiceTests.reply(conversation.id, 2, MessageStatus.Running).withDetails(details.slice(1, 2)).withStatus(MessageStatus.Completed, "t2"));
    await host.messages.insertAsync(MessagesServiceTests.userMessage(conversation.id, 3, "text"));
    const page = await host.messages.replyPageAsync(new MessagePageParams(conversation.id, null, null, 50), ReplyPanel.Changes);
    Assert.areEqual(1, page.replies.length);
    Assert.areEqual(2, page.replies[0]?.files[0]?.additions);
    Assert.areEqual(1, (await host.messages.replyPageAsync(new MessagePageParams(conversation.id, null, null, 50), ReplyPanel.Activity)).replies.length);
    Assert.areEqual(0, (await host.messages.replyPageAsync(new MessagePageParams("different", null, null, 50), ReplyPanel.Changes)).replies.length);
  }

  @TestMethod
  public async matchesAClaudeNotebookEditByTheNotebookItNames(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const inputs: JsonValue[] = [{ notebook_path: "/elsewhere/n.ipynb", new_source: "a\nb" }, { file_path: "n.ipynb", new_source: "a" },
      { notebook_path: " ", new_source: "a" }, { notebook_path: 5 }];
    for (const [i, input] of inputs.entries())
      await host.messages.insertAsync(MessagesServiceTests.reply(conversation.id, i + 1, MessageStatus.Running)
        .withDetails([new MessageDetail(0, DetailKind.FileChange, "NotebookEdit", { tool: "NotebookEdit", input }, "t")]).withStatus(MessageStatus.Completed, "t2"));

    const page = await host.messages.replyPageAsync(new MessagePageParams(conversation.id, null, null, 50), ReplyPanel.Changes);

    Assert.areEqual("1", page.replies.map(t => t.preview.sequence).join());
    Assert.areEqual("/elsewhere/n.ipynb:update:2", page.replies[0]?.files.map(t => `${t.path}:${t.kind}:${t.additions}`).join());
  }

  @TestMethod
  public async pagesAChangesNoteAsAChangeAndSaysWhetherAnEndedReplyOfTheChatRanACommand(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const other = await host.createConversationAsync();
    const ended = (conversationId: string, sequence: number, details: readonly MessageDetail[]): Message =>
      MessagesServiceTests.reply(conversationId, sequence, MessageStatus.Running).withDetails(details).withStatus(MessageStatus.Completed, "t2");
    const page = (conversationId: string, panel: ReplyPanel): Promise<ReplyPage> => host.messages.replyPageAsync(new MessagePageParams(conversationId, null, null, 50), panel);
    const command = new MessageDetail(0, DetailKind.Command, "> ls", { command: "ls", cwd: "/tmp" }, "t");
    const note = (outside: boolean): MessageDetail => new MessageDetail(1, DetailKind.Note, "Commands ran in /tmp", { source: "workingTree", changesNote: outside }, "t");
    await host.messages.insertAsync(ended(conversation.id, 1, [new MessageDetail(0, DetailKind.FileChange, "Write", { tool: "Write", input: { file_path: "x", content: "a" } }, "t")]));
    await host.messages.insertAsync(new Message("msg-9", other.id, 1, MessageAuthor.User, null, MessageStatus.Completed, [command], null, "t", null, "t"));

    Assert.isFalse((await page(conversation.id, ReplyPanel.Changes)).ranCommands);
    Assert.isFalse((await page(other.id, ReplyPanel.Changes)).ranCommands);
    await host.messages.insertAsync(MessagesServiceTests.reply(other.id, 2, MessageStatus.Running).withDetails([command]));
    Assert.isFalse((await page(other.id, ReplyPanel.Changes)).ranCommands);
    await host.messages.insertAsync(ended(conversation.id, 3, [command, note(false)]));
    await host.messages.insertAsync(ended(conversation.id, 4, [command, note(true)]));
    await host.messages.insertAsync(ended(other.id, 5, [command]));

    const changes = await page(conversation.id, ReplyPanel.Changes);
    Assert.areEqual("reply-4,reply-1", changes.replies.map(t => t.preview.id).join(","));
    Assert.isTrue(changes.ranCommands);
    Assert.isFalse((await page(conversation.id, ReplyPanel.Activity)).ranCommands);
    Assert.areEqual("0:true", [await page(other.id, ReplyPanel.Changes)].map(t => `${t.replies.length}:${t.ranCommands}`).join(","));
  }

  @TestMethod
  public async pagesTheRepliesWithAPlanAndLeavesAPlanAloneOutOfTheActivity(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const plan = (sequence: number, payload: JsonValue): MessageDetail => new MessageDetail(sequence, DetailKind.Plan, "plan", payload, "t");
    const checklist = { steps: [{ text: "Read", status: "Pending", activeText: null }], explanation: null };
    const replies = [
      [new MessageDetail(0, DetailKind.Text, "answer", null, "t"), plan(1, { ...checklist, text: null })],
      [plan(0, { steps: [], explanation: null, text: "# Move the cache" })],
      [plan(0, { steps: [], explanation: null, text: " " }), plan(1, { steps: [], explanation: null })],
      [plan(0, { steps: [], explanation: null, text: 5 })],
      [plan(0, checklist), new MessageDetail(1, DetailKind.Command, "> ls", null, "t")]];
    for (const [i, details] of replies.entries())
      await host.messages.insertAsync(MessagesServiceTests.reply(conversation.id, i + 1, MessageStatus.Running).withDetails(details));
    await host.messages.insertAsync(MessagesServiceTests.userMessage(conversation.id, 6, "text"));
    const ids = async (panel: ReplyPanel): Promise<string> => (await host.messages.replyPageAsync(new MessagePageParams(conversation.id, null, null, 50), panel)).replies.map(t => t.preview.id).join(",");

    Assert.areEqual("reply-5,reply-2,reply-1", await ids(ReplyPanel.Plan));
    Assert.areEqual("reply-5", await ids(ReplyPanel.Activity));
    Assert.areEqual("Move the cache", ReplyPlan.ofDetails((await host.messages.replyPageAsync(new MessagePageParams(conversation.id, 3, null, 1), ReplyPanel.Plan))
      .replies[0]!.preview.details)?.title);
  }

  @TestMethod
  public async countsASubAgentInTheActivityButItsOwnStepsAndPlanOnlyThroughTheirFileChanges(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const answer = new MessageDetail(0, DetailKind.Text, "answer", null, "t");
    const nested = (sequence: number, kind: DetailKind, payload: JsonValue): MessageDetail => new MessageDetail(sequence, kind, "step", payload, "t", 0);
    const agent = { toolUseId: "t1", type: null, description: "Explore", model: null, status: "Running", isBackground: false, toolUses: null, tokens: null,
      durationMs: null, summary: null };
    await host.messages.insertAsync(MessagesServiceTests.reply(conversation.id, 1, MessageStatus.Running).withDetails([answer,
      new MessageDetail(1, DetailKind.SubAgent, "Explore", agent, "t")]));
    await host.messages.insertAsync(MessagesServiceTests.reply(conversation.id, 2, MessageStatus.Running).withDetails([answer, nested(1, DetailKind.Command, null),
      nested(2, DetailKind.Plan, { steps: [{ text: "Read", status: "Pending", activeText: null }], explanation: null, text: "# Its plan" }),
      nested(3, DetailKind.FileChange, { changes: [{ path: "a.ts", kind: "update", diff: "+a" }] })]));
    const ids = async (panel: ReplyPanel): Promise<string> => (await host.messages.replyPageAsync(new MessagePageParams(conversation.id, null, null, 50), panel)).replies.map(t => t.preview.id).join(",");

    Assert.areEqual("reply-1||reply-2", (await Promise.all([ReplyPanel.Activity, ReplyPanel.Plan, ReplyPanel.Changes].map(t => ids(t)))).join("|"));
  }

  @TestMethod
  public async pagesTheRepliesThatStartedASubAgentThemselvesWithTheSubAgentWholeNewestFirst(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const answer = new MessageDetail(0, DetailKind.Text, "answer", null, "t");
    const agent = (description: string): JsonValue => ({ toolUseId: "t1", type: "Explore", description, model: "haiku", status: "Completed", isBackground: false,
      toolUses: 14, tokens: 38200, durationMs: 72000, summary: "Found it." });
    await host.messages.insertAsync(MessagesServiceTests.reply(conversation.id, 1, MessageStatus.Running).withDetails([answer,
      new MessageDetail(1, DetailKind.SubAgent, "Explore", agent("Find the parser"), "t")]).withStatus(MessageStatus.Completed, "t2"));
    await host.messages.insertAsync(MessagesServiceTests.reply(conversation.id, 2, MessageStatus.Running).withDetails([answer,
      new MessageDetail(1, DetailKind.Command, "> ls", null, "t"), new MessageDetail(2, DetailKind.SubAgent, "Explore", agent("Nested"), "t", 1)])
      .withStatus(MessageStatus.Completed, "t2"));
    await host.messages.insertAsync(MessagesServiceTests.reply(conversation.id, 3, MessageStatus.Running).withDetails([answer]).withStatus(MessageStatus.Completed, "t2"));
    await host.messages.insertAsync(MessagesServiceTests.reply(conversation.id, 4, MessageStatus.Running).withDetails([
      new MessageDetail(0, DetailKind.SubAgent, "Explore", agent("Read the store"), "t")]));
    const page = (before: number | null, size: number): Promise<ReplyPage> =>
      host.messages.replyPageAsync(new MessagePageParams(conversation.id, before, null, size), ReplyPanel.SubAgents);

    Assert.areEqual("reply-4,reply-1", (await page(null, 50)).replies.map(t => t.preview.id).join(","));
    Assert.areEqual("reply-4|true", `${(await page(null, 1)).replies.map(t => t.preview.id).join(",")}|${(await page(null, 1)).hasEarlier}`);
    Assert.areEqual("reply-1|false", `${(await page(4, 1)).replies.map(t => t.preview.id).join(",")}|${(await page(4, 1)).hasEarlier}`);
    Assert.areEqual(JSON.stringify(agent("Find the parser")), JSON.stringify((await page(4, 1)).replies[0]?.preview.details.find(t => t.kind === DetailKind.SubAgent)?.payload));
  }

  @TestMethod
  public async listsTheMessagesWithASubAgentStillRunning(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const agent = (status: string): MessageDetail => new MessageDetail(0, DetailKind.SubAgent, "Explore", { toolUseId: null, type: null, description: "Explore",
      model: null, status, isBackground: true, toolUses: null, tokens: null, durationMs: null, summary: null }, "t");
    await host.messages.insertAsync(MessagesServiceTests.reply(conversation.id, 1, MessageStatus.Running).withDetails([agent("Completed")]).withStatus(MessageStatus.Completed, "t2"));
    await host.messages.insertAsync(MessagesServiceTests.reply(conversation.id, 2, MessageStatus.Running).withDetails([agent("Running")]).withStatus(MessageStatus.Completed, "t2"));
    await host.messages.insertAsync(MessagesServiceTests.reply(conversation.id, 3, MessageStatus.Running).withDetails([new MessageDetail(0, DetailKind.Note, "Explore",
      { status: "Running" }, "t")]));

    Assert.areEqual("reply-2", (await host.messages.listWithRunningSubAgentsAsync()).map(t => t.id).join());
  }

  @TestMethod
  public async leavesACancelledReplyWhoseOnlyStepIsItsStoredCancelNoteOutOfTheActivity(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const note = (sequence: number, text: string): MessageDetail => new MessageDetail(sequence, DetailKind.Note, text, null, "t");
    const reply = (sequence: number, status: MessageStatus, details: readonly MessageDetail[]): Message =>
      MessagesServiceTests.reply(conversation.id, sequence, MessageStatus.Running).withDetails(details).withStatus(status, "t2");
    await host.messages.insertAsync(reply(1, MessageStatus.Cancelled, [note(0, "The reply was cancelled.")]));
    await host.messages.insertAsync(reply(2, MessageStatus.Cancelled, [new MessageDetail(0, DetailKind.Text, "partial", null, "t"), note(1, "Cancelled before this participant started.")]));
    await host.messages.insertAsync(reply(3, MessageStatus.Cancelled, [new MessageDetail(0, DetailKind.Command, "> ls", null, "t"), note(1, "The reply was cancelled.")]));
    await host.messages.insertAsync(reply(4, MessageStatus.Completed, [note(0, "The reply was cancelled.")]));

    const page = await host.messages.replyPageAsync(new MessagePageParams(conversation.id, null, null, 50), ReplyPanel.Activity);
    Assert.areEqual("reply-3,reply-4", page.replies.map(t => t.preview.id).sort().join(","));
  }

  @TestMethod
  public async persistsStreamProgressWithoutKeepingEveryGrowingCopyInTheFeed(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    await host.messages.insertAsync(MessagesServiceTests.userMessage(conversation.id, 0, "Hi"));
    let reply = MessagesServiceTests.reply(conversation.id, 1, MessageStatus.Running);
    await host.messages.insertAsync(reply);
    for (let i = 0; i < 100; i++) {
      reply = reply.withDetails([new MessageDetail(0, DetailKind.Text, "x".repeat(i + 1), null, "t")]);
      await host.messages.updateAsync(reply);
    }
    Assert.areEqual(100, (await host.messages.findAsync(reply.id))?.details[0]?.text.length);
    await host.messages.updateAsync(reply.withStatus(MessageStatus.Completed, "t2"));
    const changes = (await host.context.database.changeFeed.readAfterAsync(0)).filter(t => t.entity === ChangeEntity.Message);
    Assert.areEqual(3, changes.length);
    Assert.areEqual(MessageStatus.Completed, (await host.messages.findAsync(reply.id))?.status);
  }

  @TestMethod
  public async insertsListsAndFindsMessagesInSequenceOrder(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const first = MessagesServiceTests.userMessage(conversation.id, 0, "First");
    const second = MessagesServiceTests.userMessage(conversation.id, 1, "Second");

    Assert.areEqual(0, await host.messages.nextSequenceAsync(conversation.id));
    await host.messages.insertAsync(second);
    await host.messages.insertAsync(first);

    Assert.areEqual(2, await host.messages.nextSequenceAsync(conversation.id));
    Assert.areEqual("First,Second", (await host.messages.listAsync(new MessageListParams(conversation.id, null))).map(t => t.details[0]?.text).join(","));
    Assert.areEqual("Second", (await host.messages.listAsync(new MessageListParams(conversation.id, 0)))[0]?.details[0]?.text);
    Assert.areEqual("First", (await host.messages.findAsync(first.id))?.details[0]?.text);
    Assert.isNull(await host.messages.findAsync("nope"));
    Assert.areEqual(2, (await host.context.database.changeFeed.readAfterAsync(0)).filter(t => t.entity === ChangeEntity.Message && t.operation === ChangeOperation.Insert).length);
  }

  @TestMethod
  public async listsOnlyTheDetailsOfTheKindsAsked(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    await host.messages.insertAsync(MessagesServiceTests.userMessage(conversation.id, 0, "Hi"));

    const texts = await host.messages.listAsync(new MessageListParams(conversation.id, null, [DetailKind.Text]));
    const notes = await host.messages.listAsync(new MessageListParams(conversation.id, null, [DetailKind.Note]));

    Assert.areEqual(1, texts[0]?.details.length);
    Assert.areEqual(0, notes[0]?.details.length);
  }

  @TestMethod
  public async listsOutlinesWithoutDetails(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    await host.messages.insertAsync(MessagesServiceTests.userMessage(conversation.id, 0, "Hi"));
    await host.messages.insertAsync(MessagesServiceTests.reply(conversation.id, 1, MessageStatus.Running));
    await host.messages.insertAsync(MessagesServiceTests.userMessage(conversation.id, 2, "Again"));

    const all = await host.messages.listOutlinesAsync(conversation.id, null);
    const after = await host.messages.listOutlinesAsync(conversation.id, 0);

    Assert.areEqual("msg-0,reply-1,msg-2", all.map(t => t.id).join(","));
    Assert.areEqual(0, all.flatMap(t => t.details).length);
    Assert.areEqual(MessageAuthor.Provider, all[1]?.author);
    Assert.areEqual("fake", all[1]?.provenance?.requested.kind);
    Assert.areEqual("reply-1,msg-2", after.map(t => t.id).join(","));
    Assert.areEqual("Hi", (await host.messages.listAsync(new MessageListParams(conversation.id, null)))[0]?.details[0]?.text);
  }

  @TestMethod
  public async pagesTheNewestMessagesAndAroundACursor(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    for (let i = 0; i < 5; i++)
      await host.messages.insertAsync(MessagesServiceTests.userMessage(conversation.id, i, `M${i}`));
    const texts = (page: { messages: readonly { details: readonly { text: string }[] }[] }): string => page.messages.map(t => t.details[0]?.text).join(",");

    const newest = await host.messages.pageAsync(new MessagePageParams(conversation.id, null, null, 2));
    const before = await host.messages.pageAsync(new MessagePageParams(conversation.id, 3, null, 2));
    const after = await host.messages.pageAsync(new MessagePageParams(conversation.id, null, 1, 10));
    const all = await host.messages.pageAsync(new MessagePageParams(conversation.id, null, null, 10));
    const none = await host.messages.pageAsync(new MessagePageParams(conversation.id, 0, null, 10));

    Assert.areEqual("M3,M4", texts(newest));
    Assert.isTrue(newest.hasEarlier);
    Assert.isFalse(newest.hasLater);
    Assert.areEqual("M1,M2", texts(before));
    Assert.isTrue(before.hasEarlier);
    Assert.isTrue(before.hasLater);
    Assert.areEqual("M2,M3,M4", texts(after));
    Assert.isTrue(after.hasEarlier);
    Assert.isFalse(after.hasLater);
    Assert.areEqual(5, all.messages.length);
    Assert.isFalse(all.hasEarlier);
    Assert.areEqual(0, none.messages.length);
    Assert.isFalse(none.hasEarlier);
    Assert.isFalse(none.hasLater);
    Assert.areEqual("5,5,5,5,5", [newest, before, after, all, none].map(t => t.count).join(","));
    Assert.areEqual(0, (await host.messages.pageAsync(new MessagePageParams("different", null, null, 10))).count);
  }

  @TestMethod
  public async findsTheOpenReplyAndUpdatesMessages(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const reply = MessagesServiceTests.reply(conversation.id, 1, MessageStatus.Pending);
    await host.messages.insertAsync(MessagesServiceTests.userMessage(conversation.id, 0, "Hi"));
    await host.messages.insertAsync(reply);

    Assert.areEqual(reply.id, (await host.messages.findOpenReplyAsync(conversation.id))?.id);
    await host.messages.updateAsync(reply.withStatus(MessageStatus.Completed, "t2"));

    Assert.isNull(await host.messages.findOpenReplyAsync(conversation.id));
    Assert.areEqual(MessageStatus.Completed, (await host.messages.findAsync(reply.id))?.status);
    Assert.areEqual(ChangeOperation.Update, (await host.context.database.changeFeed.readAfterAsync(0)).at(-1)?.operation);
  }

  @TestMethod
  public async findsAnAttachmentOnlyInTheConversationWhoseMessageHoldsIt(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const other = await host.createConversationAsync(await host.openProjectAsync("beta"));
    const notes = new MessageAttachment("notes.txt", "text/plain", 5, "/data/attachments/notes.txt");
    const image = new MessageAttachment("picture.png", "image/png", 3, "/data/attachments/picture.png");
    await host.messages.insertAsync(new Message("msg-0", conversation.id, 0, MessageAuthor.User, null, MessageStatus.Completed, [], null, "t", null, "t", [notes, image]));
    await host.messages.insertAsync(MessagesServiceTests.userMessage(conversation.id, 1, "No files"));

    Assert.areEqual(JSON.stringify(image.toJson()), JSON.stringify((await host.messages.findAttachmentAsync(conversation.id, image.path))?.toJson()));
    Assert.areEqual(JSON.stringify(notes.toJson()), JSON.stringify((await host.messages.findAttachmentAsync(conversation.id, notes.path))?.toJson()));
    Assert.isNull(await host.messages.findAttachmentAsync(other.id, notes.path));
    Assert.isNull(await host.messages.findAttachmentAsync(conversation.id, "/data/attachments/missing.txt"));
  }

  @TestMethod
  public async listsEachTeammatesLatestReplyThatReportsUsageInItsCurrentSessionPerConversation(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const other = await host.createConversationAsync(await host.openProjectAsync("beta"));
    const provider = await host.createProviderAsync();
    const teammate = async (name: string): Promise<string> => (await host.teammates.createAsync(new TeammateCreateParams(name, null, provider.id, Harness.Provider, null, null))).id;
    const [ada, bob, cyd] = [await teammate("Ada"), await teammate("Bob"), await teammate("Cyd")];
    for (const [conversationId, teammateId] of [[conversation.id, ada], [conversation.id, bob], [conversation.id, cyd], [other.id, ada]] as const)
      await host.conversations.addMemberAsync(new ConversationMemberParams(conversationId, teammateId));
    await host.conversations.setMemberSessionAsync(new ConversationMemberParams(conversation.id, cyd), "native-2", true);
    const first = new ReplyUsage(100, 10, 0.5, null);
    const latest = new ReplyUsage(200, null, null, new ContextUsage(5000, 200_000, null));
    await host.messages.insertAsync(MessagesServiceTests.teammateReply(conversation.id, 1, ada, first));
    await host.messages.insertAsync(MessagesServiceTests.teammateReply(conversation.id, 2, ada, latest));
    await host.messages.insertAsync(MessagesServiceTests.teammateReply(conversation.id, 3, ada, null));
    await host.messages.insertAsync(MessagesServiceTests.teammateReply(conversation.id, 4, bob, null));
    await host.messages.insertAsync(MessagesServiceTests.teammateReply(conversation.id, 7, cyd, latest, "native-1"));
    const plain = MessagesServiceTests.reply(conversation.id, 5, MessageStatus.Running);
    await host.messages.insertAsync(plain.withProvenance(plain.provenance!.withUsage(first)));
    await host.messages.insertAsync(MessagesServiceTests.teammateReply(other.id, 6, ada, first).withStatus(MessageStatus.Running, null));

    const listed = await host.messages.listTeammateUsageAsync();
    const [mine, theirs] = [listed.find(t => t.conversationId === conversation.id), listed.find(t => t.conversationId === other.id)];

    Assert.areEqual(2, listed.length);
    Assert.areEqual(JSON.stringify({ teammateId: ada, chatId: conversation.id, messageId: "reply-2", startedAt: "t", endedAt: "t2",
      usage: latest.toJson() }), JSON.stringify(mine?.toJson()));
    Assert.areEqual(JSON.stringify(first.toJson()), JSON.stringify(theirs?.usage.toJson()));
    Assert.isNull(theirs?.endedAt);
  }

  @TestMethod
  public async listsEachTeammatesLatestCompletedReplyWithTextInAnyChatAndSkipsRepliesWithoutText(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const other = await host.createConversationAsync(await host.openProjectAsync("beta"));
    const provider = await host.createProviderAsync();
    const names = new Map<string, string>();
    const teammate = async (name: string): Promise<string> => {
      const id = (await host.teammates.createAsync(new TeammateCreateParams(name, null, provider.id, Harness.Provider, null, null))).id;
      names.set(id, name);
      return id;
    };
    const [ada, bob, cyd, dee] = [await teammate("Ada"), await teammate("Bob"), await teammate("Cyd"), await teammate("Dee")];
    const text = (value: string): MessageDetail => new MessageDetail(0, DetailKind.Text, value, null, "t");
    const reasoning = new MessageDetail(1, DetailKind.Reasoning, "thinking", null, "t");
    for (const message of [
      MessagesServiceTests.said(conversation.id, 1, ada, MessageStatus.Completed, "2026-11-20T10:00:00.000Z", [text("Old")]),
      MessagesServiceTests.said(other.id, 2, ada, MessageStatus.Completed, "2026-11-20T11:00:00.000Z", [text("Shipped"), reasoning, text("it.")]),
      MessagesServiceTests.said(conversation.id, 3, ada, MessageStatus.Completed, "2026-11-20T12:00:00.000Z", [reasoning]),
      MessagesServiceTests.said(conversation.id, 4, ada, MessageStatus.Completed, "2026-11-20T12:30:00.000Z", [text(" ")]),
      MessagesServiceTests.said(conversation.id, 5, ada, MessageStatus.Completed, "2026-11-20T12:40:00.000Z", [text("\n\n")]),
      MessagesServiceTests.said(conversation.id, 6, ada, MessageStatus.Completed, "2026-11-20T12:50:00.000Z", [text("\u00a0\t\r\n\u3000")]),
      MessagesServiceTests.said(conversation.id, 7, ada, MessageStatus.Failed, "2026-11-20T13:00:00.000Z", [text("Broke")]),
      MessagesServiceTests.said(conversation.id, 8, bob, MessageStatus.Completed, "2026-11-20T09:00:00.000Z", [text("First")]),
      MessagesServiceTests.said(other.id, 9, bob, MessageStatus.Completed, "2026-11-20T09:00:00.000Z", [text("Second")]),
      MessagesServiceTests.said(conversation.id, 10, cyd, MessageStatus.Running, null, [text("Working")]),
      MessagesServiceTests.said(conversation.id, 11, dee, MessageStatus.Completed, "2026-11-20T14:00:00.000Z", [text("\t")]),
      MessagesServiceTests.said(conversation.id, 12, "gone", MessageStatus.Completed, "2026-11-20T14:00:00.000Z", [text("Deleted teammate")]),
      MessagesServiceTests.said(conversation.id, 13, null, MessageStatus.Completed, "2026-11-20T14:00:00.000Z", [text("No teammate")]),
      MessagesServiceTests.userMessage(conversation.id, 14, "Hello")
    ])
      await host.messages.insertAsync(message);

    const listed = await host.messages.listTeammateLastRepliesAsync();

    Assert.areEqual(`Ada ${other.id} reply-2 Shipped it. 2026-11-20T11:00:00.000Z|Bob ${other.id} reply-9 Second 2026-11-20T09:00:00.000Z`,
      listed.map(t => `${names.get(t.teammateId)} ${t.chatId} ${t.messageId} ${t.text} ${t.endedAt}`).sort().join("|"));
  }

  @TestMethod
  public async walksTheLastReplyIndexForEachTeammateWithoutScanningMessages(): Promise<void> {
    await using host = await CoreHost.createAsync();

    const plan = (await host.context.database.connection.queryAsync(new SqlQuery(`EXPLAIN QUERY PLAN ${Resources.selectTeammateLastReplies}`,
      [Resources.textBlanks]))).map(t => t.readString("detail"));

    Assert.isTrue(plan.some(t => t.startsWith("SEARCH r USING INDEX IX_messages_teammateId_endedAt")), plan.join("; "));
    Assert.isTrue(plan.some(t => t.startsWith("SEARCH m USING INTEGER PRIMARY KEY")), plan.join("; "));
    Assert.isFalse(plan.some(t => /^SCAN (messages|m|r)\b/u.test(t)), plan.join("; "));
  }

  private static said(conversationId: string, sequence: number, teammateId: string | null, status: MessageStatus, endedAt: string | null,
    details: readonly MessageDetail[]): Message {
    const provenance = new Provenance(null, new RequestedSettings("fake", null, null), new ObservedSettings(null, null, null, null), null, false);
    return new Message(`reply-${sequence}`, conversationId, sequence, MessageAuthor.Provider, null, status, details, provenance, "t", "t", endedAt, [],
      teammateId, teammateId);
  }

  private static teammateReply(conversationId: string, sequence: number, teammateId: string, usage: ReplyUsage | null,
    nativeSessionId: string | null = null): Message {
    const provenance = new Provenance(null, new RequestedSettings("fake", null, null), new ObservedSettings(null, null, null, null),
      nativeSessionId, false, null, null, usage);
    return new Message(`reply-${sequence}`, conversationId, sequence, MessageAuthor.Provider, "msg-0", MessageStatus.Completed, [], provenance, "t",
      "t", "t2", [], teammateId, teammateId.toUpperCase());
  }

  private static userMessage(conversationId: string, sequence: number, text: string): Message {
    const detail = new MessageDetail(0, DetailKind.Text, text, null, "t");
    return new Message(`msg-${sequence}`, conversationId, sequence, MessageAuthor.User, null, MessageStatus.Completed, [detail], null, "t", null, "t");
  }

  private static reply(conversationId: string, sequence: number, status: MessageStatus): Message {
    const provenance = new Provenance(null, new RequestedSettings("fake", null, null), new ObservedSettings(null, null, null, null), null, false);
    return new Message(`reply-${sequence}`, conversationId, sequence, MessageAuthor.Provider, "msg-0", status, [], provenance, "t",
      status === MessageStatus.Pending ? null : "t", null);
  }
}
