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
import { Resources, SignInCheck, TurnOutcome, TurnResult, TurnWake } from "@noldova/teamrun.core";
import { AbilityCell, AbilitySource, AttachmentInput, AuthStatus, ChatMemberModeParams, ChatMemberSettings, ChatMemberSettingsParams, ConversationIdParams, ConversationMemberParams, ConversationRewindParams, DetailKind, ErrorCode, EventName, Harness, MentionToken,
  Message, MessageIdParams, MessageListParams, MessageSendParams, type MessageSendResult, MessageStatus, ObservedSettings, ProviderAbilities, ProviderAbility, ProviderEnabledParams, ProviderIdParams,
  ProviderKind, RequestedSettings,
  RoleApplication, SenderEnvironment, type Teammate, TeammateCreateParams, TeammateIdParams, TeammateUpdateParams } from "@noldova/teamrun.protocol";

import { CoreHost } from "../../fixtures/core-host.fixture.js";
import { FakeProviderAdapter } from "../../fixtures/fake-provider-adapter.fixture.js";

@TestClass
export class TeammateTurnsTests {
  @TestMethod
  public async givesATurnItsAdaptersBackgroundSubAgentsNoteOnlyWhenTheAdapterHasOne(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const settings = new RequestedSettings("fake", null, null);
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "keeps them", settings, (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    host.adapter.backgroundSubAgentsNote = "Wait for your sub-agents.";
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "ends them", settings, (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();

    Assert.isFalse(host.adapter.requests[0]!.instructions!.includes("Wait for your sub-agents."));
    Assert.isTrue(host.adapter.requests[1]!.instructions!.includes(`${Resources.planToolInstructions}\nWait for your sub-agents.`));
  }

  @TestMethod
  public async retainsAFreshSessionRequirementAfterAnAttemptFailsBeforeStarting(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const settings = new RequestedSettings("fake", null, null);
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "kept", settings, (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    const removed = await host.engine.sendAsync(new MessageSendParams(conversation.id, "remove", settings, (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    await host.engine.rewindAsync(new ConversationRewindParams(conversation.id, removed.sent.id, false));
    host.adapter.failBeforeStart = true;
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "failed attempt", settings, (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    Assert.isTrue((await host.conversations.findAsync(conversation.id))!.sessionReset);
    host.adapter.failBeforeStart = false;
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "retry", settings, (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    Assert.isNull(host.adapter.requests[3]!.resumeNativeSessionId);
    Assert.isTrue(host.adapter.requests[3]!.prompt.includes("User: kept"));
    Assert.isFalse((await host.conversations.findAsync(conversation.id))!.sessionReset);
  }

  @TestMethod
  public async asksAResumedSessionToCompactOnlyWhenTheTextLeftAfterTheMentionsIsTheCommandAlone(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const provider = await host.createProviderAsync();
    const bob = await host.teammates.createAsync(new TeammateCreateParams("Bob", "Implement carefully", provider.id, Harness.Provider, "model-b", "low"));
    const file = [new AttachmentInput("notes.txt", "text/plain", Buffer.from("notes").toString("base64"), null)];
    const send = async (text: string, teammate: string | null, attachments: AttachmentInput[] = []): Promise<void> => {
      await host.engine.sendAsync(Object.isNull(teammate) ? new MessageSendParams(conversation.id, text, new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id)
        : new MessageSendParams(conversation.id, text, null, null, attachments, [teammate]));
      await host.engine.waitForIdle();
    };

    await send("/compact", null);
    await send("start", null);
    await send(" /compact ", null);
    await send("@Bob /compact", bob.id);
    await send("@Bob start", bob.id);
    await send(`${MentionToken.format(bob.id, "Bob")} /compact`, bob.id);
    await send("@Bob /compact now", bob.id);
    await send("@Bob /compact", bob.id, file);

    Assert.areEqual("false,true,false,true,false,false", host.adapter.requests.map(t => t.compacts).join(","));
    Assert.areEqual("session-1", host.adapter.requests[1]!.resumeNativeSessionId);
    const answered = (await host.messages.listAsync(new MessageListParams(conversation.id, null))).filter(t => t.details.some(d => d.text === Resources.nothingToCompact));
    Assert.areEqual(`${MessageStatus.Completed},${MessageStatus.Completed}`, answered.map(t => t.status).join(","));
    Assert.areEqual(`null,${bob.id}`, answered.map(t => String(t.teammateId)).join(","));
  }

  @TestMethod
  public async answersACompactWithTheRowsReasonWhenItsProviderCantCompactAndAsksNothing(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    await host.createProviderAsync();
    const cells = Object.fromEntries(Object.values(ProviderAbility).map(t => [t, AbilityCell.works(AbilitySource.Acp)])) as Record<ProviderAbility, AbilityCell>;
    host.adapter.descriptor = new ProviderKind("fake", "Fake provider", true, false, null, null, false, null, false, null, false, null,
      new ProviderAbilities({ ...cells, [ProviderAbility.Compact]: AbilityCell.cannot("it lists no compact command") }));
    const send = async (text: string): Promise<void> => {
      await host.engine.sendAsync(new MessageSendParams(conversation.id, text, new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
      await host.engine.waitForIdle();
    };

    await send("start");
    await send("/compact");

    Assert.areEqual("false", host.adapter.requests.map(t => t.compacts).join(","));
    const answered = (await host.messages.listAsync(new MessageListParams(conversation.id, null)))
      .filter(t => t.details.some(d => d.text === Resources.formatCompactRefused("Fake provider", "it lists no compact command")));
    Assert.areEqual(MessageStatus.Completed, answered.map(t => t.status).join(","));
  }

  @TestMethod
  public async passesAMessageThatIsOnlyASlashCommandAsTheTurnsCommandWithoutItsMentionsAndWithItsFiles(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const provider = await host.createProviderAsync();
    const bob = await host.teammates.createAsync(new TeammateCreateParams("Bob", "Implement carefully", provider.id, Harness.Provider, "model-b", "low"));
    const file = [new AttachmentInput("notes.txt", "text/plain", Buffer.from("notes").toString("base64"), null)];
    const send = async (text: string, teammate: string | null, attachments: AttachmentInput[] = []): Promise<void> => {
      await host.engine.sendAsync(Object.isNull(teammate) ? new MessageSendParams(conversation.id, text, new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id)
        : new MessageSendParams(conversation.id, text, null, null, attachments, [teammate]));
      await host.engine.waitForIdle();
    };

    await send("/review src", null);
    await send("please /review", null);
    await send("/usr/bin/env", null);
    await send(" /init  ", null);
    await send("/", null);
    await send("@Bob /review", bob.id);
    await send(`${MentionToken.format(bob.id, "Bob")} /review now`, bob.id);
    await send("@Bob /review", bob.id, file);

    Assert.areEqual("/review src,null,null,/init,null,/review,/review now,/review", host.adapter.requests.map(t => String(t.command)).join(","));
    Assert.areEqual(1, host.adapter.requests.at(7)?.attachments.length);
  }

  @TestMethod
  public async resumesTheFreshSessionAfterAResumeFallsBack(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const provider = await host.createProviderAsync();
    const bob = await host.teammates.createAsync(new TeammateCreateParams("Bob", "Implement carefully", provider.id, Harness.Provider, "model-b", "low"));
    const settings = new RequestedSettings("fake", null, null);
    const send = async (text: string, teammate: string | null): Promise<string> => {
      const sent = await host.engine.sendAsync(Object.isNull(teammate) ? new MessageSendParams(conversation.id, text, settings, (await host.providerOfAsync()).id)
        : new MessageSendParams(conversation.id, text, null, null, [], [teammate]));
      await host.engine.waitForIdle();
      return sent.replies[0]!.id;
    };
    await send("first", null);
    await send("@Bob start", bob.id);
    host.adapter.unresumable = ["session-1", "session-2"];
    const fellBack = await send("second", null);
    const bobFellBack = await send("@Bob again", bob.id);

    Assert.areEqual("session-1", host.adapter.requests[2]!.resumeNativeSessionId);
    Assert.areEqual("session-2", host.adapter.requests[3]!.resumeNativeSessionId);
    for (const [id, session] of [[fellBack, "session-3"], [bobFellBack, "session-4"]] as const) {
      const reply = (await host.messages.findAsync(id))!;
      Assert.areEqual(MessageStatus.Completed, reply.status);
      Assert.areEqual(session, reply.provenance?.nativeSessionId);
      Assert.isFalse(reply.provenance?.resumedNativeSession ?? true);
      Assert.isTrue(reply.details.some(t => t.text.startsWith("Fixture could not resume")));
    }
    Assert.areEqual("session-4", (await host.conversations.findMemberAsync(new ConversationMemberParams(conversation.id, bob.id)))?.nativeSessionId);

    await send("third", null);
    await send("@Bob once more", bob.id);
    Assert.areEqual("session-3", host.adapter.requests[4]!.resumeNativeSessionId);
    Assert.areEqual("session-4", host.adapter.requests[5]!.resumeNativeSessionId);
    Assert.isTrue((await host.conversations.findMemberAsync(new ConversationMemberParams(conversation.id, bob.id)))!.resumedNativeSession);
  }

  @TestMethod
  public async exchangesInMentionOrderWithIndependentSessionsAndInterveningContext(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const provider = await host.createProviderAsync();
    const alice = await host.teammates.createAsync(new TeammateCreateParams("Alice", "Review carefully", provider.id, Harness.Provider, "model-a", "high"));
    const bob = await host.teammates.createAsync(new TeammateCreateParams("Bob", "Implement carefully", provider.id, Harness.Provider, "model-b", "low"));
    host.adapter.detailTexts = ["First answer"];
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Bob @Alice discuss", null, null, [], [bob.id, alice.id, bob.id]));
    Assert.areEqual("Bob,Alice", sent.replies.map(t => t.teammateName).join(","));
    Assert.areEqual("Bob,Alice", sent.sent.mentions.map(t => t.name).join(","));
    Assert.isTrue(sent.replies.every(t => t.status === MessageStatus.Pending && t.inReplyTo === sent.sent.id && Object.isNull(t.startedAt)));
    await host.engine.waitForIdle();
    const first = (await host.messages.findAsync(sent.replies[0]!.id))!;
    const second = (await host.messages.findAsync(sent.replies[1]!.id))!;
    Assert.isTrue(first.startedAt! >= sent.sent.createdAt);
    Assert.isTrue(second.startedAt! >= first.endedAt!);
    Assert.areEqual(sent.sent.createdAt, second.createdAt);
    Assert.areEqual(2, host.adapter.requests.length);
    Assert.isTrue(host.adapter.requests[0]!.prompt.includes("You are @Bob, a teammate in this TeamRun chat."));
    Assert.isTrue(host.adapter.requests[1]!.prompt.includes("@Bob: First answer"));
    Assert.areEqual(Resources.formatTeammateInstructions("Implement carefully", Resources.defaultCommand), host.adapter.requests[0]!.instructions);
    Assert.areEqual(Resources.formatTeammateInstructions("Review carefully", Resources.defaultCommand), host.adapter.requests[1]!.instructions);
    Assert.areEqual(RoleApplication.Instructions, (await host.messages.findAsync(sent.replies[1]!.id))?.provenance?.roleApplied);
    Assert.areEqual(2, (await host.conversations.listMembersAsync(new ConversationIdParams(conversation.id))).length);
    Assert.areEqual(1, host.listener.count(EventName.StateInvalidated));
    Assert.areEqual("session-1", (await host.conversations.findMemberAsync(new ConversationMemberParams(conversation.id, bob.id)))?.nativeSessionId);
    Assert.areEqual("session-2", (await host.conversations.findMemberAsync(new ConversationMemberParams(conversation.id, alice.id)))?.nativeSessionId);
    const again = await host.engine.sendAsync(new MessageSendParams(conversation.id, "Continue", null, null, [], [], bob.id));
    await host.engine.waitForIdle();
    Assert.areEqual("session-1", host.adapter.requests[2]!.resumeNativeSessionId);
    Assert.isTrue(host.adapter.requests[2]!.prompt.includes("@Alice: First answer"));
    Assert.isFalse(host.adapter.requests[2]!.prompt.includes("@Bob: First answer"));
    Assert.areEqual(MessageStatus.Completed, (await host.messages.findAsync(again.replies[0]!.id))?.status);
    Assert.areEqual(1, host.listener.count(EventName.StateInvalidated));
    Assert.isTrue((await host.conversations.findMemberAsync(new ConversationMemberParams(conversation.id, bob.id)))!.resumedNativeSession);
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "Default speaks", new RequestedSettings("fake", null, null), provider.id));
    await host.engine.waitForIdle();
    Assert.isNull(host.adapter.requests[3]!.resumeNativeSessionId);
    Assert.isTrue(host.adapter.requests[3]!.prompt.includes("@Alice: First answer"));
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice follow up", null, null, [], [alice.id]));
    await host.engine.waitForIdle();
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "Default returns", new RequestedSettings("fake", null, null), provider.id));
    await host.engine.waitForIdle();
    Assert.areEqual("session-4", host.adapter.requests[5]!.resumeNativeSessionId);
    Assert.isTrue(host.adapter.requests[5]!.prompt.includes("@Alice: First answer"));
  }

  @TestMethod
  public async asksForATeammatesChosenSpeedWithItsTurns(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const provider = await host.createProviderAsync();
    const ada = await host.teammates.createAsync(new TeammateCreateParams("Ada", null, provider.id, Harness.Provider, "fast-model", null, "fast"));
    const bob = await host.teammates.createAsync(new TeammateCreateParams("Bob", null, provider.id, Harness.Provider, null, null));

    await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Ada @Bob go", null, null, [], [ada.id, bob.id]));
    await host.engine.waitForIdle();

    Assert.areEqual("fast,null", host.adapter.requests.map(t => String(t.requested.speed)).join(","));
  }

  @TestMethod
  public async asksForATeammatesChosenContextWindowWithItsTurns(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const provider = await host.createProviderAsync();
    const ada = await host.teammates.createAsync(new TeammateCreateParams("Ada", null, provider.id, Harness.Provider, "fake-small", null, null, null, 200_000));
    const bob = await host.teammates.createAsync(new TeammateCreateParams("Bob", null, provider.id, Harness.Provider, null, null));

    await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Ada @Bob go", null, null, [], [ada.id, bob.id]));
    await host.engine.waitForIdle();

    Assert.areEqual("200000,null", host.adapter.requests.map(t => String(t.requested.contextWindow)).join(","));
  }

  @TestMethod
  public async asksForATeammatesChosenModeWithItsTurns(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const provider = await host.createProviderAsync();
    const ada = await host.teammates.createAsync(new TeammateCreateParams("Ada", null, provider.id, Harness.Provider, null, null, null, "plan"));
    const bob = await host.teammates.createAsync(new TeammateCreateParams("Bob", null, provider.id, Harness.Provider, null, null));

    await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Ada @Bob go", null, null, [], [ada.id, bob.id]));
    await host.engine.waitForIdle();

    Assert.areEqual("plan,null", host.adapter.requests.map(t => String(t.requested.mode)).join(","));
  }

  @TestMethod
  public async runsATeammateInTheModeItsChatChoseWhileItsProviderListsItAndInItsOwnOtherwiseEachTeammateKeepingItsOwn(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.adapter.modeIds = ["ask", "plan", "bypass"];
    const conversation = await host.createConversationAsync();
    const other = await host.createConversationAsync();
    const provider = await host.createProviderAsync();
    const ada = await host.teammates.createAsync(new TeammateCreateParams("Ada", null, provider.id, Harness.Provider, null, null, null, "plan"));
    const bob = await host.teammates.createAsync(new TeammateCreateParams("Bob", null, provider.id, Harness.Provider, null, null));
    const choose = async (teammate: Teammate, mode: string | null): Promise<void> => {
      await host.conversations.setMemberModeAsync(new ChatMemberModeParams(conversation.id, teammate.id, mode));
    };
    const send = async (chatId: string): Promise<string> => {
      const before = host.adapter.requests.length;
      await host.engine.sendAsync(new MessageSendParams(chatId, "@Ada @Bob go", null, null, [], [ada.id, bob.id]));
      await host.engine.waitForIdle();
      return host.adapter.requests.slice(before).map(t => String(t.requested.mode)).join(",");
    };

    const joined = await send(conversation.id);
    await choose(ada, "bypass");
    await choose(bob, "ask");
    const chosen = await send(conversation.id);
    const elsewhere = await send(other.id);
    await choose(ada, "gone");
    const unlisted = await send(conversation.id);
    await choose(ada, null);
    const cleared = await send(conversation.id);

    Assert.areEqual(["plan,null", "bypass,ask", "plan,null", "plan,ask", "plan,ask"].join("|"), [joined, chosen, elsewhere, unlisted, cleared].join("|"));
  }

  @TestMethod
  public async runsATeammateOnTheModelEffortAndSpeedItsChatChoseKeepingItsWindowOnlyOnItsOwnModelAndOnItsOwnSettingsElsewhere(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const other = await host.createConversationAsync();
    const provider = await host.createProviderAsync();
    const ada = await host.teammates.createAsync(new TeammateCreateParams("Ada", null, provider.id, Harness.Provider, "m1", "low", "fast", null, 200000));
    await host.conversations.addMemberAsync(new ConversationMemberParams(conversation.id, ada.id));
    const choose = async (settings: ChatMemberSettings | null): Promise<void> => {
      await host.conversations.setMemberSettingsAsync(new ChatMemberSettingsParams(conversation.id, ada.id, settings));
    };
    const send = async (chatId: string): Promise<string> => {
      const before = host.adapter.requests.length;
      await host.engine.sendAsync(new MessageSendParams(chatId, "@Ada go", null, null, [], [ada.id]));
      await host.engine.waitForIdle();
      return host.adapter.requests.slice(before).map(t => [t.requested.model, t.requested.effort, t.requested.speed, t.requested.contextWindow].map(String).join(" "))
        .join(",");
    };

    const own = await send(conversation.id);
    await choose(new ChatMemberSettings("m1", "high", "slow"));
    const sameModel = await send(conversation.id);
    await choose(new ChatMemberSettings("m2", null));
    const otherModel = await send(conversation.id);
    await choose(new ChatMemberSettings(null, "medium"));
    const providerDefault = await send(conversation.id);
    const elsewhere = await send(other.id);
    await choose(null);
    const cleared = await send(conversation.id);

    Assert.areEqual(["m1 low fast 200000", "m1 high slow 200000", "m2 null null null", "null medium null null", "m1 low fast 200000", "m1 low fast 200000"]
      .join("|"), [own, sameModel, otherModel, providerDefault, elsewhere, cleared].join("|"));
  }

  @TestMethod
  public async forgetsTheModelAndEffortAChatChoseForATeammateOnceItMovesToAnotherProvider(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const first = await host.createProviderAsync();
    const second = await host.createProviderAsync("fake", "Second");
    const ada = await host.teammates.createAsync(new TeammateCreateParams("Ada", null, first.id, Harness.Provider, "m1", null));
    const params = new ConversationMemberParams(conversation.id, ada.id);
    await host.conversations.addMemberAsync(params);
    await host.conversations.setMemberSettingsAsync(new ChatMemberSettingsParams(conversation.id, ada.id, new ChatMemberSettings("m2", "high")));

    await host.teammates.updateAsync(new TeammateUpdateParams(ada.id, "Ada", null, first.id, Harness.Provider, "m1", null));
    const kept = (await host.conversations.findMemberAsync(params))?.settings?.model ?? null;
    await host.teammates.updateAsync(new TeammateUpdateParams(ada.id, "Ada", null, second.id, Harness.Provider, "m1", null));
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Ada go", null, null, [], [ada.id]));
    await host.engine.waitForIdle();

    Assert.areEqual("m2", kept);
    Assert.isNull((await host.conversations.findMemberAsync(params))?.settings);
    Assert.areEqual("m1 null", host.adapter.requests.map(t => `${String(t.requested.model)} ${String(t.requested.effort)}`).join(","));
  }

  @TestMethod
  public async forgetsTheModeAChatChoseForATeammateOnceItMovesToAProviderOfAnotherKindEitherWay(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const other = new FakeProviderAdapter("other");
    host.registry.register(other);
    for (const adapter of [host.adapter, other]) {
      adapter.modeIds = ["ask", "bypassPermissions"];
      adapter.unrestrictedModes = ["bypassPermissions"];
    }
    const conversation = await host.createConversationAsync();
    const fake = await host.createProviderAsync();
    const moved = await host.createProviderAsync("other", "Other");
    const ada = await host.teammates.createAsync(new TeammateCreateParams("Ada", null, fake.id, Harness.Provider, null, null));
    await host.conversations.addMemberAsync(new ConversationMemberParams(conversation.id, ada.id));
    const modes: string[] = [];

    for (const provider of [moved, fake]) {
      await host.conversations.setMemberModeAsync(new ChatMemberModeParams(conversation.id, ada.id, "bypassPermissions"));
      await host.teammates.updateAsync(new TeammateUpdateParams(ada.id, "Ada", null, provider.id, Harness.Provider, null, null));
      modes.push(String((await host.conversations.findMemberAsync(new ConversationMemberParams(conversation.id, ada.id)))!.mode));
      await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Ada go", null, null, [], [ada.id]));
      await host.engine.waitForIdle();
    }

    Assert.areEqual("null,null", modes.join(","));
    Assert.areEqual("null|null", [other.requests, host.adapter.requests].map(t => t.map(r => String(r.requested.mode)).join(",")).join("|"));
  }

  @TestMethod
  public async startsAQueuedOrWokenTeammateReplyInTheModeItsChatHasForItWhenTheReplyStarts(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.adapter.modeIds = ["ask", "bypass", "plan"];
    const conversation = await host.createConversationAsync();
    const provider = await host.createProviderAsync();
    const ada = await host.teammates.createAsync(new TeammateCreateParams("Ada", null, provider.id, Harness.Provider, null, null));
    const bob = await host.teammates.createAsync(new TeammateCreateParams("Bob", null, provider.id, Harness.Provider, null, null));
    const choose = async (teammate: Teammate, mode: string): Promise<void> => {
      await host.conversations.setMemberModeAsync(new ChatMemberModeParams(conversation.id, teammate.id, mode));
    };
    for (const teammate of [ada, bob]) {
      await host.conversations.addMemberAsync(new ConversationMemberParams(conversation.id, teammate.id));
      await choose(teammate, "bypass");
    }
    host.adapter.afterDetails = async () => {
      host.adapter.afterDetails = null;
      await choose(bob, "ask");
    };

    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Ada @Bob go", null, null, [], [ada.id, bob.id]));
    await host.engine.waitForIdle();
    await choose(bob, "plan");
    const wake = await host.adapter.lastListener!.onWakeAsync(new TurnWake("item-1", "npm run dev"));
    wake!.end(new TurnResult(TurnOutcome.Completed, null, new ObservedSettings("fake", null, null, null), null));
    await host.engine.waitForIdle();

    const woken = (await host.messages.listAsync(new MessageListParams(conversation.id, null))).at(-1)!;
    Assert.areEqual("bypass,ask", host.adapter.requests.map(t => String(t.requested.mode)).join(","));
    Assert.areEqual("bypass,ask", (await Promise.all(sent.replies.map(t => host.messages.findAsync(t.id)))).map(t => String(t!.provenance!.requested.mode)).join(","));
    Assert.areEqual([sent.replies[1]!.id, "plan", MessageStatus.Completed].join(","), [woken.inReplyTo, woken.provenance!.requested.mode, woken.status].join(","));
  }

  @TestMethod
  public async freezesQueuedSettingsAndStopsTheWholeSend(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const provider = await host.createProviderAsync();
    const alice = await host.teammates.createAsync(new TeammateCreateParams("Alice", "old role", provider.id, Harness.Provider, "old", null));
    const bob = await host.teammates.createAsync(new TeammateCreateParams("Bob", null, provider.id, Harness.Provider, null, null));
    const charlie = await host.teammates.createAsync(new TeammateCreateParams("Charlie", null, provider.id, Harness.Provider, null, null));
    host.adapter.afterDetails = async () => {
      await host.teammates.updateAsync(new TeammateUpdateParams(alice.id, "Renamed", "new role", provider.id, Harness.Provider, "new", null));
      await host.conversations.addMemberAsync(new ConversationMemberParams(conversation.id, charlie.id));
    };
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Bob @Alice go", null, null, [], [bob.id, alice.id]));
    await host.engine.waitForIdle();
    Assert.areEqual(Resources.formatTeammateInstructions("old role", Resources.defaultCommand), host.adapter.requests[1]!.instructions);
    Assert.areEqual("old", host.adapter.requests[1]!.requested.model);
    Assert.areEqual("Alice", (await host.messages.findAsync(sent.replies[1]!.id))?.teammateName);
    host.adapter.afterDetails = null;
    host.adapter.holdUntilAbort = true;
    const held = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Bob @Renamed again", null, null, [], [bob.id, alice.id]));
    await host.adapter.requested(3);
    Assert.areEqual(3, host.adapter.requests.length);
    await Assert.throwsAsync(() => host.engine.sendAsync(new MessageSendParams(conversation.id, "busy", null, null, [], [], bob.id)), ServiceException);
    await host.engine.cancelConversationAsync(new ConversationIdParams(conversation.id));
    Assert.areEqual(3, host.adapter.requests.length);
    Assert.isTrue((await Promise.all(held.replies.map(t => host.messages.findAsync(t.id)))).every(t => t?.status === MessageStatus.Cancelled));
    Assert.isNotNull((await host.messages.findAsync(held.replies[0]!.id))!.startedAt);
    Assert.isNull((await host.messages.findAsync(held.replies[1]!.id))!.startedAt);
    Assert.areEqual(0, host.engine.activeRunCount);
  }

  @TestMethod
  public async continuesAfterAFailedReplyAndRefusesToStopACompletedReplyWhileTheChatStillStops(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const provider = await host.createProviderAsync();
    const alice = await host.teammates.createAsync(new TeammateCreateParams("Alice", null, provider.id, Harness.Provider, null, null));
    const bob = await host.teammates.createAsync(new TeammateCreateParams("Bob", null, provider.id, Harness.Provider, null, null));
    host.adapter.outcome = TurnOutcome.Failed;
    const failed = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice @Bob go", null, null, [], [alice.id, bob.id]));
    await host.engine.waitForIdle();
    Assert.areEqual(2, host.adapter.requests.length);
    Assert.isTrue((await Promise.all(failed.replies.map(t => host.messages.findAsync(t.id)))).every(t => t?.status === MessageStatus.Failed));
    host.adapter.outcome = TurnOutcome.Completed;
    host.adapter.afterDetails = () => { host.adapter.holdUntilAbort = host.adapter.requests.length === 4; };
    const held = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice @Bob retry", null, null, [], [alice.id, bob.id]));
    await host.adapter.requested(4);
    Assert.areEqual(4, host.adapter.requests.length);
    await Assert.throwsAsync(() => host.engine.cancelAsync(new MessageIdParams(held.replies[0]!.id)), ServiceException);
    const stopped = await host.engine.cancelConversationAsync(new ConversationIdParams(conversation.id));
    Assert.areEqual(`${held.replies[1]!.id}:${MessageStatus.Cancelled}`, stopped.map(t => `${t.id}:${t.status}`).join(","));
    Assert.areEqual(MessageStatus.Completed, (await host.messages.findAsync(held.replies[0]!.id))?.status);
    Assert.areEqual(MessageStatus.Cancelled, (await host.messages.findAsync(held.replies[1]!.id))?.status);
    await Assert.throwsAsync(() => host.engine.cancelConversationAsync(new ConversationIdParams(conversation.id)), ServiceException);
  }

  @TestMethod
  public async stopsAWorkingReplyAloneAndTheNextWaitingReplyTakesItsTurn(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const team = await TeammateTurnsTests.teamAsync(host, "Alice", "Bob", "Charlie");
    host.adapter.afterDetails = () => { host.adapter.holdUntilAbort = host.adapter.requests.length === 1; };
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice @Bob @Charlie go", null, null, [], team.map(t => t.id)));
    await host.adapter.requested(1);
    await host.until("the held first turn", () => host.adapter.holdUntilAbort, host.runs());

    const stopped = await host.engine.cancelAsync(new MessageIdParams(sent.replies[0]!.id));
    await host.engine.waitForIdle();

    Assert.areEqual(MessageStatus.Cancelled, stopped.status);
    Assert.areEqual(3, host.adapter.requests.length);
    Assert.areEqual([MessageStatus.Cancelled, MessageStatus.Completed, MessageStatus.Completed].join(","), await TeammateTurnsTests.statusesAsync(host, sent.replies));
  }

  @TestMethod
  public async answersTheChatsStopWithoutAReplyItsOwnStopAlreadyStopped(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const team = await TeammateTurnsTests.teamAsync(host, "Alice", "Bob", "Charlie");
    host.adapter.holdUntilAbort = true;
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice @Bob @Charlie go", null, null, [], team.map(t => t.id)));
    await host.adapter.requested(1);
    await host.engine.cancelAsync(new MessageIdParams(sent.replies[1]!.id));

    const stopped = await host.engine.cancelConversationAsync(new ConversationIdParams(conversation.id));

    Assert.areEqual([sent.replies[0]!.id, sent.replies[2]!.id].join(","), stopped.map(t => t.id).join(","));
    Assert.areEqual([MessageStatus.Cancelled, MessageStatus.Cancelled, MessageStatus.Cancelled].join(","), await TeammateTurnsTests.statusesAsync(host, sent.replies));
  }

  @TestMethod
  public async answersASecondChatStopWithNoneOfTheRepliesAnOverlappingOneIsEnding(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const team = await TeammateTurnsTests.teamAsync(host, "Alice", "Bob");
    host.adapter.holdUntilAbort = true;
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice @Bob go", null, null, [], team.map(t => t.id)));
    await host.adapter.requested(1);

    const first = host.engine.cancelConversationAsync(new ConversationIdParams(conversation.id));
    const second = await host.engine.cancelConversationAsync(new ConversationIdParams(conversation.id));
    const stopped = await first;

    Assert.areEqual(sent.replies.map(t => t.id).join(","), stopped.map(t => t.id).join(","));
    Assert.areEqual(String.empty, second.map(t => t.id).join(","));
    Assert.areEqual([MessageStatus.Cancelled, MessageStatus.Cancelled].join(","), await TeammateTurnsTests.statusesAsync(host, sent.replies));
  }

  @TestMethod
  public async answersTheChatsStopWithoutAWorkingReplyWhoseOwnStopIsStillEndingIt(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const team = await TeammateTurnsTests.teamAsync(host, "Alice", "Bob");
    host.adapter.holdUntilAbort = true;
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice @Bob go", null, null, [], team.map(t => t.id)));
    await host.adapter.requested(1);

    const own = host.engine.cancelAsync(new MessageIdParams(sent.replies[0]!.id));
    const stopped = await host.engine.cancelConversationAsync(new ConversationIdParams(conversation.id));
    await own;

    Assert.areEqual(sent.replies[1]!.id, stopped.map(t => t.id).join(","));
    Assert.areEqual([MessageStatus.Cancelled, MessageStatus.Cancelled].join(","), await TeammateTurnsTests.statusesAsync(host, sent.replies));
  }

  @TestMethod
  public async answersTheChatsStopWithoutAWorkingReplyThatCompletedAsTheStopReachedIt(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const team = await TeammateTurnsTests.teamAsync(host, "Alice", "Bob");
    host.adapter.holdUntilAbort = true;
    host.adapter.outcomeOnAbort = TurnOutcome.Completed;
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice @Bob go", null, null, [], team.map(t => t.id)));
    await host.adapter.requested(1);

    const stopped = await host.engine.cancelConversationAsync(new ConversationIdParams(conversation.id));

    Assert.areEqual(sent.replies[1]!.id, stopped.map(t => t.id).join(","));
    Assert.areEqual([MessageStatus.Completed, MessageStatus.Cancelled].join(","), await TeammateTurnsTests.statusesAsync(host, sent.replies));
  }

  @TestMethod
  public async takesAWaitingReplyOutOfTheQueueAtOnceAndEndsTheSendWhenTheLastOneStops(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const team = await TeammateTurnsTests.teamAsync(host, "Alice", "Bob", "Charlie");
    host.adapter.holdUntilAbort = true;
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice @Bob @Charlie go", null, null, [], team.map(t => t.id)));
    await host.adapter.requested(1);

    const left = await host.engine.cancelAsync(new MessageIdParams(sent.replies[1]!.id));
    const working = (await host.messages.findAsync(sent.replies[0]!.id))!.status;
    await Assert.throwsAsync(() => host.engine.cancelAsync(new MessageIdParams(sent.replies[1]!.id)), ServiceException);
    await host.engine.cancelAsync(new MessageIdParams(sent.replies[0]!.id));
    await host.adapter.requested(2);
    const last = await host.engine.cancelAsync(new MessageIdParams(sent.replies[2]!.id));
    const runs = host.engine.activeRunCount;
    host.adapter.holdUntilAbort = false;
    const next = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice again", null, null, [], [team[0]!.id]));
    await host.engine.waitForIdle();

    Assert.areEqual(MessageStatus.Cancelled, left.status);
    Assert.isNull(left.startedAt);
    Assert.areEqual(0, left.details.length);
    Assert.areEqual(MessageStatus.Running, working);
    Assert.areEqual(MessageStatus.Cancelled, last.status);
    Assert.areEqual(0, runs);
    Assert.areEqual(3, host.adapter.requests.length);
    Assert.areEqual([MessageStatus.Cancelled, MessageStatus.Cancelled, MessageStatus.Cancelled].join(","), await TeammateTurnsTests.statusesAsync(host, sent.replies));
    Assert.areEqual(MessageStatus.Completed, (await host.messages.findAsync(next.replies[0]!.id))!.status);
  }

  @TestMethod
  public async stopsTheWholeChatWithTheWorkingReplyAndSeveralWaiting(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const team = await TeammateTurnsTests.teamAsync(host, "Alice", "Bob", "Charlie");
    host.adapter.holdUntilAbort = true;
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice @Bob @Charlie go", null, null, [], team.map(t => t.id)));
    await host.adapter.requested(1);

    const stopped = await host.engine.cancelConversationAsync(new ConversationIdParams(conversation.id));

    Assert.areEqual(1, host.adapter.requests.length);
    Assert.areEqual(sent.replies.map(t => t.id).join(","), stopped.map(t => t.id).join(","));
    Assert.isTrue(stopped.every(t => t.status === MessageStatus.Cancelled));
    Assert.isNotNull(stopped[0]!.startedAt);
    Assert.isTrue(stopped.slice(1).every(t => Object.isNull(t.startedAt)));
    Assert.areEqual(0, host.engine.activeRunCount);
  }

  @TestMethod
  public async checksTheMentionedIdsAgainstTokensAndEveryTeammatesName(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const provider = await host.createProviderAsync();
    const chat = await host.teammates.createAsync(new TeammateCreateParams("Chat GPT", null, provider.id, Harness.Provider, null, null));
    await host.teammates.createAsync(new TeammateCreateParams("Bob", null, provider.id, Harness.Provider, null, null));
    host.adapter.turnTexts = [["From the token"], ["From the first word"]];

    const byToken = await host.engine.sendAsync(new MessageSendParams(conversation.id, `${MentionToken.format(chat.id, "Chat")} look`, null, null, [], [chat.id]));
    await host.engine.waitForIdle();
    Assert.areEqual(chat.id, byToken.replies[0]!.teammateId);
    Assert.areEqual("Chat GPT", (await host.messages.findAsync(byToken.sent.id))!.mentions.map(t => t.name).join(","));
    Assert.isTrue(host.adapter.requests[0]!.prompt.includes("@Chat GPT look"));

    const byFirstWord = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Chat again", null, null, [], [chat.id]));
    await host.engine.waitForIdle();
    Assert.areEqual(chat.id, byFirstWord.replies[0]!.teammateId);
    await Assert.throwsAsync(() => host.engine.sendAsync(new MessageSendParams(conversation.id, "@Bob too", null, null, [], [], chat.id)),
      ServiceException);
    await Assert.throwsAsync(() => host.engine.sendAsync(new MessageSendParams(conversation.id, `${MentionToken.format(chat.id, "Chat")} @Bob`, null, null, [],
      [chat.id])), ServiceException);
    Assert.areEqual(2, host.adapter.requests.length);
  }

  @TestMethod
  public async storesZeroReplyMessagesForUnavailableMentionsAndRejectsStaleSelections(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const provider = await host.createProviderAsync();
    const alice = await host.teammates.createAsync(new TeammateCreateParams("Alice", null, provider.id, Harness.Provider, null, null));
    await Assert.throwsAsync(() => host.engine.sendAsync(new MessageSendParams(conversation.id, "go", null, null, [], [], alice.id)), ServiceException);
    await Assert.throwsAsync(() => host.engine.sendAsync(new MessageSendParams(conversation.id, "@missing", null, null, [], ["missing"])), ServiceException);
    await Assert.throwsAsync(() => host.engine.sendAsync(new MessageSendParams(conversation.id, "stale name", null, null, [], [alice.id])), ServiceException);
    host.adapter.signInCheck = new SignInCheck(AuthStatus.LoggedOut, null, null, null);
    await host.providers.checkAsync(new ProviderIdParams(provider.id));
    const signedOut = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice go", null, null, [], [alice.id]));
    Assert.areEqual(0, signedOut.replies.length);
    Assert.areEqual(alice.id, (await host.messages.findAsync(signedOut.sent.id))?.mentions[0]?.teammateId);
    await host.providers.deleteAsync(new ProviderIdParams(provider.id));
    const missing = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice retry", null, null, [], [alice.id]));
    Assert.areEqual(0, missing.replies.length);
    await Assert.throwsAsync(() => host.engine.cancelAsync(new MessageIdParams(missing.sent.id)), ServiceException);
    Assert.areEqual(0, host.adapter.requests.length);
    Assert.areEqual(0, host.engine.activeRunCount);
  }

  @TestMethod
  public async refusesASendToADisabledProviderAndStoresNothingUntilItIsEnabled(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const provider = await host.createProviderAsync();
    const other = await host.createProviderAsync("fake", "Other");
    const alice = await host.teammates.createAsync(new TeammateCreateParams("Alice", null, provider.id, Harness.Provider, null, null));
    const bob = await host.teammates.createAsync(new TeammateCreateParams("Bob", null, other.id, Harness.Provider, null, null));
    await host.conversations.addMemberAsync(new ConversationMemberParams(conversation.id, alice.id));
    await host.providers.setEnabledAsync(new ProviderEnabledParams(provider.id, false));
    const direct = new RequestedSettings("fake", null, null);
    const refusal = (params: MessageSendParams): Promise<ServiceException> => Assert.throwsAsync(() => host.engine.sendAsync(params), ServiceException);

    const mentioned = await refusal(new MessageSendParams(conversation.id, "@Bob @Alice go", null, null, [], [bob.id, alice.id]));
    const responder = await refusal(new MessageSendParams(conversation.id, "go", null, null, [], [], alice.id));
    const chosen = await refusal(new MessageSendParams(conversation.id, "go", direct, provider.id));

    Assert.areEqual("@Alice can't reply while its provider \"Work\" is disabled. Enable the provider, or give @Alice another one.", mentioned.info.message);
    Assert.areEqual(JSON.stringify([alice.id, provider.id]), JSON.stringify(mentioned.info.arguments));
    Assert.areEqual(Resources.formatTeammateProviderDisabled("Alice", "Work"), responder.info.message);
    Assert.areEqual(Resources.formatProviderDisabled("Work"), chosen.info.message);
    Assert.areEqual([ErrorCode.Unavailable, ErrorCode.Unavailable, ErrorCode.Unavailable].join(), [mentioned, responder, chosen].map(t => t.info.name).join());
    Assert.areEqual(0, (await host.messages.listAsync(new MessageListParams(conversation.id, null))).length);
    Assert.areEqual(0, (await host.conversations.listMembersAsync(new ConversationIdParams(conversation.id))).filter(t => t.teammateId === bob.id).length);
    Assert.areEqual(1, (await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Bob go", null, null, [], [bob.id]))).replies.length);
    await host.engine.waitForIdle();
    await host.providers.setEnabledAsync(new ProviderEnabledParams(provider.id, true));
    Assert.areEqual(1, (await host.engine.sendAsync(new MessageSendParams(conversation.id, "go", direct, provider.id))).replies.length);
    await host.engine.waitForIdle();
    Assert.areEqual(2, host.adapter.requests.length);
  }

  @TestMethod
  public async refusesATeammatesSendNamingADisabledProviderAndASendWithoutAProviderWhoseUsualProviderIsDisabled(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const first = await host.createConversationAsync(project);
    const second = await host.createConversationAsync(project);
    const provider = await host.createProviderAsync();
    const off = await host.createProviderAsync("fake", "Off");
    const usual = new FakeProviderAdapter("usual", false, false, join(host.directory.path, "profiles", "Home"));
    host.registry.register(usual);
    const home = await host.createProviderAsync("usual", "Home");
    const alice = await host.teammates.createAsync(new TeammateCreateParams("Alice", null, provider.id, Harness.Provider, null, null));
    await host.providers.setEnabledAsync(new ProviderEnabledParams(off.id, false));
    await host.providers.setEnabledAsync(new ProviderEnabledParams(home.id, false));
    const asUsual = new RequestedSettings("usual", null, null);
    const refusals: Promise<ServiceException>[] = [];
    host.adapter.afterDetails = () => {
      if (host.adapter.requests.length !== 1 || refusals.length > 0)
        return;
      const token = SenderEnvironment.read(host.adapter.requests[0]!.environment);
      for (const [settings, providerId] of [[new RequestedSettings("fake", null, null), off.id], [asUsual, null]] as const)
        refusals.push(Assert.throwsAsync(() => host.engine.sendAsync(new MessageSendParams(second.id, "Check it", settings, providerId, [], [], null, token)), ServiceException));
    };

    await host.engine.sendAsync(new MessageSendParams(first.id, "@Alice ask", null, null, [], [alice.id]));
    await host.engine.waitForIdle();
    const [named, unnamed] = await Promise.all(refusals);
    const person = await Assert.throwsAsync(() => host.engine.sendAsync(new MessageSendParams(second.id, "go", asUsual, home.id)), ServiceException);

    Assert.areEqual(Resources.formatProviderDisabled("Off"), named!.info.message);
    Assert.areEqual(Resources.formatProviderDisabled("Home"), unnamed!.info.message);
    Assert.areEqual(Resources.formatProviderDisabled("Home"), person.info.message);
    Assert.areEqual([off.id, home.id, home.id].join(), [named!, unnamed!, person].map(t => t.info.arguments.join()).join());
    Assert.areEqual([ErrorCode.Unavailable, ErrorCode.Unavailable, ErrorCode.Unavailable].join(), [named!, unnamed!, person].map(t => t.info.name).join());
    Assert.areEqual(0, (await host.messages.listAsync(new MessageListParams(second.id, null))).length);
    Assert.areEqual(0, usual.requests.length);
    await host.providers.setEnabledAsync(new ProviderEnabledParams(home.id, true));
    Assert.areEqual(1, (await host.engine.sendAsync(new MessageSendParams(second.id, "go", asUsual, home.id))).replies.length);
    await host.engine.waitForIdle();
    Assert.areEqual(1, usual.requests.length);
  }

  @TestMethod
  public async forksTheSessionOfAChatWhoseRepliesATeammatesSendsStartedWithoutAProvider(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const first = await host.createConversationAsync(project);
    const second = await host.createConversationAsync(project);
    const other = new FakeProviderAdapter("other", true);
    host.registry.register(other);
    const [alice] = await TeammateTurnsTests.teamAsync(host, "Alice");
    const settings = new RequestedSettings("other", null, null);
    await TeammateTurnsTests.sendAs(host, alice!, first.id, second.id, "First", settings);
    const target = await TeammateTurnsTests.sendAs(host, alice!, first.id, second.id, "Second", settings);
    await TeammateTurnsTests.sendAs(host, alice!, first.id, second.id, "Third", settings);

    const result = await host.engine.rewindAsync(new ConversationRewindParams(second.id, target.sent.id, false));
    const fourth = await TeammateTurnsTests.sendAs(host, alice!, first.id, second.id, "Fourth", settings);

    Assert.isTrue(result.sessionKept);
    Assert.areEqual("other", result.conversation.forkedSession!.kind);
    Assert.isNull(result.conversation.forkedSession!.providerId);
    Assert.areEqual("session-1", other.forkRequests[0]?.nativeSessionId);
    Assert.areEqual("session-1", other.requests[1]?.resumeNativeSessionId);
    Assert.areEqual("fork-1", other.requests[3]?.resumeNativeSessionId);
    Assert.isNull((await host.messages.findAsync(fourth.replies[0]!.id))!.provenance!.providerId);
  }

  @TestMethod
  public async wakesAReplyATeammatesSendStartedWithoutAProviderUnlessItsKindsUsualProviderIsDisabled(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const first = await host.createConversationAsync(project);
    const second = await host.createConversationAsync(project);
    const third = await host.createConversationAsync(project);
    const other = new FakeProviderAdapter("other");
    const usual = new FakeProviderAdapter("usual", false, false, join(host.directory.path, "profiles", "Home"));
    host.registry.register(other);
    host.registry.register(usual);
    const home = await host.createProviderAsync("usual", "Home");
    const [alice] = await TeammateTurnsTests.teamAsync(host, "Alice");
    const watched = await TeammateTurnsTests.sendAs(host, alice!, first.id, second.id, "Watch it", new RequestedSettings("other", null, null));
    await TeammateTurnsTests.sendAs(host, alice!, first.id, third.id, "Watch it too", new RequestedSettings("usual", null, null));
    await host.providers.setEnabledAsync(new ProviderEnabledParams(home.id, false));

    const wake = await other.lastListener!.onWakeAsync(new TurnWake("item-1", "npm run dev"));
    wake!.end(new TurnResult(TurnOutcome.Completed, null, new ObservedSettings("other", null, null, null), null));
    await host.engine.waitForIdle();

    const woken = (await host.messages.listAsync(new MessageListParams(second.id, null)))[2]!;
    Assert.areEqual(watched.replies[0]!.id, woken.inReplyTo);
    Assert.isNull(woken.teammateId);
    Assert.isNull(woken.provenance!.providerId);
    Assert.areEqual(MessageStatus.Completed, woken.status);
    Assert.isNull(await usual.lastListener!.onWakeAsync(new TurnWake("item-2", "npm test")));
    Assert.areEqual(2, (await host.messages.listAsync(new MessageListParams(third.id, null))).length);
  }

  @TestMethod
  public async failsAWaitingReplyWhoseProviderIsDisabledBeforeItStartsAndLetsTheRunningOneFinish(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const provider = await host.createProviderAsync();
    const ana = await host.teammates.createAsync(new TeammateCreateParams("Ana", null, provider.id, Harness.Provider, null, null));
    const ben = await host.teammates.createAsync(new TeammateCreateParams("Ben", null, provider.id, Harness.Provider, null, null));
    host.adapter.afterDetails = async () => {
      if (host.adapter.requests.length === 1)
        await host.providers.setEnabledAsync(new ProviderEnabledParams(provider.id, false));
    };

    const result = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Ana @Ben go", null, null, [], [ana.id, ben.id]));
    await host.engine.waitForIdle();
    const [running, waiting] = (await Promise.all(result.replies.map(t => host.messages.findAsync(t.id)))).map(t => t!);

    Assert.areEqual(1, host.adapter.requests.length);
    Assert.areEqual([ana.id, ben.id].join(), [running!, waiting!].map(t => t.teammateId).join());
    Assert.areEqual(MessageStatus.Completed, running!.status);
    Assert.areEqual(MessageStatus.Failed, waiting!.status);
    Assert.areEqual(`${DetailKind.Error} ${Resources.formatProviderDisabled("Work")}`, waiting!.details.map(t => `${t.kind} ${t.text}`).join());
    const updates = host.listener.events.filter(t => t.name === EventName.MessageUpdated).map(t => Message.fromJson(t.payload)).filter(t => t.id === waiting!.id);
    Assert.areEqual(MessageStatus.Failed, updates.at(-1)?.status);
    Assert.areEqual(0, host.engine.activeRunCount);
  }

  @TestMethod
  public async failsAWaitingReplyWithoutAProviderWhenItsKindsUsualProviderIsDisabledBeforeItStarts(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const provider = await host.createProviderAsync();
    const usual = new FakeProviderAdapter("usual", false, false, join(host.directory.path, "profiles", "Home"));
    host.registry.register(usual);
    const home = await host.createProviderAsync("usual", "Home");
    const alice = await host.teammates.createAsync(new TeammateCreateParams("Alice", null, provider.id, Harness.Provider, null, null));
    const sends: Promise<MessageSendResult>[] = [];
    host.adapter.afterDetails = () => {
      if (sends.length === 0) {
        const token = SenderEnvironment.read(host.adapter.requests[0]!.environment);
        sends.push(host.engine.sendAsync(new MessageSendParams(conversation.id, "Check it", new RequestedSettings("usual", null, null), null, [], [], null, token))
          .then(async t => {
            await host.providers.setEnabledAsync(new ProviderEnabledParams(home.id, false));
            return t;
          }));
      }
      return sends[0];
    };

    await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice ask", null, null, [], [alice.id]));
    await host.engine.waitForIdle();
    const [queued] = await Promise.all(sends);
    const waiting = (await host.messages.findAsync(queued!.replies[0]!.id))!;

    Assert.isNull(waiting.provenance?.providerId);
    Assert.areEqual(MessageStatus.Failed, waiting.status);
    Assert.areEqual(`${DetailKind.Error} ${Resources.formatProviderDisabled("Home")}`, waiting.details.map(t => `${t.kind} ${t.text}`).join());
    Assert.areEqual(0, usual.requests.length);
    Assert.areEqual(0, host.engine.activeRunCount);
  }

  @TestMethod
  public async resetsAffectedMembershipsOnRewindRebindAndRejoin(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const provider = await host.createProviderAsync();
    const alice = await host.teammates.createAsync(new TeammateCreateParams("Alice", null, provider.id, Harness.Provider, null, null));
    const bob = await host.teammates.createAsync(new TeammateCreateParams("Bob", null, provider.id, Harness.Provider, null, null));
    const member = new ConversationMemberParams(conversation.id, alice.id);
    const first = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice @Bob first", null, null, [], [alice.id, bob.id]));
    await host.engine.waitForIdle();
    const second = await host.engine.sendAsync(new MessageSendParams(conversation.id, "Second", null, null, [], [], alice.id));
    await host.engine.waitForIdle();
    await host.engine.rewindAsync(new ConversationRewindParams(conversation.id, second.sent.id, false));
    Assert.isNull((await host.conversations.findMemberAsync(member))?.nativeSessionId);
    Assert.areEqual("session-2", (await host.conversations.findMemberAsync(new ConversationMemberParams(conversation.id, bob.id)))?.nativeSessionId);
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "After rewind", null, null, [], [], alice.id));
    await host.engine.waitForIdle();
    Assert.isNull(host.adapter.requests[3]!.resumeNativeSessionId);
    Assert.isTrue(host.adapter.requests[3]!.prompt.includes("User: @Alice @Bob first"));
    await host.conversations.removeMemberAsync(member);
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice rejoin", null, null, [], [alice.id]));
    await host.engine.waitForIdle();
    Assert.isNull(host.adapter.requests[4]!.resumeNativeSessionId);
    const other = await host.createProviderAsync("fake", "Other");
    await host.teammates.updateAsync(new TeammateUpdateParams(alice.id, "Alice", null, other.id, Harness.Provider, null, null));
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "New provider", null, null, [], [], alice.id));
    await host.engine.waitForIdle();
    Assert.isNull(host.adapter.requests[5]!.resumeNativeSessionId);
    Assert.isTrue(host.adapter.requests[5]!.prompt.includes("User: @Alice @Bob first"));
    await host.teammates.deleteAsync(new TeammateIdParams(alice.id));
    await host.engine.rewindAsync(new ConversationRewindParams(conversation.id, first.sent.id, false));
  }

  private static async teamAsync(host: CoreHost, ...names: string[]): Promise<Teammate[]> {
    const provider = await host.createProviderAsync();
    const team: Teammate[] = [];
    for (const name of names)
      team.push(await host.teammates.createAsync(new TeammateCreateParams(name, null, provider.id, Harness.Provider, null, null)));
    return team;
  }

  private static async sendAs(host: CoreHost, teammate: Teammate, fromId: string, toId: string, text: string, settings: RequestedSettings): Promise<MessageSendResult> {
    const sent: Promise<MessageSendResult>[] = [];
    host.adapter.afterDetails = async () => {
      const token = SenderEnvironment.read(host.adapter.requests[host.adapter.requests.length - 1]!.environment);
      const sending = host.engine.sendAsync(new MessageSendParams(toId, text, settings, null, [], [], null, token));
      sent.push(sending);
      await sending;
    };
    await host.engine.sendAsync(new MessageSendParams(fromId, `@${teammate.name} go`, null, null, [], [teammate.id]));
    await host.engine.waitForIdle();
    host.adapter.afterDetails = null;
    const result = await sent[0]!;
    await host.engine.waitForIdle();
    return result;
  }

  private static async statusesAsync(host: CoreHost, replies: readonly Message[]): Promise<string> {
    return (await Promise.all(replies.map(t => host.messages.findAsync(t.id)))).map(t => t!.status).join(",");
  }
}
