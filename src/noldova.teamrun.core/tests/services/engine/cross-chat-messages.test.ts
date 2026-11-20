/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { join } from "node:path";

import "@noldova/context.core";
import { ServiceException } from "@noldova/teamrun.services";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Resources, TeammateCommand, TurnOutcome } from "@noldova/teamrun.core";
import {
  ConversationIdParams,
  ConversationMemberParams,
  ConversationResponder,
  ConversationResponderParams,
  DetailKind,
  ErrorCode,
  EventName,
  Harness,
  Message,
  MessageAuthor,
  MessageIdParams,
  MessageListParams,
  MessageSendParams,
  type MessageSendResult,
  MessageStatus,
  ObservedSettings,
  Provenance,
  ProviderCreateParams,
  ProviderEnabledParams,
  ProviderIdParams,
  RequestedSettings,
  SenderEnvironment,
  type Teammate,
  TeammateCreateParams,
  TeammateIdParams
} from "@noldova/teamrun.protocol";

import { CoreHost } from "../../fixtures/core-host.fixture.js";

@TestClass
export class CrossChatMessagesTests {
  @TestMethod
  public async sendsAsTheTeammateWhoseRunningTurnGaveTheTokenAndStartsTheTargetChatsTeammate(): Promise<void> {
    await using host = await CoreHost.createAsync(false, false, undefined, undefined, () => Promise.resolve(new TeammateCommand("acme teamrun", { PATH: "/command" })));
    const project = await host.openProjectAsync();
    const first = await host.createConversationAsync(project, "Release plan");
    const second = await host.createConversationAsync(project);
    const [alice, bob] = await CrossChatMessagesTests.teamAsync(host, "Alice", "Bob");
    const crossed: Promise<MessageSendResult>[] = [];
    host.adapter.afterDetails = async () => {
      if (host.adapter.requests.length === 1)
        crossed.push(host.engine.sendAsync(CrossChatMessagesTests.from(host, second.id, "@Bob what changed?", [bob!])));
      await Promise.allSettled(crossed);
    };

    const asked = await host.engine.sendAsync(new MessageSendParams(first.id, "@Alice ask Bob", null, null, [], [alice!.id]));
    await host.engine.waitForIdle();
    const result = await crossed[0]!;
    await host.engine.waitForIdle();

    Assert.isNull(asked.sent.sender);
    const sent = (await host.messages.findAsync(result.sent.id))!;
    Assert.areEqual(MessageAuthor.User, sent.author);
    Assert.areEqual([first.id, alice!.id, "Alice"].join(","), [sent.sender?.conversationId, sent.sender?.teammateId, sent.sender?.name].join(","));
    Assert.areEqual(MessageStatus.Completed, (await host.messages.findAsync(result.replies[0]!.id))!.status);
    Assert.areEqual(bob!.id, result.replies[0]!.teammateId);
    Assert.isTrue(host.adapter.requests[1]!.prompt.endsWith(`From @Alice in chat "Release plan" (${first.id}): @Bob what changed?`));
    const tokens = host.adapter.requests.map(t => SenderEnvironment.read(t.environment) ?? String.empty);
    Assert.areEqual("PATH,TEAMRUN_SENDER_TOKEN", Object.keys(host.adapter.requests[0]!.environment).join(","));
    Assert.areEqual("/command", host.adapter.requests[0]!.environment["PATH"]);
    Assert.isTrue(tokens.every(t => /^[A-Za-z0-9_-]{43}$/.test(t)));
    Assert.areNotEqual(tokens[0], tokens[1]);
    Assert.areEqual(Resources.formatTeammateInstructions("Bob's role", "acme teamrun"), host.adapter.requests[1]!.instructions);
    Assert.isTrue(host.listener.events.some(t => t.name === EventName.MessageCreated && Message.fromJson(t.payload).sender?.teammateId === alice!.id));
    Assert.isNotNull(await host.conversations.findMemberAsync(new ConversationMemberParams(second.id, bob!.id)));
  }

  @TestMethod
  public async readsATeammatesSendByTheQuoteRuleSoAQuotedNameStartsNoOne(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const first = await host.createConversationAsync(project);
    const second = await host.createConversationAsync(project);
    const [alice, bob, opus] = await CrossChatMessagesTests.teamAsync(host, "Alice", "Bob", "Opus");
    const text = "In her \"@Opus hi\" chat, @Bob what changed?";
    const crossed: Promise<MessageSendResult>[] = [];
    const refusals: unknown[] = [];
    host.adapter.afterDetails = async () => {
      if (host.adapter.requests.length !== 1)
        return;
      const refused = host.engine.sendAsync(CrossChatMessagesTests.from(host, second.id, text, [opus!, bob!])).catch((t: unknown) => refusals.push(t));
      crossed.push(host.engine.sendAsync(CrossChatMessagesTests.from(host, second.id, text, [bob!])));
      await Promise.allSettled([refused, ...crossed]);
    };

    await host.engine.sendAsync(new MessageSendParams(first.id, "@Alice ask Bob", null, null, [], [alice!.id]));
    await host.engine.waitForIdle();
    const result = await crossed[0]!;
    await host.engine.waitForIdle();

    Assert.isInstanceOf(refusals[0], ServiceException);
    Assert.areEqual(ErrorCode.Conflict, (refusals[0] as ServiceException).info.name);
    Assert.areEqual(bob!.id, (await host.messages.findAsync(result.sent.id))!.mentions.map(t => t.teammateId).join(","));
    Assert.areEqual(bob!.id, result.replies.map(t => t.teammateId).join(","));
    Assert.isNull(await host.conversations.findMemberAsync(new ConversationMemberParams(second.id, opus!.id)));
  }

  @TestMethod
  public async neverStartsTheTeammateASendNamesAsItsSenderOrGivesAsItsResponderAndLetsTheGivenResponderAnswerWhenNoOneElseIsNamed(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const first = await host.createConversationAsync(project);
    const second = await host.createConversationAsync(project);
    const [alice, bob, carol] = await CrossChatMessagesTests.teamAsync(host, "Alice", "Bob", "Carol");
    await host.conversations.addMemberAsync(new ConversationMemberParams(second.id, carol!.id));
    const results: Promise<MessageSendResult>[] = [];
    host.adapter.afterDetails = async () => {
      if (host.adapter.requests.length !== 1)
        return;
      const token = SenderEnvironment.read(host.adapter.requests[0]!.environment);
      results.push(host.engine.sendAsync(CrossChatMessagesTests.from(host, second.id, "Hi, this is @Alice from the other chat. @Bob what changed?", [alice!, bob!])));
      results.push(host.engine.sendAsync(new MessageSendParams(second.id, "Hi, this is @Alice", null, null, [], [alice!.id], carol!.id, token)));
      results.push(host.engine.sendAsync(CrossChatMessagesTests.from(host, second.id, "This is @Alice", [alice!])));
      results.push(host.engine.sendAsync(new MessageSendParams(second.id, "Over to me", null, null, [], [], alice!.id, token)));
      await Promise.allSettled(results);
    };

    await host.engine.sendAsync(new MessageSendParams(first.id, "@Alice ask Bob", null, null, [], [alice!.id]));
    await host.engine.waitForIdle();
    const [named, given, alone, itself] = await Promise.all(results);
    await host.engine.waitForIdle();

    Assert.areEqual([alice!.id, bob!.id].join(","), (await host.messages.findAsync(named!.sent.id))!.mentions.map(t => t.teammateId).join(","));
    Assert.areEqual(bob!.id, named!.replies.map(t => t.teammateId).join(","));
    Assert.areEqual(alice!.id, (await host.messages.findAsync(given!.sent.id))!.mentions.map(t => t.teammateId).join(","));
    Assert.areEqual(carol!.id, given!.replies.map(t => t.teammateId).join(","));
    Assert.areEqual(0, alone!.replies.length);
    Assert.isNotNull(await host.messages.findAsync(alone!.sent.id));
    Assert.areEqual(0, itself!.replies.length);
    Assert.isNotNull(await host.messages.findAsync(itself!.sent.id));
    Assert.isNull(await host.conversations.findMemberAsync(new ConversationMemberParams(second.id, alice!.id)));
    Assert.isFalse((await CrossChatMessagesTests.chatAsync(host, second.id)).some(t => t.teammateId === alice!.id));
  }

  @TestMethod
  public async answersATeammatesSendNamingNoOneByTheTeammateOrDefaultTeammateTheTargetChatChoseAndPostsItForNoOneOtherwise(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const first = await host.createConversationAsync(project);
    const [alice, bob, carol, dave] = await CrossChatMessagesTests.teamAsync(host, "Alice", "Bob", "Carol", "Dave");
    const spare = await host.createProviderAsync("fake", "Spare");
    const lost = await host.createProviderAsync("fake", "Lost");
    const off = await host.createProviderAsync("fake", "Off");
    const chat = async (members: readonly Teammate[], chosen: Teammate | ConversationResponder | null): Promise<string> => {
      const target = await host.createConversationAsync(project);
      for (const member of members)
        await host.conversations.addMemberAsync(new ConversationMemberParams(target.id, member.id));
      const responder = Object.isNull(chosen) || chosen instanceof ConversationResponder ? chosen : new ConversationResponder(chosen.id);
      await host.conversations.setResponderAsync(new ConversationResponderParams(target.id, responder));
      return target.id;
    };
    const chosenBob = await chat([bob!, carol!], bob!);
    const chosenSender = await chat([alice!, bob!], alice!);
    const chosenGone = await chat([dave!], dave!);
    const chosenOutside = await chat([bob!], carol!);
    const unchosen = await chat([bob!], null);
    const overridden = await chat([bob!, carol!], bob!);
    const chosenDefault = await chat([], new ConversationResponder(null, new RequestedSettings("fake", "m2", "high"), spare.id));
    const chosenUnknown = await chat([], new ConversationResponder(null, new RequestedSettings("missing", null, null)));
    const chosenProviderGone = await chat([], new ConversationResponder(null, new RequestedSettings("fake", null, null), lost.id));
    const chosenNoProvider = await chat([], new ConversationResponder(null, new RequestedSettings("fake", null, null)));
    const chosenProviderDisabled = await chat([], new ConversationResponder(null, new RequestedSettings("fake", null, null), off.id));
    await host.providers.setEnabledAsync(new ProviderEnabledParams(off.id, false));
    await host.teammates.deleteAsync(new TeammateIdParams(dave!.id));
    await host.providers.deleteAsync(new ProviderIdParams(lost.id));
    const results: Promise<MessageSendResult>[] = [];
    host.adapter.afterDetails = async () => {
      if (host.adapter.requests.length !== 1)
        return;
      const token = SenderEnvironment.read(host.adapter.requests[0]!.environment);
      for (const target of [chosenBob, chosenSender, chosenGone, chosenOutside, unchosen, chosenDefault, chosenUnknown, chosenProviderGone,
        chosenNoProvider, chosenProviderDisabled])
        results.push(host.engine.sendAsync(new MessageSendParams(target, "What changed?", null, null, [], [], null, token)));
      results.push(host.engine.sendAsync(new MessageSendParams(overridden, "What changed?", null, null, [], [], carol!.id, token)));
      results.push(host.engine.sendAsync(new MessageSendParams(chosenBob, "This is @Alice", null, null, [], [alice!.id], null, token)));
      await Promise.allSettled(results);
    };

    await host.engine.sendAsync(new MessageSendParams(first.id, "@Alice ask around", null, null, [], [alice!.id]));
    await host.engine.waitForIdle();
    const sent = await Promise.all(results);
    const answered = sent.map(t => t.replies.map(u => u.teammateId ?? "default").join("+"));
    await host.engine.waitForIdle();

    Assert.areEqual([bob!.id, "", "", "", "", "default", "", "", "", "", carol!.id, bob!.id].join(","), answered.join(","));
    Assert.isNull(await host.conversations.findMemberAsync(new ConversationMemberParams(chosenOutside, carol!.id)));
    const fallback = (await host.messages.findAsync(sent[5]!.replies[0]!.id))!.provenance!;
    Assert.areEqual(`fake m2 high ${spare.id}`, `${fallback.requested.kind} ${fallback.requested.model} ${fallback.requested.effort} ${fallback.providerId}`);
    Assert.areEqual(MessageStatus.Completed, (await host.messages.findAsync(sent[5]!.replies[0]!.id))!.status);
  }

  @TestMethod
  public async givesTheDefaultTeammateTheNoteAndATokenThatItsTurnsEndRevokes(): Promise<void> {
    await using host = await CoreHost.createAsync(false, false, undefined, undefined, () => Promise.resolve(new TeammateCommand("acme teamrun", { PATH: "/command" })));
    const conversation = await host.createConversationAsync(await host.openProjectAsync());
    const target = await host.createConversationAsync(await host.openProjectAsync());

    await host.engine.sendAsync(new MessageSendParams(conversation.id, "Hi", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    const ended = await Assert.throwsAsync(() => host.engine.sendAsync(CrossChatMessagesTests.from(host, target.id, "Hi", [])), ServiceException);

    Assert.areEqual(Resources.formatTeammateInstructions(null, "acme teamrun"), host.adapter.requests[0]!.instructions);
    Assert.areEqual("PATH,TEAMRUN_SENDER_TOKEN", Object.keys(host.adapter.requests[0]!.environment).join(","));
    Assert.isTrue(/^[A-Za-z0-9_-]{43}$/.test(SenderEnvironment.read(host.adapter.requests[0]!.environment) ?? String.empty));
    Assert.areEqual(ErrorCode.Unauthorized, ended.info.name);
    Assert.areEqual(0, (await CrossChatMessagesTests.chatAsync(host, target.id)).length);
  }

  @TestMethod
  public async answersADefaultTeammatesSendNamingNoOneByTheOtherChatsChosenDefaultTeammateWithThatChatsSettingsAndProvider(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const first = await host.createConversationAsync(project, "Release plan");
    const second = await host.createConversationAsync(project, "Fixes");
    const provider = await host.createProviderAsync("fake", "Fixes");
    await host.conversations.setResponderAsync(new ConversationResponderParams(second.id, new ConversationResponder(null, new RequestedSettings("fake", "m2", "high"), provider.id)));
    const crossed: Promise<MessageSendResult>[] = [];
    host.adapter.afterDetails = async () => {
      if (host.adapter.requests.length === 1)
        crossed.push(host.engine.sendAsync(CrossChatMessagesTests.from(host, second.id, "What changed?", [])));
      await Promise.allSettled(crossed);
    };

    await host.engine.sendAsync(new MessageSendParams(first.id, "Ask the other chat", new RequestedSettings("fake", "m1", null), (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    await host.until("the crossed send", () => crossed.length === 1, host.runs());
    const [asked] = await Promise.all(crossed);
    await host.engine.waitForIdle();

    const sender = (await host.messages.findAsync(asked!.sent.id))!.sender;
    Assert.areEqual([first.id, "null", "Fake provider · fake"].join(","), [sender?.conversationId, String(sender?.teammateId), sender?.name].join(","));
    Assert.areEqual(1, asked!.replies.length);
    const reply = (await host.messages.findAsync(asked!.replies[0]!.id))!;
    Assert.areEqual(`${second.id} null fake m2 high ${provider.id}`, [reply.conversationId, String(reply.teammateId), reply.provenance?.requested.kind,
      reply.provenance?.requested.model, reply.provenance?.requested.effort, reply.provenance?.providerId].join(" "));
    Assert.areEqual(MessageStatus.Completed, reply.status);
    Assert.isTrue(host.adapter.requests[1]?.prompt.endsWith(`From the default teammate (Fake provider · fake) in chat "Release plan" (${first.id}): What changed?`) === true);
  }

  @TestMethod
  public async namesEachDefaultTeammatesSendByItsProviderAsTheWindowNamesItsRepliesAndByTheKindForAGoneOrOwnNamedProviderOrOneTooLong(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const inbox = await host.createConversationAsync(project, "Inbox");
    const gone = await host.createProviderAsync("fake", "Gone");
    const providers = [await host.createProviderAsync("fake", "Work"), await host.createProviderAsync("fake", "Personal"),
      await host.createProviderAsync("fake", "Fake provider"),
      await host.providers.createAsync(new ProviderCreateParams("fake", "L".repeat(90), join(host.directory.path, "profiles", "long")))];
    const runs = [...providers.map(t => t.id), gone.id];
    const crossed: Promise<MessageSendResult>[] = [];
    host.adapter.afterDetails = async () => {
      if (crossed.length >= host.adapter.requests.length)
        return;
      if (crossed.length === runs.length - 1)
        await host.providers.deleteAsync(new ProviderIdParams(gone.id));
      crossed.push(host.engine.sendAsync(CrossChatMessagesTests.from(host, inbox.id, "Done here", [])));
      await Promise.allSettled(crossed);
    };

    for (const [index, providerId] of runs.entries()) {
      const chat = await host.createConversationAsync(project, `Chat ${index}`);
      await host.engine.sendAsync(new MessageSendParams(chat.id, "Tell the inbox", new RequestedSettings("fake", null, null), providerId));
      await host.engine.waitForIdle();
    }
    const sent = await Promise.all(crossed);

    Assert.areEqual(["Fake provider · Work", "Fake provider · Personal", ...Array<string>(3).fill("Fake provider")].join("|"),
      (await Promise.all(sent.map(t => host.messages.findAsync(t.sent.id)))).map(t => t?.sender?.name).join("|"));
    Assert.areEqual(0, sent.reduce((count, t) => count + t.replies.length, 0));
  }

  @TestMethod
  public async sendsAsTheChatsDefaultTeammateUnderItsProvidersNameAndTheAnswerReachesItsChat(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const first = await host.createConversationAsync(project, "Release plan");
    const second = await host.createConversationAsync(project, "Fixes");
    const [bob] = await CrossChatMessagesTests.teamAsync(host, "Bob");
    const provider = await host.createProviderAsync("fake", "Home");
    await host.conversations.setResponderAsync(new ConversationResponderParams(first.id, new ConversationResponder(null, new RequestedSettings("fake", "m3", null), provider.id)));
    const crossed: Promise<MessageSendResult>[] = [];
    host.adapter.afterDetails = async () => {
      if (host.adapter.requests.length === 1) {
        crossed.push(host.engine.sendAsync(CrossChatMessagesTests.from(host, second.id, "@Bob what changed?", [bob!])));
        crossed.push(host.engine.sendAsync(CrossChatMessagesTests.from(host, first.id, "A note to this chat", [])));
      }
      else if (host.adapter.requests.length === 2)
        crossed.push(host.engine.sendAsync(CrossChatMessagesTests.from(host, first.id, "The login fix", [])));
      await Promise.allSettled(crossed);
    };

    await host.engine.sendAsync(new MessageSendParams(first.id, "Ask Bob", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    await host.until("three crossed sends", () => crossed.length === 3, host.runs());
    const [asked, own, answer] = await Promise.all(crossed);
    await host.until("the completed answer", async () => (await host.messages.findAsync(answer!.replies[0]!.id))?.status === MessageStatus.Completed, host.runs());
    await host.engine.waitForIdle();

    const sent = (await host.messages.findAsync(asked!.sent.id))!;
    Assert.areEqual([first.id, "null", "Fake provider · fake"].join(","), [sent.sender?.conversationId, String(sent.sender?.teammateId), sent.sender?.name].join(","));
    Assert.isTrue(host.adapter.requests[1]?.prompt.endsWith(`From the default teammate (Fake provider · fake) in chat "Release plan" (${first.id}): @Bob what changed?`) === true);
    Assert.areEqual(0, own!.replies.length);
    Assert.areEqual(bob!.id, (await host.messages.findAsync(answer!.sent.id))!.sender?.teammateId);
    Assert.areEqual("null m3", answer!.replies.map(t => `${t.teammateId} ${t.provenance?.requested.model}`).join(","));
    Assert.areEqual(MessageStatus.Completed, (await host.messages.findAsync(answer!.replies[0]!.id))!.status);
    Assert.isTrue(host.adapter.requests[2]!.prompt.endsWith(`From @Bob in chat "Fixes" (${second.id}): The login fix`));
  }

  @TestMethod
  public async givesATeammateOnlyItsRoleThePlanToolLineAndTokenWhenTheAppHasNoCommandForIt(): Promise<void> {
    await using host = await CoreHost.createAsync(false, false, undefined, undefined, () => Promise.resolve(null));
    const conversation = await host.createConversationAsync(await host.openProjectAsync());
    const [alice] = await CrossChatMessagesTests.teamAsync(host, "Alice");

    await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice hi", null, null, [], [alice!.id]));
    await host.engine.waitForIdle();

    Assert.areEqual(`Alice's role\n\n${Resources.planToolInstructions}`, host.adapter.requests[0]!.instructions);
    Assert.areEqual("TEAMRUN_SENDER_TOKEN", Object.keys(host.adapter.requests[0]!.environment).join(","));
  }

  @TestMethod
  public async listsAReplyAnotherChatsTeammateSendsBetweenTwoStopsInOnlyOneOfThem(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const first = await host.createConversationAsync(project, "Plans");
    const second = await host.createConversationAsync(project, "Fixes");
    const [bob, carol, dana] = await CrossChatMessagesTests.teamAsync(host, "Bob", "Carol", "Dana");
    const bobHeld = Promise.withResolvers<void>();
    host.adapter.holdTurn = request => request === host.adapter.requests[0] ? bobHeld.promise : Promise.resolve();
    const stops: Promise<readonly Message[]>[] = [];
    const crossed: Promise<MessageSendResult>[] = [];
    host.adapter.afterDetails = () => {
      if (host.adapter.requests.length === 2 && crossed.length === 0)
        crossed.push(host.engine.sendAsync(CrossChatMessagesTests.from(host, second.id, "@Carol help Bob", [carol!])).then(t => {
          stops.push(host.engine.cancelConversationAsync(new ConversationIdParams(second.id)));
          return t;
        }));
      return crossed[0];
    };

    const started = await host.engine.sendAsync(new MessageSendParams(second.id, "@Bob start", null, null, [], [bob!.id]));
    await host.adapter.requested(1);
    stops.push(host.engine.cancelConversationAsync(new ConversationIdParams(second.id)));
    await host.engine.sendAsync(new MessageSendParams(first.id, "@Dana ask Carol", null, null, [], [dana!.id]));
    await host.until("the second Stop", () => stops.length === 2, host.runs());
    const carolReply = (await crossed[0]!).replies[0]!;
    bobHeld.resolve();
    const [before, after] = await Promise.all(stops);
    await host.engine.waitForIdle();

    Assert.areEqual(MessageStatus.Cancelled, (await host.messages.findAsync(carolReply.id))!.status);
    Assert.areEqual(`${started.replies[0]!.id},${carolReply.id}|`, `${before!.map(t => t.id).join(",")}|${after!.map(t => t.id).join(",")}`);
  }

  @TestMethod
  public async queuesATeammatesMessageToItsBusyChatAfterTheRunningReplyAndStillRefusesThePersons(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const second = await host.createConversationAsync(project, "Fixes");
    const [bob, carol] = await CrossChatMessagesTests.teamAsync(host, "Bob", "Carol");
    const providerId = (await host.providerOfAsync()).id;
    const crossed: Promise<MessageSendResult>[] = [];
    const refusals: unknown[] = [];
    host.adapter.afterDetails = () => {
      if (host.adapter.requests.length === 1) {
        crossed.push(host.engine.sendAsync(CrossChatMessagesTests.from(host, second.id, "@Carol help Bob", [carol!])));
        void host.engine.sendAsync(new MessageSendParams(second.id, "busy", new RequestedSettings("fake", null, null), providerId)).catch((t: unknown) => refusals.push(t));
      }
      return crossed[0];
    };

    const started = await host.engine.sendAsync(new MessageSendParams(second.id, "@Bob start", null, null, [], [bob!.id]));
    await host.engine.waitForIdle();
    const result = await crossed[0]!;

    Assert.isInstanceOf(refusals[0], ServiceException);
    Assert.areEqual(ErrorCode.Conflict, (refusals[0] as ServiceException).info.name);
    Assert.areEqual(1, result.replies.length);
    Assert.areEqual(MessageStatus.Pending, result.replies[0]!.status);
    const bobReply = (await host.messages.findAsync(started.replies[0]!.id))!;
    const carolReply = (await host.messages.findAsync(result.replies[0]!.id))!;
    Assert.areEqual(MessageStatus.Completed, carolReply.status);
    Assert.isTrue(carolReply.startedAt! >= bobReply.endedAt!);
    Assert.areEqual(2, host.adapter.requests.length);
    Assert.isTrue(host.adapter.requests[1]!.prompt.includes(`From @Bob in chat "Fixes" (${second.id}): @Carol help Bob`));
    Assert.areEqual("Bob,Carol", (await CrossChatMessagesTests.chatAsync(host, second.id)).filter(t => t.author === MessageAuthor.Provider).map(t => t.teammateName).join(","));
    Assert.areEqual(0, host.engine.activeRunCount);
  }

  @TestMethod
  public async refusesAForgedTokenOrOneWhoseTurnEndedAndAMissingOrBusyChat(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const first = await host.createConversationAsync(project);
    const second = await host.createConversationAsync(project);
    const [alice, bob] = await CrossChatMessagesTests.teamAsync(host, "Alice", "Bob");
    await host.messages.insertAsync(new Message("open", second.id, 0, MessageAuthor.Provider, null, MessageStatus.Running, [],
      new Provenance(null, new RequestedSettings("fake", null, null), new ObservedSettings(null, null, null, null), null, false), "t", "t", null));
    const refusal = async (params: MessageSendParams): Promise<ServiceException> => Assert.throwsAsync(() => host.engine.sendAsync(params), ServiceException);
    const during: Promise<ServiceException>[] = [];
    host.adapter.afterDetails = () => {
      during.push(refusal(CrossChatMessagesTests.from(host, "missing", "@Bob hi", [bob!])));
      during.push(refusal(CrossChatMessagesTests.from(host, second.id, "@Bob hi", [bob!])));
    };

    await host.engine.sendAsync(new MessageSendParams(first.id, "@Alice ask Bob", null, null, [], [alice!.id]));
    await host.engine.waitForIdle();
    const [target, busy] = await Promise.all(during);
    const ended = await refusal(CrossChatMessagesTests.from(host, first.id, "@Bob hi", [bob!]));
    const forged = await refusal(new MessageSendParams(first.id, "@Bob hi", null, null, [], [bob!.id], null, "forged"));

    Assert.areEqual([ErrorCode.NotFound, ErrorCode.Conflict, ErrorCode.Unauthorized, ErrorCode.Unauthorized].join(","),
      [target!, busy!, ended, forged].map(t => t.info.name).join(","));
    Assert.areEqual(Resources.senderTurnEnded, ended.message);
    Assert.areEqual(0, ended.info.arguments.length);
    Assert.areEqual("open", (await CrossChatMessagesTests.chatAsync(host, second.id)).map(t => t.id).join(","));
    Assert.areEqual(2, (await CrossChatMessagesTests.chatAsync(host, first.id)).length);
    Assert.areEqual(1, host.adapter.requests.length);
  }

  @TestMethod
  public async refusesATeammatesSendThatAsksForAnUnrestrictedModeAndSendsOneThatAsksForAnotherMode(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const first = await host.createConversationAsync(project);
    const second = await host.createConversationAsync(project);
    const third = await host.createConversationAsync(project);
    const [alice] = await CrossChatMessagesTests.teamAsync(host, "Alice");
    const providerId = (await host.providerOfAsync()).id;
    host.adapter.modeIds = ["default", "bypass"];
    host.adapter.unrestrictedModes = ["bypass"];
    const during: Promise<unknown>[] = [];
    host.adapter.afterDetails = async () => {
      if (host.adapter.requests.length !== 1)
        return;
      const token = SenderEnvironment.read(host.adapter.requests[0]!.environment);
      const asking = (conversationId: string, mode: string): MessageSendParams =>
        new MessageSendParams(conversationId, "Check the build", new RequestedSettings("fake", null, null, null, mode), providerId, [], [], null, token);
      during.push(Assert.throwsAsync(() => host.engine.sendAsync(asking(second.id, "bypass")), ServiceException));
      during.push(host.engine.sendAsync(asking(third.id, "default")));
      await Promise.allSettled(during);
    };

    await host.engine.sendAsync(new MessageSendParams(first.id, "@Alice check the build", null, null, [], [alice!.id]));
    await host.engine.waitForIdle();
    const [refused] = await Promise.all(during) as [ServiceException, MessageSendResult];
    await host.engine.waitForIdle();

    Assert.areEqual(ErrorCode.Unauthorized, refused.info.name);
    Assert.areEqual(Resources.unrestrictedModeRefused, refused.message);
    Assert.areEqual("fake,bypass", refused.info.arguments.join(","));
    Assert.areEqual(0, (await CrossChatMessagesTests.chatAsync(host, second.id)).length);
    Assert.areEqual("null,default", host.adapter.requests.map(t => String(t.requested.mode)).join(","));
  }

  @TestMethod
  public async runsATeammatesSendInANewGroupWhenTheChatsGroupEndsDuringItsModeCheck(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const first = await host.createConversationAsync(project);
    const second = await host.createConversationAsync(project);
    const [alice, bob] = await CrossChatMessagesTests.teamAsync(host, "Alice", "Bob");
    const providerId = (await host.providerOfAsync()).id;
    host.adapter.modeIds = ["default", "bypass"];
    host.adapter.unrestrictedModes = ["bypass"];
    const turns = [Promise.withResolvers<void>(), Promise.withResolvers<void>()];
    const check = Promise.withResolvers<void>();
    host.adapter.holdTurn = t => turns[host.adapter.requests.indexOf(t)]?.promise ?? Promise.resolve();
    await host.engine.sendAsync(new MessageSendParams(first.id, "@Alice check the build", null, null, [], [alice!.id]));
    await host.adapter.requested(1);
    const started = await host.engine.sendAsync(new MessageSendParams(second.id, "@Bob start", null, null, [], [bob!.id]));
    await host.adapter.requested(2);
    host.adapter.listModelsHold = check.promise;
    const token = SenderEnvironment.read(host.adapter.requests[0]!.environment);
    const crossed = host.engine.sendAsync(new MessageSendParams(second.id, "Check the build", new RequestedSettings("fake", null, null, null, "default"),
      providerId, [], [], null, token));

    turns[1]!.resolve();
    await host.until("one run left", () => host.engine.activeRunCount === 1);
    check.resolve();
    const result = await crossed;
    turns[0]!.resolve();
    await host.engine.waitForIdle();

    Assert.areEqual(MessageStatus.Completed, (await host.messages.findAsync(started.replies[0]!.id))!.status);
    Assert.areEqual(MessageStatus.Completed, (await host.messages.findAsync(result.replies[0]!.id))!.status);
    Assert.areEqual(3, host.adapter.requests.length);
    Assert.areEqual(0, host.engine.activeRunCount);
  }

  @TestMethod
  public async queuesATeammatesSecondSendBehindItsFirstWhenBothArriveDuringTheirModeChecks(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const first = await host.createConversationAsync(project);
    const second = await host.createConversationAsync(project);
    const [alice] = await CrossChatMessagesTests.teamAsync(host, "Alice");
    const providerId = (await host.providerOfAsync()).id;
    host.adapter.modeIds = ["default", "bypass"];
    host.adapter.unrestrictedModes = ["bypass"];
    const turns = Promise.withResolvers<void>();
    const check = Promise.withResolvers<void>();
    host.adapter.holdTurn = () => turns.promise;
    await host.engine.sendAsync(new MessageSendParams(first.id, "@Alice check the build", null, null, [], [alice!.id]));
    await host.adapter.requested(1);
    host.adapter.listModelsHold = check.promise;
    const token = SenderEnvironment.read(host.adapter.requests[0]!.environment);
    const asking = (text: string): Promise<MessageSendResult> => host.engine.sendAsync(new MessageSendParams(second.id, text,
      new RequestedSettings("fake", null, null, null, "default"), providerId, [], [], null, token));
    const sends = [asking("Check the build"), asking("Check the tests")];

    check.resolve();
    const [built, tested] = await Promise.all(sends);
    const running = host.engine.activeRunCount;
    turns.resolve();
    await host.engine.waitForIdle();

    Assert.areEqual(2, running);
    const builtReply = (await host.messages.findAsync(built!.replies[0]!.id))!;
    const testedReply = (await host.messages.findAsync(tested!.replies[0]!.id))!;
    Assert.areEqual(MessageStatus.Completed, builtReply.status);
    Assert.areEqual(MessageStatus.Completed, testedReply.status);
    Assert.isTrue(testedReply.startedAt! >= builtReply.endedAt!);
    Assert.areEqual(3, host.adapter.requests.length);
    Assert.areEqual(0, host.engine.activeRunCount);
  }

  @TestMethod
  public async refusesTheTokenOfATurnThatFailedOrWasStopped(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const first = await host.createConversationAsync(project);
    const [alice, bob] = await CrossChatMessagesTests.teamAsync(host, "Alice", "Bob");
    const ended: ServiceException[] = [];
    const endTurn = async (end: () => Promise<unknown>): Promise<void> => {
      await end();
      await host.engine.waitForIdle();
      ended.push(await Assert.throwsAsync(() => host.engine.sendAsync(CrossChatMessagesTests.from(host, first.id, "@Bob hi", [bob!])), ServiceException));
    };

    host.adapter.failWith = new Error("thrown");
    await endTurn(() => host.engine.sendAsync(new MessageSendParams(first.id, "@Alice one", null, null, [], [alice!.id])));
    host.adapter.failWith = null;
    host.adapter.outcome = TurnOutcome.Failed;
    await endTurn(() => host.engine.sendAsync(new MessageSendParams(first.id, "@Alice two", null, null, [], [alice!.id])));
    host.adapter.outcome = TurnOutcome.Completed;
    host.adapter.holdUntilAbort = true;
    await endTurn(async () => {
      const sent = await host.engine.sendAsync(new MessageSendParams(first.id, "@Alice three", null, null, [], [alice!.id]));
      await host.adapter.requested(3);
      await host.engine.cancelAsync(new MessageIdParams(sent.replies[0]!.id));
    });

    Assert.areEqual(3, host.adapter.requests.length);
    Assert.areEqual(3, new Set(host.adapter.requests.map(t => SenderEnvironment.read(t.environment))).size);
    Assert.areEqual([ErrorCode.Unauthorized, ErrorCode.Unauthorized, ErrorCode.Unauthorized].join(","), ended.map(t => t.info.name).join(","));
    Assert.areEqual([MessageStatus.Failed, MessageStatus.Failed, MessageStatus.Cancelled].join(","),
      (await CrossChatMessagesTests.chatAsync(host, first.id)).filter(t => t.author === MessageAuthor.Provider).map(t => t.status).join(","));
  }

  @TestMethod
  public async stopsALoopOfMessagesBetweenTwoChatsAtTheHandOffLimit(): Promise<void> {
    await using host = await CoreHost.createAsync(false, false, undefined, () => 2);
    const project = await host.openProjectAsync();
    const first = await host.createConversationAsync(project);
    const second = await host.createConversationAsync(project);
    const [alice, bob] = await CrossChatMessagesTests.teamAsync(host, "Alice", "Bob");
    const crossed: Promise<MessageSendResult>[] = [];
    host.adapter.afterDetails = async () => {
      if (host.adapter.requests.length > 5)
        return;
      const fromFirst = host.adapter.requests.length % 2 === 1;
      crossed.push(host.engine.sendAsync(fromFirst ? CrossChatMessagesTests.from(host, second.id, "@Bob again", [bob!])
        : CrossChatMessagesTests.from(host, first.id, "@Alice again", [alice!])));
      await Promise.allSettled(crossed);
    };

    await host.engine.sendAsync(new MessageSendParams(first.id, "@Alice ask Bob", null, null, [], [alice!.id]));
    for (let index = 0; index < 3; index++) {
      await host.until("the next crossed send", () => crossed.length > index, host.runs());
      await crossed[index];
      await host.engine.waitForIdle();
    }

    Assert.areEqual(3, crossed.length);
    Assert.areEqual(3, host.adapter.requests.length);
    const sends = await Promise.all(crossed);
    Assert.areEqual("1,1,0", sends.map(t => t.replies.length).join(","));
    const stopped = (await host.messages.findAsync(sends[2]!.sent.id))!;
    Assert.areEqual(alice!.id, stopped.sender?.teammateId);
    Assert.areEqual(DetailKind.Note, stopped.details[1]!.kind);
    Assert.areEqual("The chain stopped after 2 hand-offs. You can change this limit in Settings › TeamRun. Mention a teammate to go on.", stopped.details[1]!.text);
    Assert.areEqual(JSON.stringify({ source: "handOff" }), JSON.stringify(stopped.details[1]!.payload));
    Assert.areEqual(0, host.engine.activeRunCount);
  }

  @TestMethod
  public async startsNoOneInEitherChatWhenEachReplyNamesTheTeammateOfTheOtherChatInPassing(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const first = await host.createConversationAsync(project);
    const second = await host.createConversationAsync(project);
    const [alice, bob] = await CrossChatMessagesTests.teamAsync(host, "Alice", "Bob");
    host.adapter.turnTexts = [["I sent its teammate, @Bob, a message."], ["Done, as @Alice asked."]];
    const crossed: Promise<MessageSendResult>[] = [];
    host.adapter.afterDetails = async () => {
      if (host.adapter.requests.length === 1 && crossed.length === 0)
        crossed.push(host.engine.sendAsync(CrossChatMessagesTests.from(host, second.id, "@Bob what changed?", [bob!])));
      await Promise.allSettled(crossed);
    };

    await host.engine.sendAsync(new MessageSendParams(first.id, "@Alice ask Bob", null, null, [], [alice!.id]));
    await host.engine.waitForIdle();
    await crossed[0];
    await host.engine.waitForIdle();

    Assert.areEqual(2, host.adapter.requests.length);
    const [, reported, ...firstRest] = await CrossChatMessagesTests.chatAsync(host, first.id);
    Assert.areEqual(bob!.id, reported!.mentions.map(t => t.teammateId).join(","));
    Assert.areEqual(0, firstRest.length);
    Assert.isNull(await host.conversations.findMemberAsync(new ConversationMemberParams(first.id, bob!.id)));
    const [, answered, ...secondRest] = await CrossChatMessagesTests.chatAsync(host, second.id);
    Assert.areEqual(alice!.id, answered!.mentions.map(t => t.teammateId).join(","));
    Assert.areEqual(0, secondRest.length);
    Assert.isNull(await host.conversations.findMemberAsync(new ConversationMemberParams(second.id, alice!.id)));
    Assert.isFalse([reported!, answered!].some(t => t.details.some(detail => detail.kind === DetailKind.Note)));
  }

  @TestMethod
  public async startsNoOneWhenAReplyAddressesTheTeammateItsTurnSentToOrTheTeammateWhoseMessageItAnswers(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const first = await host.createConversationAsync(project);
    const second = await host.createConversationAsync(project);
    const [alice, bob] = await CrossChatMessagesTests.teamAsync(host, "Alice", "Bob");
    host.adapter.turnTexts = [["Sent.\n@Bob has the request now."], ["@Alice, done."]];
    const crossed: Promise<MessageSendResult>[] = [];
    host.adapter.afterDetails = () => {
      if (host.adapter.requests.length === 1 && crossed.length === 0)
        crossed.push(host.engine.sendAsync(CrossChatMessagesTests.from(host, second.id, "@Bob what changed?", [bob!])));
      return crossed[0];
    };

    await host.engine.sendAsync(new MessageSendParams(first.id, "@Alice ask Bob", null, null, [], [alice!.id]));
    await host.engine.waitForIdle();
    await crossed[0];
    await host.engine.waitForIdle();

    Assert.areEqual(2, host.adapter.requests.length);
    const [, reported, ...firstRest] = await CrossChatMessagesTests.chatAsync(host, first.id);
    Assert.areEqual(bob!.id, reported!.mentions.map(t => t.teammateId).join(","));
    Assert.areEqual(alice!.id, (await host.messages.findAsync((await crossed[0]!).sent.id))!.sender?.teammateId);
    Assert.areEqual(0, firstRest.length);
    Assert.isNull(await host.conversations.findMemberAsync(new ConversationMemberParams(first.id, bob!.id)));
    const [, answered, ...secondRest] = await CrossChatMessagesTests.chatAsync(host, second.id);
    Assert.areEqual(alice!.id, answered!.mentions.map(t => t.teammateId).join(","));
    Assert.areEqual(0, secondRest.length);
    Assert.isNull(await host.conversations.findMemberAsync(new ConversationMemberParams(second.id, alice!.id)));
  }

  @TestMethod
  public async tellsATeammateThatAnAnswerToAnotherChatHandsWorkToThatTheMessageWasSentToTheAnswererAndWhatTheHandOffAsks(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const first = await host.createConversationAsync(project, "Release plan");
    const second = await host.createConversationAsync(project, "Fixes");
    const [alice, bob] = await CrossChatMessagesTests.teamAsync(host, "Alice", "Bob", "Carol");
    host.adapter.turnTexts = [["Asked."], ["The login fix is in.\n@Carol please check it."], ["Checked."]];
    const crossed: Promise<MessageSendResult>[] = [];
    host.adapter.afterDetails = async () => {
      if (host.adapter.requests.length === 1 && crossed.length === 0)
        crossed.push(host.engine.sendAsync(CrossChatMessagesTests.from(host, second.id, "@Bob what changed?", [bob!])));
      await Promise.allSettled(crossed);
    };

    await host.engine.sendAsync(new MessageSendParams(first.id, "@Alice ask Bob", null, null, [], [alice!.id]));
    await host.engine.waitForIdle();
    await crossed[0];
    await host.engine.waitForIdle();

    Assert.areEqual(3, host.adapter.requests.length);
    Assert.areEqual([
      "You are @Carol, a teammate in this TeamRun chat. What was said before:",
      `From @Alice in chat "Release plan" (${first.id}) to @Bob: @Bob what changed?`,
      "@Bob: The login fix is in.\n@Carol please check it.",
      "@Bob hands off to you:",
      "@Carol please check it."
    ].join("\n\n"), host.adapter.requests[2]!.prompt);
  }

  @TestMethod
  public async startsATeammateThatAMessageFromAnotherChatAndAHandOffFromAnAnswerToItBothAddressOnce(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const first = await host.createConversationAsync(project, "Release plan");
    const second = await host.createConversationAsync(project, "Fixes");
    const [alice, bob, carol] = await CrossChatMessagesTests.teamAsync(host, "Alice", "Bob", "Carol");
    host.adapter.turnTexts = [["Asked."], ["The login fix is in.\n@Carol please check it."], ["Checked."]];
    const crossed: Promise<MessageSendResult>[] = [];
    host.adapter.afterDetails = async () => {
      if (host.adapter.requests.length === 1 && crossed.length === 0)
        crossed.push(host.engine.sendAsync(CrossChatMessagesTests.from(host, second.id, "@Bob @Carol what changed?", [bob!, carol!])));
      await Promise.allSettled(crossed);
    };

    await host.engine.sendAsync(new MessageSendParams(first.id, "@Alice ask Bob and Carol", null, null, [], [alice!.id]));
    await host.engine.waitForIdle();
    await crossed[0];
    await host.engine.waitForIdle();

    Assert.areEqual("Bob,Carol", (await CrossChatMessagesTests.chatAsync(host, second.id)).slice(1).map(t => t.teammateName).join(","));
    Assert.areEqual(3, host.adapter.requests.length);
    Assert.areEqual([
      "You are @Carol, a teammate in this TeamRun chat. What was said before:",
      `From @Alice in chat "Release plan" (${first.id}): @Bob @Carol what changed?`,
      "@Bob: The login fix is in.\n@Carol please check it.",
      "@Bob hands off to you:",
      "@Carol please check it."
    ].join("\n\n"), host.adapter.requests[2]!.prompt);
  }

  private static from(host: CoreHost, targetId: string, text: string, mentioned: readonly Teammate[]): MessageSendParams {
    const token = SenderEnvironment.read(host.adapter.requests.at(-1)?.environment ?? {});
    return new MessageSendParams(targetId, text, null, null, [], mentioned.map(t => t.id), null, token);
  }

  private static async teamAsync(host: CoreHost, ...names: string[]): Promise<Teammate[]> {
    const provider = await host.createProviderAsync();
    const team: Teammate[] = [];
    for (const name of names)
      team.push(await host.teammates.createAsync(new TeammateCreateParams(name, `${name}'s role`, provider.id, Harness.Provider, null, null)));
    return team;
  }

  private static chatAsync(host: CoreHost, conversationId: string): Promise<readonly Message[]> {
    return host.messages.listAsync(new MessageListParams(conversationId, null));
  }
}
