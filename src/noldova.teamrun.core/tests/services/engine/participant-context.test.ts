/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ChatSummary, Handover, ParticipantContext, Resources } from "@noldova/teamrun.core";
import {
  ConversationRenameParams,
  DetailKind,
  Harness,
  MentionToken,
  Message,
  MessageAuthor,
  MessageDetail,
  MessageSender,
  MessageStatus,
  ObservedSettings,
  Provenance,
  RequestedSettings,
  type Teammate,
  TeammateCreateParams,
  TeammateIdParams,
  TeammateMention
} from "@noldova/teamrun.protocol";
import { CoreHost } from "../../fixtures/core-host.fixture.js";

@TestClass
export class ParticipantContextTests {
  @TestMethod
  public async pagesTheTranscriptAndKeepsTheCurrentQuestionOutsideTheHistoryCap(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    for (let index = 0; index < 110; index++)
      await host.messages.insertAsync(ParticipantContextTests.user(conversation.id, index, `message ${index}`));
    const sent = ParticipantContextTests.user(conversation.id, 110, "current question");
    await host.messages.insertAsync(sent);
    const reply = ParticipantContextTests.reply(conversation.id, 111, sent.id);
    const context = new ParticipantContext(host.messages, host.teammates, host.conversations);
    const complete = await context.createAsync(reply, sent, null);
    Assert.isTrue(complete.includes("User: message 0"));
    Assert.isTrue(complete.includes("User: message 109"));
    Assert.isTrue(complete.endsWith("User: current question"));
    const large = ParticipantContextTests.user(conversation.id, 112, "x".repeat(30_000));
    await host.messages.insertAsync(large);
    const current = ParticipantContextTests.user(conversation.id, 113, "y".repeat(30_000));
    await host.messages.insertAsync(current);
    const bounded = await context.createAsync(ParticipantContextTests.reply(conversation.id, 114, current.id), current, null);
    Assert.isTrue(bounded.includes(Resources.contextOmissionNote));
    Assert.isFalse(bounded.includes("message 109"));
    Assert.isTrue(bounded.endsWith("User: " + "y".repeat(30_000)));
    Assert.isTrue(bounded.length < 55_000);
  }

  @TestMethod
  public async omitsEmptyMessagesAndWholeOlderMessagesWhenTheBudgetIsConsumed(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    await host.messages.insertAsync(ParticipantContextTests.user(conversation.id, 0, "old"));
    const prefix = "User: ";
    await host.messages.insertAsync(ParticipantContextTests.user(conversation.id, 1,
      "x".repeat(Resources.joinPreambleMaximumCharacters - prefix.length - Resources.transcriptSeparator.length)));
    await host.messages.insertAsync(ParticipantContextTests.user(conversation.id, 2, ""));
    const sent = ParticipantContextTests.user(conversation.id, 3, "now");
    await host.messages.insertAsync(sent);
    const context = await new ParticipantContext(host.messages, host.teammates, host.conversations).createAsync(ParticipantContextTests.reply(conversation.id, 4, sent.id), sent, null);
    Assert.isTrue(context.includes(Resources.contextOmissionNote));
    Assert.isFalse(context.includes("User: old"));
  }

  @TestMethod
  public async writesEachMentionTokenAsTheTeammatesCurrentFullName(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const provider = await host.createProviderAsync();
    const chat = await host.teammates.createAsync(new TeammateCreateParams("Chat GPT", null, provider.id, Harness.Provider, null, null));
    const gone = await host.teammates.createAsync(new TeammateCreateParams("Gone Away", null, provider.id, Harness.Provider, null, null));
    await host.teammates.deleteAsync(new TeammateIdParams(gone.id));
    const text = `${MentionToken.format(chat.id, "Chat")}, ${MentionToken.format(gone.id, "Gone")} and ${MentionToken.format("missing", "Someone")}: `
      + `look at \`${MentionToken.format(chat.id, "Chat")}\``;
    const sent = new Message("u0", conversation.id, 0, MessageAuthor.User, null, MessageStatus.Completed, [new MessageDetail(0, DetailKind.Text, text, null, "t")],
      null, "t", null, "t", [], null, null, [new TeammateMention(chat.id, "Old Name"), new TeammateMention(gone.id, "Gone Away")]);
    await host.messages.insertAsync(sent);
    const reply = new Message("r1", conversation.id, 1, MessageAuthor.Provider, sent.id, MessageStatus.Pending, [],
      new Provenance(null, new RequestedSettings("fake", null, null), new ObservedSettings(null, null, null, null), null, false), "t", null, null);

    Assert.areEqual(`@Chat GPT, @Gone Away and @Someone: look at \`${MentionToken.format(chat.id, "Chat")}\``,
      await new ParticipantContext(host.messages, host.teammates, host.conversations).createAsync(reply, sent, null));
  }

  @TestMethod
  public async namesTheChatAMessageFromAnotherChatCameFromByItsCurrentTitleAndId(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const other = await host.createConversationAsync(undefined, "Release plan");
    const sent = ParticipantContextTests.user(conversation.id, 0, "What changed?", new MessageSender(other.id, "bob", "Bob"));
    await host.messages.insertAsync(sent);
    const context = new ParticipantContext(host.messages, host.teammates, host.conversations);

    Assert.isTrue((await context.createAsync(ParticipantContextTests.reply(conversation.id, 1, sent.id), sent, null))
      .endsWith(`From @Bob in chat "Release plan" (${other.id}): What changed?`));
    await host.conversations.renameAsync(new ConversationRenameParams(other.id, "Ship it"));
    Assert.isTrue((await context.createAsync(ParticipantContextTests.reply(conversation.id, 1, sent.id), sent, null))
      .endsWith(`From @Bob in chat "Ship it" (${other.id}): What changed?`));
  }

  @TestMethod
  public async namesTheTeammateAndChatAMessageFromAChatThatIsGoneCameFromByTheChatsId(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const sender = new MessageSender("c2", "bob", "Bob");
    const sent = ParticipantContextTests.user(conversation.id, 0, "What changed?", sender);
    await host.messages.insertAsync(sent);
    const context = new ParticipantContext(host.messages, host.teammates, host.conversations);

    Assert.isTrue((await context.createAsync(ParticipantContextTests.reply(conversation.id, 1, sent.id), sent, null)).endsWith("From @Bob in chat c2: What changed?"));
    const unnamed = new Message("r1", conversation.id, 1, MessageAuthor.Provider, sent.id, MessageStatus.Pending, [],
      new Provenance(null, new RequestedSettings("fake", null, null), new ObservedSettings(null, null, null, null), null, false), "t", null, null);
    Assert.areEqual("From @Bob in chat c2: What changed?", await context.createAsync(unnamed, sent, null));
    const next = ParticipantContextTests.user(conversation.id, 2, "And now?", sender);
    await host.messages.insertAsync(next);
    const later = new Message("r3", conversation.id, 3, MessageAuthor.Provider, next.id, MessageStatus.Pending, [], unnamed.provenance, "t", null, null);
    const preamble = await context.createAsync(later, next, null);
    Assert.isTrue(preamble.includes("From @Bob in chat c2: What changed?"));
    Assert.isTrue(preamble.endsWith("Now a message comes from another chat:\n\nFrom @Bob in chat c2: And now?"));
    Assert.isFalse(preamble.includes("Now the user says:"));
  }

  @TestMethod
  public async closesAHandedOffTeammatesPromptWithTheHandingTeammateAndEachPartOfItsReplyAddressedToIt(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const [bob, carol, dan] = await ParticipantContextTests.teamAsync(host, "Bob", "Carol", "Dan");
    const asked = ParticipantContextTests.user(conversation.id, 0, "@Bob fix the parser");
    await host.messages.insertAsync(asked);
    const token = MentionToken.format(dan!.id, "Danny");
    const text = `The parser is fixed.\n\n@Carol, please review src/parser.ts.\nCheck its error paths with ${token} too.\n\n- @Dan update the docs.\n\n**@Carol** and @Dan, run the tests.`;
    const shown = text.replace(token, "@Dan");
    const handing = ParticipantContextTests.answer(conversation.id, 1, asked.id, bob!.id, "Bob", text);
    await host.messages.insertAsync(handing);
    const context = new ParticipantContext(host.messages, host.teammates, host.conversations);

    Assert.areEqual([
      "You are @Carol, a teammate in this TeamRun chat. What was said before:",
      "User: @Bob fix the parser",
      `@Bob: ${shown}`,
      "@Bob hands off to you:",
      "@Carol, please review src/parser.ts.\nCheck its error paths with @Dan too.\n\n**@Carol** and @Dan, run the tests."
    ].join("\n\n"), await context.createAsync(ParticipantContextTests.answer(conversation.id, 2, handing.id, carol!.id, "Carol"), handing, null));
    Assert.isTrue((await context.createAsync(ParticipantContextTests.answer(conversation.id, 3, handing.id, dan!.id, "Dan"), handing, null))
      .endsWith(`@Bob: ${shown}\n\n@Bob hands off to you:\n\n- @Dan update the docs.\n\n**@Carol** and @Dan, run the tests.`));
  }

  @TestMethod
  public async quotesTheWholeHandingReplyWhenNoLineOfItAddressesTheTeammateAnyMoreAndLeavesItOutOfTheTranscript(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const [bob, carol] = await ParticipantContextTests.teamAsync(host, "Bob", "Carol");
    const asked = ParticipantContextTests.user(conversation.id, 0, "@Bob look at it");
    await host.messages.insertAsync(asked);
    const handing = ParticipantContextTests.answer(conversation.id, 1, asked.id, bob!.id, "Bob", "@Carl please check it.");
    await host.messages.insertAsync(handing);

    Assert.areEqual([
      "You are @Carol, a teammate in this TeamRun chat. What was said before:",
      "User: @Bob look at it",
      "@Bob hands off to you:",
      "@Carl please check it."
    ].join("\n\n"), await new ParticipantContext(host.messages, host.teammates, host.conversations)
      .createAsync(ParticipantContextTests.answer(conversation.id, 2, handing.id, carol!.id, "Carol"), handing, null));
  }

  @TestMethod
  public async closesAResumedTeammatesPromptWithTheHandOffAloneWhenItQuotesTheOnlyNewMessageWhole(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const [bob, carol] = await ParticipantContextTests.teamAsync(host, "Bob", "Carol");
    const asked = ParticipantContextTests.user(conversation.id, 0, "@Carol look");
    await host.messages.insertAsync(asked);
    const looked = ParticipantContextTests.answer(conversation.id, 1, asked.id, carol!.id, "Carol", "Looked.");
    await host.messages.insertAsync(looked.withProvenance(new Provenance(null, looked.provenance!.requested, looked.provenance!.observed, "s1", false)));
    const handing = ParticipantContextTests.answer(conversation.id, 2, asked.id, bob!.id, "Bob", "@Carol check it again.");
    await host.messages.insertAsync(handing);

    Assert.areEqual("@Bob hands off to you:\n\n@Carol check it again.", await new ParticipantContext(host.messages, host.teammates, host.conversations)
      .createAsync(ParticipantContextTests.answer(conversation.id, 3, handing.id, carol!.id, "Carol"), handing, "s1"));
  }

  @TestMethod
  public async givesAnotherTeammateAReplysPlanTextWhereItHappenedButNotItsChecklist(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const [alice, carol] = await ParticipantContextTests.teamAsync(host, "Alice", "Carol");
    const asked = ParticipantContextTests.user(conversation.id, 0, "Plan the cache move");
    await host.messages.insertAsync(asked);
    const planned = ParticipantContextTests.answer(conversation.id, 1, asked.id, alice!.id, "Alice", "Here it is.");
    await host.messages.insertAsync(planned.withDetails([...planned.details,
      new MessageDetail(1, DetailKind.Plan, "Plan, 0 of 1 done", { steps: [{ text: "Read the cache", status: "Pending", activeText: null }], explanation: null }, "t"),
      new MessageDetail(2, DetailKind.Plan, "# Move the cache", { steps: [], explanation: null, text: "# Move the cache\n1. Read it" }, "t"),
      new MessageDetail(3, DetailKind.Text, "Shall I go on?", null, "t")]));
    const next = ParticipantContextTests.user(conversation.id, 2, "@Carol review it");
    await host.messages.insertAsync(next);

    const prompt = await new ParticipantContext(host.messages, host.teammates, host.conversations)
      .createAsync(ParticipantContextTests.answer(conversation.id, 3, next.id, carol!.id, "Carol"), next, null);
    Assert.isTrue(prompt.includes("Here it is.\n# Move the cache\n1. Read it\nShall I go on?"));
    Assert.isFalse(prompt.includes("Read the cache"));
  }

  @TestMethod
  public async namesTheReaderAsYouAmongAMessagesRecipientsAndNoOneWhenItAloneAnsweredIt(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const other = await host.createConversationAsync(undefined, "Release plan");
    const [alice, carol] = await ParticipantContextTests.teamAsync(host, "Alice", "Carol");
    const bob = new MessageSender(other.id, "bob", "Bob");
    const both = ParticipantContextTests.user(conversation.id, 0, "What changed?", bob);
    await host.messages.insertAsync(both);
    await host.messages.insertAsync(ParticipantContextTests.answer(conversation.id, 1, both.id, carol!.id, "Carol", "The login fix."));
    await host.messages.insertAsync(ParticipantContextTests.answer(conversation.id, 2, both.id, alice!.id, "Alice", "And the docs."));
    const alone = ParticipantContextTests.user(conversation.id, 3, "Is it released?", bob);
    await host.messages.insertAsync(alone);
    await host.messages.insertAsync(ParticipantContextTests.answer(conversation.id, 4, alone.id, carol!.id, "Carol", "Not yet."));
    const asked = ParticipantContextTests.user(conversation.id, 5, "@Carol sum it up");
    await host.messages.insertAsync(asked);

    const prompt = await new ParticipantContext(host.messages, host.teammates, host.conversations)
      .createAsync(ParticipantContextTests.answer(conversation.id, 6, asked.id, carol!.id, "Carol"), asked, null);
    Assert.isTrue(prompt.includes(`\n\nFrom @Bob in chat "Release plan" (${other.id}) to you and @Alice: What changed?\n\n`));
    Assert.isTrue(prompt.includes(`\n\nFrom @Bob in chat "Release plan" (${other.id}): Is it released?\n\n`));
  }

  @TestMethod
  public async namesTheTeammatesAnEarlierMessageFromAnotherChatWasSentToButNotThoseOfTheMessageItAnswers(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const other = await host.createConversationAsync(undefined, "Release plan");
    const [alice, carol] = await ParticipantContextTests.teamAsync(host, "Alice", "Carol");
    const sent = ParticipantContextTests.user(conversation.id, 0, "What changed?", new MessageSender(other.id, "bob", "Bob"));
    await host.messages.insertAsync(sent);
    await host.messages.insertAsync(ParticipantContextTests.answer(conversation.id, 1, sent.id, alice!.id, "Alice", "The login fix."));
    await host.messages.insertAsync(ParticipantContextTests.answer(conversation.id, 2, sent.id, null, null, "And the docs."));
    const question = ParticipantContextTests.user(conversation.id, 3, "Anything else?", new MessageSender(other.id, null, "Codex"));
    await host.messages.insertAsync(question);
    await host.messages.insertAsync(ParticipantContextTests.answer(conversation.id, 4, question.id, alice!.id, "Alice"));
    const context = new ParticipantContext(host.messages, host.teammates, host.conversations);

    const prompt = await context.createAsync(ParticipantContextTests.answer(conversation.id, 5, question.id, carol!.id, "Carol"), question, null);
    Assert.isTrue(prompt.includes(`From @Bob in chat "Release plan" (${other.id}) to @Alice and the default teammate: What changed?`));
    Assert.isTrue(prompt.endsWith(`\n\nFrom the default teammate (Codex) in chat "Release plan" (${other.id}): Anything else?`));
  }

  @TestMethod
  public async handsOverToTheByteWithTheOpeningAndEachHandOffsCloseAndQuotesAHandOffOnlyInItsClose(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const [bob, dan, carol] = await ParticipantContextTests.teamAsync(host, "Bob", "Dan", "Carol");
    const asked = ParticipantContextTests.user(conversation.id, 0, `@Bob @Dan start ${"s".repeat(200)}`);
    await host.messages.insertAsync(asked);
    const bobs = ParticipantContextTests.answer(conversation.id, 1, asked.id, bob?.id ?? null, "Bob", "@Carol check A.");
    const dans = ParticipantContextTests.answer(conversation.id, 2, asked.id, dan?.id ?? null, "Dan", "@Carol check B.");
    await host.messages.insertAsync(bobs);
    await host.messages.insertAsync(dans);
    const reply = ParticipantContextTests.answer(conversation.id, 3, bobs.id, carol?.id ?? null, "Carol");
    const context = new ParticipantContext(host.messages, host.teammates, host.conversations);
    const instructions = "Review carefully";
    const handover = await context.createHandoverAsync(reply, bobs, null, [dans], null, instructions);
    const whole = handover?.text ?? String.empty;
    const window = Resources.handoverProviderRoomTokens + Handover.bytesOf(instructions) + Handover.bytesOf(whole);

    const fitting = await context.createHandoverAsync(reply, bobs, null, [dans], window, instructions);
    const cut = await context.createHandoverAsync(reply, bobs, null, [dans], window - 1, instructions);
    const short = cut?.text ?? String.empty;

    Assert.areEqual(whole, fitting?.text);
    Assert.areEqual(["Message 0 whole", false, "Left out: message 0", true].join("|"),
      [handover?.carried[0], handover?.leftOut, cut?.carried[0], cut?.leftOut].join("|"));
    Assert.areEqual(1, whole.split("check B.").length - 1);
    Assert.isTrue(whole.includes("s".repeat(200)));
    Assert.isFalse(short.includes("s".repeat(200)));
    Assert.isTrue(short.includes(Resources.formatHandoverLeftOut(["0"], conversation.id)));
  }

  @TestMethod
  public async saysWhatAHandoverCarriedByItsFirstAuthorTheMessagesKeptWholeWithTheirToolCallsAndCutResultsThoseLeftOutAndTheMessageItAnswers(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const [bob, carol] = await ParticipantContextTests.teamAsync(host, "Bob", "Carol");
    const opening = ParticipantContextTests.user(conversation.id, 0, "Build the upload client", new MessageSender(conversation.id, null, "Ana"));
    const provenance = new Provenance(null, new RequestedSettings("fake", null, null), new ObservedSettings(null, null, null, null), null, false);
    const listed = new Message("r1", conversation.id, 1, MessageAuthor.Provider, opening.id, MessageStatus.Completed, [new MessageDetail(0, DetailKind.Text, "Listing.", null, "t"),
      new MessageDetail(1, DetailKind.Command, `> ls\n${"x".repeat(Resources.handoverResultBytes * 2)}`, { tool: "Bash" }, "t")], provenance, "t", "t", "t", [],
      bob?.id ?? null, "Bob");
    const later = ParticipantContextTests.user(conversation.id, 2, "Then add retries");
    const sent = ParticipantContextTests.user(conversation.id, 3, "Go on");
    for (const message of [opening, listed, later, sent])
      await host.messages.insertAsync(message);
    const reply = ParticipantContextTests.answer(conversation.id, 4, sent.id, carol?.id ?? null, "Carol");
    const context = new ParticipantContext(host.messages, host.teammates, host.conversations);
    const whole = await context.createHandoverAsync(reply, sent, null, [], null, null);
    const window = Resources.handoverProviderRoomTokens + Handover.bytesOf(whole?.text ?? String.empty);

    const short = await context.createHandoverAsync(reply, sent, null, [], window - 100, null);

    Assert.areEqual(["Messages 0 to 2 whole, with tool calls as one line each; the result of 1 cut to its start and end", "The message this answers"].join("|"),
      whole?.carried.join("|"));
    Assert.areEqual(["Ana's first message, the original request", "Message 2 whole", "Left out: message 1", "The message this answers"].join("|"),
      short?.carried.join("|"));
    Assert.areEqual("false,true", [whole?.leftOut, short?.leftOut].join(","));
  }

  @TestMethod
  public async saysAHandoverCarriedTheCompactionSummaryByItsAuthorAndTheMessagesItCoversAndLeftNoneOfThemOut(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const [carol] = await ParticipantContextTests.teamAsync(host, "Carol");
    const opening = ParticipantContextTests.user(conversation.id, 0, "Build the upload client", new MessageSender(conversation.id, null, "Ana"));
    const compacted = new Message("n4", conversation.id, 4, MessageAuthor.Provider, opening.id, MessageStatus.Completed,
      [new MessageDetail(0, DetailKind.Text, "Carol works.", null, "t"), new MessageDetail(1, DetailKind.Note, "Context compacted", { [Resources.compactionField]: true }, "t")],
      new Provenance(null, new RequestedSettings("fake", null, null), new ObservedSettings(null, null, null, null), null, false), "t", "t", "t", [], carol?.id ?? null, "Carol");
    const sent = ParticipantContextTests.user(conversation.id, 6, "Go on");
    for (const message of [opening, ...[1, 2, 3].map(t => ParticipantContextTests.user(conversation.id, t, `Step ${t}`)), compacted,
      ParticipantContextTests.user(conversation.id, 5, "Then add retries"), sent])
      await host.messages.insertAsync(message);
    const reply = ParticipantContextTests.answer(conversation.id, 7, sent.id, carol?.id ?? null, "Carol");
    const context = new ParticipantContext(host.messages, host.teammates, host.conversations);

    const handover = await context.createHandoverAsync(reply, sent, null, [], null, null, new ChatSummary("The work so far.", "Claude", true));

    Assert.isTrue(await context.compactedAsync(reply, null));
    Assert.areEqual(["Ana's first message, the original request", "Claude's last compaction summary, covering messages 1 to 3", "Messages 4 to 5 whole",
      "The message this answers"].join("|"), handover?.carried.join("|"));
    Assert.isFalse(handover?.leftOut ?? true);
    Assert.isTrue((handover?.text ?? String.empty).includes(Resources.formatHandoverLeftOut([Resources.formatHandoverRange(1, 3)], conversation.id)));
    Assert.isTrue((handover?.text ?? String.empty).includes("The work so far."));
    Assert.isFalse((handover?.text ?? String.empty).includes("Step 2"));
  }

  @TestMethod
  public async takesNoSummaryWithoutACompactionNoteOfTheSessionTeammatesOwnNotASubAgents(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const [bob, carol] = await ParticipantContextTests.teamAsync(host, "Bob", "Carol");
    const asked = ParticipantContextTests.user(conversation.id, 0, "@Bob @Carol start");
    const note = (sequence: number, teammateId: string | null, name: string, payload: JsonValue): Message =>
      new Message(`n${sequence}`, conversation.id, sequence, MessageAuthor.Provider, asked.id, MessageStatus.Completed,
        [new MessageDetail(0, DetailKind.Text, `${name} works.`, null, "t"), new MessageDetail(1, DetailKind.Note, "Context compacted", payload, "t")],
        new Provenance(null, new RequestedSettings("fake", null, null), new ObservedSettings(null, null, null, null), null, false), "t", "t", "t", [], teammateId, name);
    await host.messages.insertAsync(asked);
    await host.messages.insertAsync(note(1, bob?.id ?? null, "Bob", { [Resources.compactionField]: true }));
    await host.messages.insertAsync(note(2, carol?.id ?? null, "Carol", { [Resources.compactionField]: false }));
    await host.messages.insertAsync(note(3, carol?.id ?? null, "Carol", null));
    await host.messages.insertAsync(new Message("n4", conversation.id, 4, MessageAuthor.Provider, asked.id, MessageStatus.Completed,
      [new MessageDetail(0, DetailKind.SubAgent, "Explorer", null, "t"), new MessageDetail(1, DetailKind.Note, "Context compacted", { [Resources.compactionField]: true }, "t", 0)],
      new Provenance(null, new RequestedSettings("fake", null, null), new ObservedSettings(null, null, null, null), null, false), "t", "t", "t", [], carol?.id ?? null, "Carol"));
    const sent = ParticipantContextTests.user(conversation.id, 5, "@Carol go on");
    await host.messages.insertAsync(sent);
    const reply = ParticipantContextTests.answer(conversation.id, 6, sent.id, carol?.id ?? null, "Carol");
    const context = new ParticipantContext(host.messages, host.teammates, host.conversations);

    const summarized = (await context.createHandoverAsync(reply, sent, null, [], null, null, new ChatSummary("The work so far.", "Bob", true)))?.text;
    Assert.isFalse(await context.compactedAsync(reply, null));

    Assert.areEqual((await context.createHandoverAsync(reply, sent, null, [], null, null))?.text, summarized);
    Assert.isFalse((summarized ?? String.empty).includes("The work so far."));
  }

  @TestMethod
  public async asksForTeamRunsOwnSummaryOfTheChatBeforeTheTeammatesLastCompactionAndOnlyWhenItFits(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const [bob, carol] = await ParticipantContextTests.teamAsync(host, "Bob", "Carol");
    const asked = ParticipantContextTests.user(conversation.id, 0, "@Bob @Carol start");
    await host.messages.insertAsync(asked);
    await host.messages.insertAsync(ParticipantContextTests.answer(conversation.id, 1, asked.id, bob?.id ?? null, "Bob", "Bob read the code."));
    await host.messages.insertAsync(new Message("n2", conversation.id, 2, MessageAuthor.Provider, asked.id, MessageStatus.Completed,
      [new MessageDetail(0, DetailKind.Text, "Carol wrote the plan.", null, "t"), new MessageDetail(1, DetailKind.Note, "Context compacted", { [Resources.compactionField]: true }, "t")],
      new Provenance(null, new RequestedSettings("fake", null, null), new ObservedSettings(null, null, null, null), null, false), "t", "t", "t", [], carol?.id ?? null, "Carol"));
    await host.messages.insertAsync(ParticipantContextTests.user(conversation.id, 3, "later"));
    const sent = ParticipantContextTests.user(conversation.id, 4, "@Carol go on");
    await host.messages.insertAsync(sent);
    const reply = ParticipantContextTests.answer(conversation.id, 5, sent.id, carol?.id ?? null, "Carol");
    const context = new ParticipantContext(host.messages, host.teammates, host.conversations);

    const [through, prompt] = (await context.createSummaryPromptAsync(reply, sent, null, null)) ?? [-1, String.empty];

    Assert.areEqual(1, through);
    Assert.isTrue(prompt.startsWith(Resources.formatOwnSummaryPrompt(String.empty)) && prompt.includes("start") && prompt.includes("Bob read the code."));
    Assert.isFalse(prompt.includes("Carol wrote the plan.") || prompt.includes("later") || prompt.includes("go on"));
    Assert.isNull(await context.createSummaryPromptAsync(reply, sent, null, 1));
    Assert.isNull(await context.createSummaryPromptAsync(ParticipantContextTests.answer(conversation.id, 5, sent.id, bob?.id ?? null, "Bob"), sent, null, null));
  }

  private static user(conversationId: string, sequence: number, text: string, sender: MessageSender | null = null): Message {
    return new Message(`u${sequence}`, conversationId, sequence, MessageAuthor.User, null, MessageStatus.Completed,
      [new MessageDetail(0, DetailKind.Text, text, null, "t")], null, "t", null, "t", [], null, null, [], sender);
  }

  private static reply(conversationId: string, sequence: number, sentId: string): Message {
    return new Message(`r${sequence}`, conversationId, sequence, MessageAuthor.Provider, sentId, MessageStatus.Pending, [],
      new Provenance(null, new RequestedSettings("fake", null, null), new ObservedSettings(null, null, null, null), null, false),
      "t", null, null, [], "alice", "Alice");
  }

  private static answer(conversationId: string, sequence: number, inReplyTo: string | null, teammateId: string | null, name: string | null,
    text: string | null = null): Message {
    const provenance = new Provenance(null, new RequestedSettings("fake", null, null), new ObservedSettings(null, null, null, null), null, false);
    return Object.isNull(text)
      ? new Message(`r${sequence}`, conversationId, sequence, MessageAuthor.Provider, inReplyTo, MessageStatus.Pending, [], provenance, "t", null, null, [],
        teammateId, name)
      : new Message(`r${sequence}`, conversationId, sequence, MessageAuthor.Provider, inReplyTo, MessageStatus.Completed,
        [new MessageDetail(0, DetailKind.Text, text, null, "t")], provenance, "t", "t", "t", [], teammateId, name);
  }

  private static async teamAsync(host: CoreHost, ...names: string[]): Promise<readonly Teammate[]> {
    const provider = await host.createProviderAsync();
    const team: Teammate[] = [];
    for (const name of names)
      team.push(await host.teammates.createAsync(new TeammateCreateParams(name, null, provider.id, Harness.Provider, null, null)));
    return team;
  }
}
