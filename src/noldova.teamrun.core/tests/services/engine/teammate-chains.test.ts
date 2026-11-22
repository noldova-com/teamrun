/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync } from "node:fs";

import "@noldova/context.core";
import type { SqlTransaction } from "@noldova/context.data.sql";
import type { JsonValue } from "@noldova/context.json";
import { ServiceException } from "@noldova/teamrun.services";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { ApprovalAsk, Resources, SignInCheck, TurnOutcome } from "@noldova/teamrun.core";
import {
  ApprovalDecideParams,
  ApprovalKind,
  ApprovalOption,
  ApprovalOutcome,
  ApprovalScope,
  AuthStatus,
  ConversationIdParams,
  ConversationMemberParams,
  DetailKind,
  ErrorCode,
  EventName,
  Harness,
  Message,
  MessageIdParams,
  MessageListParams,
  MessageSendParams,
  MessageStatus,
  ProviderEnabledParams,
  ProviderIdParams,
  RequestedSettings,
  SenderEnvironment,
  type Teammate,
  TeammateCreateParams,
  TeammateIdParams,
  TeammateUpdateParams
} from "@noldova/teamrun.protocol";

import { ChangeSignal } from "../../fixtures/change-signal.fixture.js";
import { CoreHost } from "../../fixtures/core-host.fixture.js";

class SentTurn {
  public readonly token: string | null;
  public readonly replies: readonly string[];

  public constructor(token: string | null, replies: readonly string[]) {
    this.token = token;
    this.replies = replies;
  }
}

class ServiceRefusal {
  public readonly code: string;
  public readonly message: string;

  public constructor(code: string, message: string) {
    this.code = code;
    this.message = message;
  }
}

class PublishedEvent {
  public readonly name: string;
  public readonly payload: JsonValue;

  public constructor(name: string, payload: JsonValue) {
    this.name = name;
    this.payload = payload;
  }
}

@TestClass
export class TeammateChainsTests {
  private static readonly accept: ApprovalOption = new ApprovalOption("accept", "Allow", ApprovalOutcome.Approved, ApprovalScope.Once);

  @TestMethod
  public async startsNoOneFromAReplyStoppedAfterItsAnswerAndNotesWhoItWouldHaveHandedOffTo(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    mkdirSync(project.rootPath, { recursive: true });
    const conversation = await host.createConversationAsync(project);
    const [alice] = await TeammateChainsTests.teamAsync(host, "Alice", "Bob");
    Assert.isDefined(alice);
    host.adapter.turnTexts = [["@Bob please review, done."]];
    host.checkpoints.holds = "compare";
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice start", null, null, [], [alice.id]));
    await host.until("the held compare", () => host.checkpoints.compares.length === 1, host.runs());

    const stopped = await host.engine.cancelConversationAsync(new ConversationIdParams(conversation.id));
    await host.engine.waitForIdle();
    const aliceReply = sent.replies[0];
    Assert.isDefined(aliceReply);
    const reply = await host.messages.findAsync(aliceReply.id);
    Assert.isNotNull(reply);

    Assert.areEqual(reply.id, stopped.map(t => t.id).join());
    Assert.areEqual(MessageStatus.Cancelled, reply.status);
    Assert.areEqual(Resources.formatHandOffStopped(["Bob"]), reply.details.at(-1)?.text);
    Assert.areEqual(1, host.adapter.requests.length);
  }

  @TestMethod
  public async cancelsAReplyStoppedAfterItsCompletedWriteAndBeforeItsHandOffAndStartsNoOne(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const [alice] = await TeammateChainsTests.teamAsync(host, "Alice", "Bob");
    Assert.isDefined(alice);
    host.adapter.turnTexts = [["@Bob please review, done."]];
    const stops: Promise<readonly Message[]>[] = [];
    host.events.subscribe({
      onEvent: event => {
        if (event.name === EventName.MessageUpdated && stops.length === 0 && Message.fromJson(event.payload).status === MessageStatus.Completed)
          stops.push(host.engine.cancelConversationAsync(new ConversationIdParams(conversation.id)));
      }
    });

    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice start", null, null, [], [alice.id]));
    await host.engine.waitForIdle();
    const stopped = (await Promise.all(stops)).flat();
    const aliceReply = sent.replies[0];
    Assert.isDefined(aliceReply);
    const reply = await host.messages.findAsync(aliceReply.id);
    Assert.isNotNull(reply);

    Assert.areEqual(reply.id, stopped.map(t => t.id).join());
    Assert.areEqual(MessageStatus.Cancelled, reply.status);
    Assert.areEqual(Resources.formatHandOffStopped(["Bob"]), reply.details.at(-1)?.text);
    Assert.areEqual(1, host.adapter.requests.length);
  }

  @TestMethod
  public async keepsAReplyStoppedDuringItsTurnThatTheProviderStillCompletedCompletedAndStartsNoOne(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const [alice] = await TeammateChainsTests.teamAsync(host, "Alice", "Bob");
    Assert.isDefined(alice);
    host.adapter.turnTexts = [["@Bob please review, done."]];
    host.adapter.holdUntilAbort = true;
    host.adapter.outcomeOnAbort = TurnOutcome.Completed;
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice start", null, null, [], [alice.id]));
    await host.adapter.requested(1);

    const stopped = await host.engine.cancelConversationAsync(new ConversationIdParams(conversation.id));
    await host.engine.waitForIdle();
    const aliceReply = sent.replies[0];
    Assert.isDefined(aliceReply);
    const reply = await host.messages.findAsync(aliceReply.id);
    Assert.isNotNull(reply);

    Assert.areEqual(0, stopped.length);
    Assert.areEqual(MessageStatus.Completed, reply.status);
    Assert.areEqual(Resources.formatHandOffStopped(["Bob"]), reply.details.at(-1)?.text);
    Assert.areEqual(1, host.adapter.requests.length);
  }

  @TestMethod
  public async handsOffToTheTeammateAReplyMentionsWithTheReplyAsItsContext(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const [alice, bob] = await TeammateChainsTests.teamAsync(host, "Alice", "Bob");
    Assert.isDefined(alice);
    Assert.isDefined(bob);
    host.adapter.turnTexts = [["@Bob please review, done."], ["Looks good"]];
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice start", null, null, [], [alice.id]));
    await host.engine.waitForIdle();

    const [, first, second] = await TeammateChainsTests.chatAsync(host, conversation.id);
    Assert.areEqual(2, host.adapter.requests.length);
    const aliceReply = sent.replies[0];
    Assert.isDefined(aliceReply);
    Assert.isDefined(first);
    Assert.isDefined(second);
    Assert.areEqual(aliceReply.id, first.id);
    Assert.areEqual("Bob", first.mentions.map(t => t.name).join(","));
    const mention = first.mentions[0];
    Assert.isDefined(mention);
    Assert.areEqual(bob.id, mention.teammateId);
    Assert.areEqual(bob.id, second.teammateId);
    Assert.areEqual(first.id, second.inReplyTo);
    Assert.areEqual(MessageStatus.Completed, second.status);
    Assert.isNotNull(second.startedAt);
    Assert.isNotNull(first.endedAt);
    Assert.isTrue(second.startedAt >= first.endedAt);
    Assert.areEqual(0, second.mentions.length);
    const bobRequest = host.adapter.requests[1];
    Assert.isDefined(bobRequest);
    Assert.areEqual(Resources.formatTeammateInstructions("Bob's role", Resources.defaultCommand), bobRequest.instructions);
    Assert.isTrue(bobRequest.prompt.includes("You are @Bob, a teammate in this TeamRun chat."));
    Assert.isTrue(bobRequest.prompt.includes("User: @Alice start"));
    Assert.isTrue(bobRequest.prompt.endsWith("\n\n@Alice hands off to you:\n\n@Bob please review, done."));
    Assert.isFalse(bobRequest.prompt.includes("@Alice: @Bob please review, done."));
    Assert.isNotNull(await host.conversations.findMemberAsync(new ConversationMemberParams(conversation.id, bob.id)));
    Assert.areEqual(2, host.listener.count(EventName.StateInvalidated));
    Assert.isTrue(host.listener.events.some(t => t.name === EventName.MessageCreated && JSON.stringify(t.payload).includes(second.id)));
    Assert.isTrue(host.listener.events.some(t => t.name === EventName.MessageUpdated
      && Message.fromJson(t.payload).id === first.id && Message.fromJson(t.payload).mentions.length === 1));
    Assert.areEqual(0, host.engine.activeRunCount);
  }

  @TestMethod
  public async startsNoOneForATeammateAReplyNamesInsideASentenceButKeepsTheMention(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const [alice, bob] = await TeammateChainsTests.teamAsync(host, "Alice", "Bob");
    Assert.isDefined(alice);
    Assert.isDefined(bob);
    host.adapter.turnTexts = [["I sent its teammate, @Bob, a message."]];
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice ask Bob", null, null, [], [alice.id]));
    await host.engine.waitForIdle();

    Assert.areEqual(1, host.adapter.requests.length);
    Assert.areEqual(2, (await TeammateChainsTests.chatAsync(host, conversation.id)).length);
    const aliceReply = sent.replies[0];
    Assert.isDefined(aliceReply);
    const reply = await host.messages.findAsync(aliceReply.id);
    Assert.isNotNull(reply);
    Assert.areEqual(bob.id, reply.mentions.map(t => t.teammateId).join(","));
    Assert.isFalse(reply.details.some(t => t.kind === DetailKind.Note));
    Assert.isNull(await host.conversations.findMemberAsync(new ConversationMemberParams(conversation.id, bob.id)));
    Assert.isTrue(host.listener.events.some(t => t.name === EventName.MessageUpdated
      && Message.fromJson(t.payload).id === reply.id && Message.fromJson(t.payload).mentions.length === 1));
  }

  @TestMethod
  public async handsOffOnlyToTheTeammatesAReplyAddressesWhenItAlsoNamesOthersInPassing(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const [alice, bob, charlie, dave] = await TeammateChainsTests.teamAsync(host, "Alice", "Bob", "Charlie", "Dave");
    Assert.isDefined(alice);
    Assert.isDefined(bob);
    Assert.isDefined(charlie);
    Assert.isDefined(dave);
    host.adapter.turnTexts = [["Charlie's notes are in.\n  @Bob please review what @Charlie wrote\nthen tell @Dave"], ["Reviewed"]];
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice go", null, null, [], [alice.id]));
    await host.engine.waitForIdle();

    const [, first, second, ...rest] = await TeammateChainsTests.chatAsync(host, conversation.id);
    Assert.isDefined(first);
    Assert.isDefined(second);
    Assert.areEqual([bob.id, charlie.id, dave.id].join(","), first.mentions.map(t => t.teammateId).join(","));
    Assert.areEqual(bob.id, second.teammateId);
    Assert.areEqual(0, rest.length);
    Assert.areEqual(2, host.adapter.requests.length);
    for (const teammate of [charlie, dave])
      Assert.isNull(await host.conversations.findMemberAsync(new ConversationMemberParams(conversation.id, teammate.id)), teammate.name);
  }

  @TestMethod
  public async handsOffByAFirstWordOnlyOneTeammatesNameBeginsWith(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const [alice, chat, code] = await TeammateChainsTests.teamAsync(host, "Alice", "Chat GPT", "Code Reviewer", "Code Writer");
    Assert.isDefined(alice);
    Assert.isDefined(chat);
    Assert.isDefined(code);
    host.adapter.turnTexts = [["@Chat, then @Code, please"], ["Chat here"]];
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice start", null, null, [], [alice.id]));
    await host.engine.waitForIdle();

    const [, first, second] = await TeammateChainsTests.chatAsync(host, conversation.id);
    Assert.isDefined(first);
    Assert.isDefined(second);
    Assert.areEqual(chat.id, first.mentions.map(t => t.teammateId).join(","));
    Assert.areEqual(chat.id, second.teammateId);
    Assert.isFalse((await TeammateChainsTests.chatAsync(host, conversation.id)).some(t => t.teammateId === code.id));
    Assert.areEqual(2, host.adapter.requests.length);
  }

  @TestMethod
  public async handsOffOnlyToAPlainMentionInAReplyNotToNamesInQuotesOrCodeWhileThePersonsQuotedMentionStillCounts(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const [alice, bob, ...others] = await TeammateChainsTests.teamAsync(host, "Alice", "Bob", "Opus", "Carol", "Dave");
    Assert.isDefined(alice);
    Assert.isDefined(bob);
    const reply = ["Sent Opus a message in her \"@Opus hi\" chat, and ask “@Carol” too.",
      "Run `@Dave hi`, then:", "```", "@Dave", "```", "@Bob please review"];
    host.adapter.turnTexts = [[reply.join("\n")], ["Looks good"]];
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "Ask \"@Alice\" to start", null, null, [], [alice.id]));
    await host.engine.waitForIdle();

    const [sent, first, second, ...rest] = await TeammateChainsTests.chatAsync(host, conversation.id);
    Assert.isDefined(sent);
    Assert.isDefined(first);
    Assert.isDefined(second);
    Assert.areEqual(alice.id, sent.mentions.map(t => t.teammateId).join(","));
    Assert.areEqual(bob.id, first.mentions.map(t => t.teammateId).join(","));
    Assert.areEqual(bob.id, second.teammateId);
    Assert.areEqual(0, rest.length);
    Assert.areEqual(2, host.adapter.requests.length);
    for (const teammate of others)
      Assert.isNull(await host.conversations.findMemberAsync(new ConversationMemberParams(conversation.id, teammate.id)), teammate.name);
  }

  @TestMethod
  public async startsAHandOffsNewTeammatesAfterTheQueueJoinsAQueuedReplyAndIgnoresASelfMention(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const [alice, bob] = await TeammateChainsTests.teamAsync(host, "Alice", "Bob", "Charlie");
    Assert.isDefined(alice);
    Assert.isDefined(bob);
    host.adapter.turnTexts = [["@Alice noted.\n@Charlie, @Bob, over to you"], ["Bob here"], ["Charlie here"], ["As @Alice, I'm done"]];
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice @Bob go", null, null, [], [alice.id, bob.id]));
    await host.engine.waitForIdle();

    const replies = (await TeammateChainsTests.chatAsync(host, conversation.id)).slice(1);
    Assert.areEqual("Alice,Bob,Charlie", replies.map(t => t.teammateName).join(","));
    Assert.areEqual("1,2,3", replies.map(t => t.sequence).join(","));
    const [aliceReply, bobReply, charlieReply] = replies;
    Assert.isDefined(aliceReply);
    Assert.isDefined(bobReply);
    Assert.isDefined(charlieReply);
    Assert.areEqual("Alice,Charlie,Bob", aliceReply.mentions.map(t => t.name).join(","));
    Assert.areEqual(sent.sent.id, bobReply.inReplyTo);
    Assert.areEqual(aliceReply.id, charlieReply.inReplyTo);
    Assert.isNotNull(charlieReply.startedAt);
    Assert.isNotNull(bobReply.endedAt);
    Assert.isTrue(charlieReply.startedAt >= bobReply.endedAt);
    Assert.areEqual(3, host.adapter.requests.length);
    const bobRequest = host.adapter.requests[1];
    const charlieRequest = host.adapter.requests[2];
    Assert.isDefined(bobRequest);
    Assert.isDefined(charlieRequest);
    Assert.areEqual([
      "You are @Bob, a teammate in this TeamRun chat. What was said before:",
      "User: @Alice @Bob go",
      "@Alice: @Alice noted.\n@Charlie, @Bob, over to you",
      "@Alice hands off to you:",
      "@Charlie, @Bob, over to you"
    ].join("\n\n"), bobRequest.prompt);
    Assert.isTrue(charlieRequest.prompt.includes("@Bob: Bob here"));

    await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice once more", null, null, [], [alice.id]));
    await host.engine.waitForIdle();
    const last = (await TeammateChainsTests.chatAsync(host, conversation.id)).at(-1);
    Assert.isDefined(last);
    Assert.areEqual(4, host.adapter.requests.length);
    Assert.areEqual("Alice", last.mentions.map(t => t.name).join(","));
    Assert.isFalse(last.details.some(t => t.kind === DetailKind.Note));
  }

  @TestMethod
  public async closesAQueuedReplysPromptWithEachHandOffItJoined(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const [alice, bob, charlie] = await TeammateChainsTests.teamAsync(host, "Alice", "Bob", "Charlie");
    Assert.isDefined(alice);
    Assert.isDefined(bob);
    Assert.isDefined(charlie);
    host.adapter.turnTexts = [["@Charlie check the parser"], ["Fixed the docs.\n@Charlie check the docs"], ["Both checked"]];
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice @Bob @Charlie go", null, null, [], [alice.id, bob.id, charlie.id]));
    await host.engine.waitForIdle();

    Assert.areEqual("Alice,Bob,Charlie", (await TeammateChainsTests.chatAsync(host, conversation.id)).slice(1).map(t => t.teammateName).join(","));
    Assert.areEqual(3, host.adapter.requests.length);
    const charlieRequest = host.adapter.requests[2];
    Assert.isDefined(charlieRequest);
    Assert.areEqual([
      "You are @Charlie, a teammate in this TeamRun chat. What was said before:",
      "User: @Alice @Bob @Charlie go",
      "@Bob: Fixed the docs.\n@Charlie check the docs",
      "@Alice hands off to you:",
      "@Charlie check the parser",
      "@Bob hands off to you:",
      "@Charlie check the docs"
    ].join("\n\n"), charlieRequest.prompt);
  }

  @TestMethod
  public async startsANewReplyForATeammateWhoseQueuedReplyHasEndedOrWasCancelled(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const [alice, bob, charlie] = await TeammateChainsTests.teamAsync(host, "Alice", "Bob", "Charlie");
    Assert.isDefined(alice);
    Assert.isDefined(bob);
    Assert.isDefined(charlie);
    host.adapter.turnTexts = [["Bob done"], ["@Bob, @Charlie please check"], ["Bob checked"], ["Charlie checked"]];
    const cancelled: Promise<Message>[] = [];
    host.adapter.afterDetails = async () => {
      if (host.adapter.requests.length === 2 && cancelled.length === 0) {
        const queued = (await TeammateChainsTests.chatAsync(host, conversation.id)).find(t => t.teammateId === charlie.id);
        Assert.isDefined(queued);
        cancelled.push(host.engine.cancelAsync(new MessageIdParams(queued.id)));
      }
    };
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Bob @Alice @Charlie go", null, null, [], [bob.id, alice.id, charlie.id]));
    await host.engine.waitForIdle();
    await cancelled[0];

    const replies = (await TeammateChainsTests.chatAsync(host, conversation.id)).slice(1);
    Assert.areEqual("Bob,Alice,Charlie,Bob,Charlie", replies.map(t => t.teammateName).join(","));
    const [, aliceReply, cancelledReply, bobAgain, charlieAgain] = replies;
    Assert.isDefined(aliceReply);
    Assert.isDefined(cancelledReply);
    Assert.isDefined(bobAgain);
    Assert.isDefined(charlieAgain);
    Assert.areEqual(MessageStatus.Cancelled, cancelledReply.status);
    Assert.areEqual(`${aliceReply.id},${aliceReply.id}`, [bobAgain.inReplyTo, charlieAgain.inReplyTo].join(","));
    Assert.areEqual(4, host.adapter.requests.length);
    const handOffRequest = host.adapter.requests[2];
    Assert.isDefined(handOffRequest);
    Assert.areEqual("@Alice hands off to you:\n\n@Bob, @Charlie please check", handOffRequest.prompt);
  }

  @TestMethod
  public async countsAJoinedReplysHandOffsFromTheLongestChainItJoined(): Promise<void> {
    await using host = await CoreHost.createAsync(false, false, undefined, () => 1);
    const conversation = await host.createConversationAsync();
    const [alice, bob] = await TeammateChainsTests.teamAsync(host, "Alice", "Bob", "Charlie");
    Assert.isDefined(alice);
    Assert.isDefined(bob);
    host.adapter.turnTexts = [["@Bob over to you"], ["@Charlie please check"]];
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice @Bob go", null, null, [], [alice.id, bob.id]));
    await host.engine.waitForIdle();

    const replies = (await TeammateChainsTests.chatAsync(host, conversation.id)).slice(1);
    Assert.areEqual("Alice,Bob", replies.map(t => t.teammateName).join(","));
    Assert.areEqual(2, host.adapter.requests.length);
    const bobReply = replies[1];
    Assert.isDefined(bobReply);
    Assert.areEqual(Resources.formatChainStopped(1), bobReply.details.find(t => t.kind === DetailKind.Note)?.text);
  }

  @TestMethod
  public async startsNoOneForARemovedOrUnavailableTeammateOrForTheDefaultProvidersReply(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const [alice, bob, charlie] = await TeammateChainsTests.teamAsync(host, "Alice", "Bob", "Charlie");
    Assert.isDefined(alice);
    Assert.isDefined(bob);
    Assert.isDefined(charlie);
    const other = await host.createProviderAsync("fake", "Other");
    await host.teammates.updateAsync(TeammateChainsTests.onProvider(bob, other.id));
    host.adapter.signInCheck = new SignInCheck(AuthStatus.LoggedOut, null, null, null);
    await host.providers.checkAsync(new ProviderIdParams(other.id));
    await host.teammates.deleteAsync(new TeammateIdParams(charlie.id));
    host.adapter.detailTexts = ["@Bob, @Charlie: over to you"];
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice go", null, null, [], [alice.id]));
    await host.engine.waitForIdle();

    Assert.areEqual(1, host.adapter.requests.length);
    Assert.areEqual(2, (await TeammateChainsTests.chatAsync(host, conversation.id)).length);
    const aliceReply = sent.replies[0];
    Assert.isDefined(aliceReply);
    const aliceStored = await host.messages.findAsync(aliceReply.id);
    Assert.isNotNull(aliceStored);
    Assert.areEqual("Bob", aliceStored.mentions.map(t => t.name).join(","));
    Assert.isNotNull(await host.conversations.findMemberAsync(new ConversationMemberParams(conversation.id, bob.id)));
    Assert.areEqual(0, host.engine.activeRunCount);

    host.adapter.detailTexts = ["Ask @Alice"];
    const asked = await host.engine.sendAsync(new MessageSendParams(conversation.id, "Who knows?", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    Assert.areEqual(2, host.adapter.requests.length);
    const defaultReply = asked.replies[0];
    Assert.isDefined(defaultReply);
    const defaultStored = await host.messages.findAsync(defaultReply.id);
    Assert.isNotNull(defaultStored);
    Assert.areEqual(0, defaultStored.mentions.length);
    Assert.areEqual(4, (await TeammateChainsTests.chatAsync(host, conversation.id)).length);
  }

  @TestMethod
  public async startsNoOneForATeammateWhoseProviderIsDisabled(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const [alice, bob] = await TeammateChainsTests.teamAsync(host, "Alice", "Bob");
    Assert.isDefined(alice);
    Assert.isDefined(bob);
    const other = await host.createProviderAsync("fake", "Other");
    await host.teammates.updateAsync(TeammateChainsTests.onProvider(bob, other.id));
    await host.providers.setEnabledAsync(new ProviderEnabledParams(other.id, false));
    host.adapter.detailTexts = ["@Bob: over to you"];

    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice go", null, null, [], [alice.id]));
    await host.engine.waitForIdle();

    Assert.areEqual(1, host.adapter.requests.length);
    Assert.areEqual(2, (await TeammateChainsTests.chatAsync(host, conversation.id)).length);
    const aliceReply = sent.replies[0];
    Assert.isDefined(aliceReply);
    const reply = await host.messages.findAsync(aliceReply.id);
    Assert.isNotNull(reply);
    Assert.areEqual("Bob", reply.mentions.map(t => t.name).join(","));
    Assert.areEqual(MessageStatus.Completed, reply.status);
    Assert.areEqual(0, host.engine.activeRunCount);
  }

  @TestMethod
  public async stopsTheChainAfterFourHandOffsByDefaultWithOneNote(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const [alice] = await TeammateChainsTests.teamAsync(host, "Alice", "Bob");
    Assert.isDefined(alice);
    host.adapter.turnTexts = [["@Bob yours"], ["@Alice yours"], ["@Bob yours"], ["@Alice yours"], ["@Bob yours"]];
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice go", null, null, [], [alice.id]));
    await host.engine.waitForIdle();

    const replies = (await TeammateChainsTests.chatAsync(host, conversation.id)).slice(1);
    Assert.areEqual(5, host.adapter.requests.length);
    Assert.areEqual("Alice,Bob,Alice,Bob,Alice", replies.map(t => t.teammateName).join(","));
    Assert.isTrue(replies.every(t => t.status === MessageStatus.Completed));
    const notes = replies.flatMap(t => t.details.filter(detail => detail.kind === DetailKind.Note));
    Assert.areEqual(1, notes.length);
    const note = notes[0];
    const lastReply = replies[4];
    Assert.isDefined(note);
    Assert.isDefined(lastReply);
    Assert.areEqual("The chain stopped after 4 hand-offs. You can change this limit in Settings › TeamRun. Mention a teammate to go on.", note.text);
    Assert.areEqual(JSON.stringify({ source: "handOff" }), JSON.stringify(note.payload));
    Assert.areEqual(note.sequence, lastReply.details.length - 1);
    Assert.areEqual("Bob", lastReply.mentions.map(t => t.name).join(","));
  }

  @TestMethod
  public async addsNoChainNoteForANameInPassingOnceTheLimitIsReached(): Promise<void> {
    let limit = 0;
    await using host = await CoreHost.createAsync(false, false, undefined, () => limit);
    const conversation = await host.createConversationAsync();
    const [alice] = await TeammateChainsTests.teamAsync(host, "Alice", "Bob");
    Assert.isDefined(alice);
    host.adapter.turnTexts = [["I asked @Bob"], ["@Bob yours"], ["Thanks, @Alice"]];
    const send = async (): Promise<Message> => {
      await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice go", null, null, [], [alice.id]));
      await host.engine.waitForIdle();
      const latest = (await TeammateChainsTests.chatAsync(host, conversation.id)).at(-1);
      Assert.isDefined(latest);
      return latest;
    };

    const none = await send();
    Assert.areEqual(1, host.adapter.requests.length);
    Assert.areEqual("Bob", none.mentions.map(t => t.name).join(","));
    Assert.isFalse(none.details.some(t => t.kind === DetailKind.Note));
    limit = 1;
    const last = await send();
    Assert.areEqual(3, host.adapter.requests.length);
    Assert.areEqual("Bob", last.teammateName);
    Assert.areEqual("Alice", last.mentions.map(t => t.name).join(","));
    Assert.isFalse((await TeammateChainsTests.chatAsync(host, conversation.id)).some(t => t.details.some(detail => detail.kind === DetailKind.Note)));
  }

  @TestMethod
  public async readsTheLimitAtEachHandOffAndStartsNoOneAtZero(): Promise<void> {
    let limit = 0;
    await using host = await CoreHost.createAsync(false, false, undefined, () => limit);
    const conversation = await host.createConversationAsync();
    const [alice] = await TeammateChainsTests.teamAsync(host, "Alice", "Bob");
    Assert.isDefined(alice);
    host.adapter.turnTexts = [["@Bob yours"], ["Only @Alice"], ["@Bob yours"], ["@Alice yours"]];
    const send = async (): Promise<Message> => {
      await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice go", null, null, [], [alice.id]));
      await host.engine.waitForIdle();
      const latest = (await TeammateChainsTests.chatAsync(host, conversation.id)).at(-1);
      Assert.isDefined(latest);
      return latest;
    };

    const none = await send();
    Assert.areEqual(1, host.adapter.requests.length);
    const noneNote = none.details.at(-1);
    Assert.isDefined(noneNote);
    Assert.areEqual("Teammates' mentions start no one: the limit in Settings › TeamRun is 0 hand-offs. Mention a teammate to go on.", noneNote.text);
    const self = await send();
    Assert.areEqual(2, host.adapter.requests.length);
    Assert.isFalse(self.details.some(t => t.kind === DetailKind.Note));
    limit = 1;
    const stopped = await send();
    Assert.areEqual(4, host.adapter.requests.length);
    Assert.areEqual("Bob", stopped.teammateName);
    const stoppedNote = stopped.details.at(-1);
    Assert.isDefined(stoppedNote);
    Assert.areEqual("The chain stopped after 1 hand-off. You can change this limit in Settings › TeamRun. Mention a teammate to go on.", stoppedNote.text);
  }

  @TestMethod
  @TestData(true)
  @TestData(false)
  public async runsTheQueuedRepliesWhenAHandOffFailsAndTakesTheNextSend(thrownAsError: boolean): Promise<void> {
    const failure = "The limit could not be read.";
    await using host = await CoreHost.createAsync(false, false, undefined, () => { throw thrownAsError ? new Error(failure) : failure; });
    const conversation = await host.createConversationAsync();
    const [alice, bob] = await TeammateChainsTests.teamAsync(host, "Alice", "Bob", "Charlie");
    Assert.isDefined(alice);
    Assert.isDefined(bob);
    host.adapter.turnTexts = [["@Charlie yours"]];
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice @Bob go", null, null, [], [alice.id, bob.id]));
    const ended = await host.engine.waitForIdle().then(() => null, (error: unknown) => error);

    Assert.areEqual(failure, String(ended instanceof Error ? ended.message : ended));
    Assert.areEqual(2, host.adapter.requests.length);
    const [aliceReply, bobReply] = sent.replies;
    Assert.isDefined(aliceReply);
    Assert.isDefined(bobReply);
    const aliceStored = await host.messages.findAsync(aliceReply.id);
    Assert.isNotNull(aliceStored);
    Assert.areEqual(MessageStatus.Completed, aliceStored.status);
    const bobStored = await host.messages.findAsync(bobReply.id);
    Assert.isNotNull(bobStored);
    Assert.areEqual(MessageStatus.Completed, bobStored.status);
    Assert.areEqual(3, (await TeammateChainsTests.chatAsync(host, conversation.id)).length);
    Assert.areEqual(0, host.engine.activeRunCount);
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "after", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    Assert.areEqual(3, host.adapter.requests.length);
  }

  @TestMethod
  public async startsNoOneFromAFailedOrCancelledReply(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const [alice] = await TeammateChainsTests.teamAsync(host, "Alice", "Bob");
    Assert.isDefined(alice);
    host.adapter.detailTexts = ["@Bob take it"];
    host.adapter.outcome = TurnOutcome.Failed;
    const failed = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice go", null, null, [], [alice.id]));
    await host.engine.waitForIdle();
    Assert.areEqual(1, host.adapter.requests.length);
    const failedReply = failed.replies[0];
    Assert.isDefined(failedReply);
    const failedStored = await host.messages.findAsync(failedReply.id);
    Assert.isNotNull(failedStored);
    Assert.areEqual(MessageStatus.Failed, failedStored.status);

    host.adapter.outcome = TurnOutcome.Completed;
    host.adapter.holdUntilAbort = true;
    const held = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice again", null, null, [], [alice.id]));
    const heldReply = held.replies[0];
    Assert.isDefined(heldReply);
    await host.adapter.requested(2);
    await host.until("the hand-off detail", async () => {
      const current = await host.messages.findAsync(heldReply.id);
      Assert.isNotNull(current);
      return current.details.some(t => t.text === "@Bob take it");
    }, host.runs());
    await host.engine.cancelAsync(new MessageIdParams(heldReply.id));
    await host.engine.waitForIdle();
    Assert.areEqual(2, host.adapter.requests.length);
    const heldStored = await host.messages.findAsync(heldReply.id);
    Assert.isNotNull(heldStored);
    Assert.areEqual(MessageStatus.Cancelled, heldStored.status);
    Assert.areEqual(4, (await TeammateChainsTests.chatAsync(host, conversation.id)).length);
  }

  @TestMethod
  public async stopCancelsTheRunningChainedReplyAndTheQueuedOnesAndRefusesSendsUntilThen(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const [alice] = await TeammateChainsTests.teamAsync(host, "Alice", "Bob", "Charlie");
    Assert.isDefined(alice);
    host.adapter.turnTexts = [["@Bob, @Charlie, go"], ["Bob working"]];
    host.adapter.afterDetails = () => { host.adapter.holdUntilAbort = host.adapter.requests.length === 2; };
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice go", null, null, [], [alice.id]));
    await host.adapter.requested(2);
    await host.until("the held third turn", () => host.adapter.holdUntilAbort, host.runs());
    const [, , bobReply, charlieReply] = await TeammateChainsTests.chatAsync(host, conversation.id);
    Assert.isDefined(bobReply);
    Assert.isDefined(charlieReply);
    Assert.areEqual(MessageStatus.Pending, charlieReply.status);
    const provider = await host.providerOfAsync();
    await Assert.throwsAsync(() => host.engine.sendAsync(new MessageSendParams(conversation.id, "busy", new RequestedSettings("fake", null, null), provider.id)),
      ServiceException);

    const stopped = await host.engine.cancelConversationAsync(new ConversationIdParams(conversation.id));
    Assert.areEqual([bobReply.id, charlieReply.id].join(","), stopped.map(t => t.id).join(","));
    Assert.areEqual(2, host.adapter.requests.length);
    const bob = await host.messages.findAsync(bobReply.id);
    Assert.isNotNull(bob);
    Assert.areEqual(MessageStatus.Cancelled, bob.status);
    const charlie = await host.messages.findAsync(charlieReply.id);
    Assert.isNotNull(charlie);
    Assert.areEqual(MessageStatus.Cancelled, charlie.status);
    Assert.isNull(charlie.startedAt);
    Assert.areEqual(0, host.engine.activeRunCount);
    host.adapter.afterDetails = null;
    host.adapter.holdUntilAbort = false;
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "after", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    Assert.areEqual(3, host.adapter.requests.length);
  }

  @TestMethod
  public async cancelsAndListsTheRepliesAHandOffStoresWhenStopLandsDuringItsTransaction(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const [alice, bob] = await TeammateChainsTests.teamAsync(host, "Alice", "Bob");
    Assert.isDefined(alice);
    Assert.isDefined(bob);
    host.adapter.turnTexts = [["@Bob please review"], ["Bob working"]];
    const stops: Promise<readonly Message[]>[] = [];
    const insert = host.messages.insertAsync.bind(host.messages);
    host.messages.insertAsync = (message: Message, transaction?: SqlTransaction): Promise<void> => {
      if (message.teammateId === bob.id && stops.length === 0)
        stops.push(host.engine.cancelConversationAsync(new ConversationIdParams(conversation.id)));
      return insert(message, transaction);
    };

    await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice go", null, null, [], [alice.id]));
    await host.until("the hand-off's Stop", () => stops.length === 1, host.runs());
    const stop = stops[0];
    Assert.isDefined(stop);
    const stopped = await stop;
    await host.engine.waitForIdle();

    const [, aliceReply, bobReply] = await TeammateChainsTests.chatAsync(host, conversation.id);
    Assert.areEqual(1, host.adapter.requests.length);
    Assert.isDefined(aliceReply);
    Assert.isDefined(bobReply);
    Assert.areEqual(MessageStatus.Completed, aliceReply.status);
    Assert.areEqual(bob.id, bobReply.teammateId);
    Assert.areEqual(MessageStatus.Cancelled, bobReply.status);
    Assert.isNull(bobReply.startedAt);
    Assert.areEqual(bobReply.id, stopped.map(t => t.id).join(","));
    Assert.areEqual(0, host.engine.activeRunCount);
  }

  @TestMethod
  public async listsAReplyAHandOffStoresOnlyInTheFirstOfTwoStopsThatLandDuringItsTransaction(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const [alice, bob] = await TeammateChainsTests.teamAsync(host, "Alice", "Bob");
    Assert.isDefined(alice);
    Assert.isDefined(bob);
    host.adapter.turnTexts = [["@Bob please review"], ["Bob working"]];
    const stops: Promise<readonly Message[]>[] = [];
    const insert = host.messages.insertAsync.bind(host.messages);
    host.messages.insertAsync = (message: Message, transaction?: SqlTransaction): Promise<void> => {
      if (message.teammateId === bob.id && stops.length === 0)
        stops.push(host.engine.cancelConversationAsync(new ConversationIdParams(conversation.id)),
          host.engine.cancelConversationAsync(new ConversationIdParams(conversation.id)));
      return insert(message, transaction);
    };

    await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice go", null, null, [], [alice.id]));
    await host.until("the hand-off's Stops", () => stops.length === 2, host.runs());
    const [first, second] = await Promise.all(stops);
    await host.engine.waitForIdle();

    const [, , bobReply] = await TeammateChainsTests.chatAsync(host, conversation.id);
    Assert.isDefined(first);
    Assert.isDefined(second);
    Assert.isDefined(bobReply);
    Assert.areEqual(MessageStatus.Cancelled, bobReply.status);
    Assert.areEqual(`${bobReply.id}|`, `${first.map(t => t.id).join(",")}|${second.map(t => t.id).join(",")}`);
  }

  @TestMethod
  public async asksForAChainedTurnsApprovalsOnItsOwnReply(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const [alice, bob] = await TeammateChainsTests.teamAsync(host, "Alice", "Bob");
    Assert.isDefined(alice);
    Assert.isDefined(bob);
    host.adapter.turnTexts = [["@Bob run it"], ["Ran it"]];
    host.adapter.approvalAsk = new ApprovalAsk("run", ApprovalKind.Command, "command", "Run tests", null, [TeammateChainsTests.accept]);
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice go", null, null, [], [alice.id]));
    const aliceReply = sent.replies[0];
    Assert.isDefined(aliceReply);
    await host.until("the approval", async () => (await host.approvals.listPendingAsync(aliceReply.id)).length === 1, host.runs());
    const [aliceApproval] = await host.approvals.listPendingAsync(aliceReply.id);
    Assert.isDefined(aliceApproval);
    await host.engine.decideAsync(new ApprovalDecideParams(aliceApproval.id, "accept"));
    await host.until("the teammate awaiting approval", async () => (await TeammateChainsTests.chatAsync(host, conversation.id))[2]?.status === MessageStatus.AwaitingApproval, host.runs());

    const chained = (await TeammateChainsTests.chatAsync(host, conversation.id))[2];
    Assert.isDefined(chained);
    Assert.areEqual(bob.id, chained.teammateId);
    const pending = await host.approvals.listPendingAsync(chained.id);
    Assert.areEqual(1, pending.length);
    const chainedApproval = pending[0];
    Assert.isDefined(chainedApproval);
    Assert.areEqual("Run tests", chainedApproval.summary);
    await host.engine.decideAsync(new ApprovalDecideParams(chainedApproval.id, "accept"));
    await host.engine.waitForIdle();
    const decided = await host.messages.findAsync(chained.id);
    Assert.isNotNull(decided);
    Assert.areEqual(MessageStatus.Completed, decided.status);
    Assert.isTrue(decided.details.some(t => t.text === "decided accept"));
  }

  @TestMethod
  public async stopsAChainedReplyAloneSoItsMentionsStartNoOneWhileTheRepliesAlreadyWaitingKeepTheirTurn(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const [alice] = await TeammateChainsTests.teamAsync(host, "Alice", "Bob", "Charlie", "Dave");
    Assert.isDefined(alice);
    host.adapter.turnTexts = [["@Bob, @Charlie, go"], ["@Dave next"], ["Charlie done"]];
    host.adapter.afterDetails = () => { host.adapter.holdUntilAbort = host.adapter.requests.length === 2; };
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice go", null, null, [], [alice.id]));
    await host.adapter.requested(2);
    await host.until("the held third turn", () => host.adapter.holdUntilAbort, host.runs());
    const [, , bobReply, charlieReply] = await TeammateChainsTests.chatAsync(host, conversation.id);
    Assert.isDefined(bobReply);
    Assert.isDefined(charlieReply);

    const stopped = await host.engine.cancelAsync(new MessageIdParams(bobReply.id));
    await host.engine.waitForIdle();

    Assert.areEqual(MessageStatus.Cancelled, stopped.status);
    const charlieStored = await host.messages.findAsync(charlieReply.id);
    Assert.isNotNull(charlieStored);
    Assert.areEqual(MessageStatus.Completed, charlieStored.status);
    Assert.areEqual(3, host.adapter.requests.length);
    Assert.areEqual("Alice,Bob,Charlie", (await TeammateChainsTests.chatAsync(host, conversation.id)).slice(1).map(t => t.teammateName).join(","));
  }

  @TestMethod
  public async refusesAHandOffWhoseChatsReplyEndsWhileItIsPlannedAndLeavesThatChatFree(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const first = await host.createConversationAsync(project);
    const second = await host.createConversationAsync(project);
    const [alice, bob] = await TeammateChainsTests.teamAsync(host, "Alice", "Bob");
    Assert.isDefined(alice);
    Assert.isDefined(bob);
    const settings = new RequestedSettings("fake", null, null);
    const providerId = (await host.providerOfAsync()).id;
    const held = Promise.withResolvers<void>();
    const handOffs: Promise<ServiceException>[] = [];
    const lists = { counting: false, count: 0, reply: "" };
    host.adapter.holdTurn = async (request, signal) => {
      if (request === host.adapter.requests[0])
        return signal.aborted ? undefined : new Promise<void>(resolve => signal.addEventListener("abort", () => resolve(), { once: true }));
      if (request !== host.adapter.requests[1])
        return undefined;
      lists.counting = true;
      handOffs.push(Assert.throwsAsync(() => host.engine.sendAllowedAsync(new MessageSendParams(second.id, "@Bob take it", null, null, [], [bob.id], null,
        SenderEnvironment.read(request.environment)), "Bob"), ServiceException));
      return held.promise;
    };
    const listAsync = host.teammates.listAsync.bind(host.teammates);
    host.teammates.listAsync = async transaction => {
      if (lists.counting && ++lists.count === 2)
        await host.engine.cancelAsync(new MessageIdParams(lists.reply));
      return listAsync(transaction);
    };
    const [running] = (await host.engine.sendAsync(new MessageSendParams(second.id, "Check", settings, providerId))).replies;
    Assert.isDefined(running);
    lists.reply = running.id;
    await host.adapter.requested(1);

    await host.engine.sendAsync(new MessageSendParams(first.id, "@Alice hand it to Bob", null, null, [], [alice.id]));
    await host.until("the hand-off", () => handOffs.length === 1, host.runs());
    const refused = await Promise.all(handOffs);
    held.resolve();
    await host.engine.waitForIdle();
    const after = await host.engine.sendAsync(new MessageSendParams(second.id, "Again", settings, providerId));
    await host.engine.waitForIdle();

    Assert.areEqual(JSON.stringify([new ServiceRefusal(ErrorCode.Conflict, Resources.replyEndedWhileSent)]),
      JSON.stringify(refused.map(t => new ServiceRefusal(t.info.name, t.message))));
    const runningStored = await host.messages.findAsync(running.id);
    Assert.isNotNull(runningStored);
    Assert.areEqual(MessageStatus.Cancelled, runningStored.status);
    Assert.isFalse((await TeammateChainsTests.chatAsync(host, second.id)).some(t => t.teammateId === bob.id));
    const afterReply = after.replies[0];
    Assert.isDefined(afterReply);
    const afterStored = await host.messages.findAsync(afterReply.id);
    Assert.isNotNull(afterStored);
    Assert.areEqual(MessageStatus.Completed, afterStored.status);
    Assert.areEqual(3, host.adapter.requests.length);
  }

  @TestMethod
  public async refusesAHandOffWhoseSendersTurnEndsWhileItIsPlannedAndStoresNothing(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const first = await host.createConversationAsync(project);
    const second = await host.createConversationAsync(project);
    const [alice, bob] = await TeammateChainsTests.teamAsync(host, "Alice", "Bob");
    Assert.isDefined(alice);
    Assert.isDefined(bob);
    const handOffs: Promise<ServiceException>[] = [];
    const lists = { counting: false, count: 0, planned: false };
    host.adapter.holdTurn = async request => {
      if (request !== host.adapter.requests[0])
        return;
      lists.counting = true;
      handOffs.push(Assert.throwsAsync(() => host.engine.sendAllowedAsync(new MessageSendParams(second.id, "@Bob take it", null, null, [], [bob.id], null,
        SenderEnvironment.read(request.environment)), "Bob"), ServiceException));
      await host.until("the hand-off's second plan", () => lists.planned);
    };
    const listAsync = host.teammates.listAsync.bind(host.teammates);
    host.teammates.listAsync = async transaction => {
      if (lists.counting && ++lists.count === 2) {
        lists.planned = true;
        ChangeSignal.notify();
        await host.until("the sender's ended turn", () => host.engine.activeRunCount === 0);
      }
      return listAsync(transaction);
    };

    await host.engine.sendAsync(new MessageSendParams(first.id, "@Alice hand it to Bob", null, null, [], [alice.id]));
    await host.until("the hand-off", () => handOffs.length === 1, host.runs());
    const refused = await Promise.all(handOffs);
    await host.engine.waitForIdle();

    Assert.areEqual(JSON.stringify([new ServiceRefusal(ErrorCode.Unauthorized, Resources.senderTurnEnded)]),
      JSON.stringify(refused.map(t => new ServiceRefusal(t.info.name, t.message))));
    Assert.isTrue(lists.planned);
    Assert.areEqual(0, (await TeammateChainsTests.chatAsync(host, second.id)).length);
    Assert.areEqual(1, host.adapter.requests.length);
  }

  @TestMethod
  public async announcesATeammatesSendFromItsTurnByItsTokenAndAbandonsItByItsId(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const first = await host.createConversationAsync(project);
    const second = await host.createConversationAsync(project);
    const third = await host.createConversationAsync(project);
    const [alice] = await TeammateChainsTests.teamAsync(host, "Alice");
    Assert.isDefined(alice);
    host.adapter.holdUntilAbort = true;
    const tokenAfterAsync = async (send: MessageSendParams): Promise<SentTurn> => {
      const before = host.adapter.requests.length;
      const sent = await host.engine.sendAsync(send);
      await host.adapter.requested(before + 1);
      const request = host.adapter.requests.at(-1);
      Assert.isDefined(request);
      return new SentTurn(SenderEnvironment.read(request.environment), sent.replies.map(t => t.id));
    };
    const alicesTurn = await tokenAfterAsync(new MessageSendParams(first.id, "@Alice start", null, null, [], [alice.id]));
    const defaultTurn = await tokenAfterAsync(new MessageSendParams(third.id, "Tidy", new RequestedSettings("fake", null, null),
      (await host.providerOfAsync()).id));
    const sendTo = (senderToken: string | null): MessageSendParams => new MessageSendParams(second.id, "Done", null, null, [], [alice.id], null, senderToken);

    const sendId = host.engine.announceSend(sendTo(alicesTurn.token));
    host.engine.abandonSend("send-1");
    const quiet = [host.engine.announceSend(sendTo(null)), host.engine.announceSend(sendTo("ended")), host.engine.announceSend(sendTo(defaultTurn.token))];
    for (const reply of [...alicesTurn.replies, ...defaultTurn.replies])
      await host.engine.cancelAsync(new MessageIdParams(reply));
    await host.engine.waitForIdle();

    Assert.areEqual(JSON.stringify([new PublishedEvent(EventName.MessageSending, { sendId, chatId: first.id, teammateId: alice.id, toChatId: second.id }),
      new PublishedEvent(EventName.MessageSendAbandoned, { sendId: "send-1" })]),
    JSON.stringify(host.listener.events.filter(t => t.name === EventName.MessageSending || t.name === EventName.MessageSendAbandoned)
      .map(t => new PublishedEvent(t.name, t.payload))));
    Assert.areEqual("null,null,null", quiet.map(String).join(","));
  }

  private static async teamAsync(host: CoreHost, ...names: string[]): Promise<Teammate[]> {
    const provider = await host.createProviderAsync();
    const team: Teammate[] = [];
    for (const name of names)
      team.push(await host.teammates.createAsync(new TeammateCreateParams(name, `${name}'s role`, provider.id, Harness.Provider, null, null)));
    return team;
  }

  private static onProvider(teammate: Teammate, providerId: string): TeammateUpdateParams {
    return new TeammateUpdateParams(teammate.id, teammate.name, teammate.role, providerId, Harness.Provider, null, null);
  }

  private static chatAsync(host: CoreHost, conversationId: string): Promise<readonly Message[]> {
    return host.messages.listAsync(new MessageListParams(conversationId, null));
  }
}
