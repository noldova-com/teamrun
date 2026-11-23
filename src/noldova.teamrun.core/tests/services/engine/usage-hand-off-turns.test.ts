/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { SqlTransaction } from "@noldova/context.data.sql";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Resources, UsageLimit } from "@noldova/teamrun.core";
import { type Conversation, ConversationMemberParams, Harness, type Message, MessageAuthor, MessageIdParams, MessageListParams, MessageSendParams, MessageStatus,
  type Provider, ProviderEnabledParams, type Teammate, TeammateCreateParams, TeammateFallback, TeammateUpdateParams } from "@noldova/teamrun.protocol";

import { CoreHost } from "../../fixtures/core-host.fixture.js";

@TestClass
export class UsageHandOffTurnsTests {
  private static readonly hour: number = 3_600_000;

  @TestMethod
  public async handsTheTurnOffAtItsStartWhileSustainIsOffAndTheNextTeammateAnswersTheSameMessage(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const work = await host.createProviderAsync("fake", "Work");
    const spare = await host.createProviderAsync("fake", "Spare");
    const rita = await UsageHandOffTurnsTests.teammateAsync(host, "Rita", spare, []);
    const bob = await UsageHandOffTurnsTests.teammateAsync(host, "Bob", work, [rita]);
    await UsageHandOffTurnsTests.runOut(host, conversation, bob, null);

    await UsageHandOffTurnsTests.ask(host, conversation, bob, "two");

    Assert.areEqual([work.id, spare.id].join(","), host.adapter.requests.map(t => t.provider?.id).join(","));
    Assert.areEqual("Bob:Failed,Bob:Completed,Rita:Completed", await UsageHandOffTurnsTests.repliesAsync(host, conversation));
    Assert.areEqual(Resources.formatUsageHandedOff("Bob", "Rita"), (await UsageHandOffTurnsTests.linesAsync(host, conversation, true)).join("|"));
    const messages = await host.messages.listAsync(new MessageListParams(conversation.id, null));
    const asked = messages.filter(t => t.author === MessageAuthor.User).at(-1);
    const answer = messages.at(-1);
    Assert.areEqual(asked?.id, answer?.inReplyTo);
    Assert.areEqual(1, answer?.details.filter(t => t.text === "Working").length);
    Assert.isTrue(host.adapter.requests[1]?.prompt.includes("two") === true);
    Assert.areEqual("model-r", host.adapter.requests[1]?.requested.model);
    Assert.isNotNull(await host.conversations.findMemberAsync(new ConversationMemberParams(conversation.id, rita.id)));
  }

  @TestMethod
  public async movesTheTurnToASustainEntryFirstAndHandsItOffOnlyOnceEveryEntryIsOut(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const work = await host.createProviderAsync("fake", "Work");
    const spare = await host.createProviderAsync("fake", "Spare");
    const other = await host.createProviderAsync("fake", "Other");
    const rita = await UsageHandOffTurnsTests.teammateAsync(host, "Rita", other, []);
    const listed = await UsageHandOffTurnsTests.teammateAsync(host, "Bob", work, [rita]);
    const bob = await host.teammates.updateAsync(TeammateUpdateParams.of(listed.id, { sustain: true, fallbacks: [new TeammateFallback(spare.id, "fake-small", "low")] }));
    const sam = await UsageHandOffTurnsTests.teammateAsync(host, "Sam", spare, []);
    await UsageHandOffTurnsTests.runOut(host, conversation, bob, null);

    await UsageHandOffTurnsTests.ask(host, conversation, bob, "on the entry");
    await UsageHandOffTurnsTests.runOut(host, conversation, sam, null);
    await UsageHandOffTurnsTests.ask(host, conversation, bob, "every entry out");

    Assert.areEqual([work.id, spare.id, spare.id, spare.id, other.id].join(","), host.adapter.requests.map(t => t.provider?.id).join(","));
    Assert.areEqual("Bob:Failed,Bob:Completed,Bob:Completed,Sam:Failed,Bob:Completed,Rita:Completed", await UsageHandOffTurnsTests.repliesAsync(host, conversation));
    Assert.areEqual(Resources.formatUsageHandedOff("Bob", "Rita"), (await UsageHandOffTurnsTests.linesAsync(host, conversation, true)).join("|"));
  }

  @TestMethod
  public async skipsATeammateStillOutOrUnableToStartAndNeverHandsBackToOneThatRanOut(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const work = await host.createProviderAsync("fake", "Work");
    const spare = await host.createProviderAsync("fake", "Spare");
    const off = await host.createProviderAsync("fake", "Off");
    const other = await host.createProviderAsync("fake", "Other");
    const rita = await UsageHandOffTurnsTests.teammateAsync(host, "Rita", spare, []);
    const dana = await UsageHandOffTurnsTests.teammateAsync(host, "Dana", off, []);
    const carol = await UsageHandOffTurnsTests.teammateAsync(host, "Carol", other, []);
    const bob = await UsageHandOffTurnsTests.teammateAsync(host, "Bob", work, [rita, dana, carol]);
    const back = await host.teammates.updateAsync(TeammateUpdateParams.of(rita.id, { usageHandOffs: [bob.id] }));
    await host.providers.setEnabledAsync(new ProviderEnabledParams(off.id, false));
    await UsageHandOffTurnsTests.runOut(host, conversation, back, null);
    await UsageHandOffTurnsTests.runOut(host, conversation, bob, null);

    await UsageHandOffTurnsTests.ask(host, conversation, bob, "to whoever has usage");
    await UsageHandOffTurnsTests.ask(host, conversation, back, "back to Bob");

    Assert.areEqual([spare.id, work.id, other.id].join(","), host.adapter.requests.map(t => t.provider?.id).join(","));
    Assert.areEqual("Rita:Failed,Bob:Failed,Bob:Completed,Carol:Completed,Rita:Completed", await UsageHandOffTurnsTests.repliesAsync(host, conversation));
    Assert.areEqual(Resources.formatUsageHandedOff("Bob", "Carol"), (await UsageHandOffTurnsTests.linesAsync(host, conversation, true)).join("|"));
    Assert.areEqual(Resources.formatUsageNoOneLeft("Rita"), (await UsageHandOffTurnsTests.linesAsync(host, conversation, false)).join("|"));
  }

  @TestMethod
  public async handsOffToTheFirstTeammateInTheListsOrderWhenSeveralHaveUsageLeft(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const work = await host.createProviderAsync("fake", "Work");
    const spare = await host.createProviderAsync("fake", "Spare");
    const other = await host.createProviderAsync("fake", "Other");
    const carol = await UsageHandOffTurnsTests.teammateAsync(host, "Carol", other, []);
    const rita = await UsageHandOffTurnsTests.teammateAsync(host, "Rita", spare, []);
    const bob = await UsageHandOffTurnsTests.teammateAsync(host, "Bob", work, [rita, carol]);
    await UsageHandOffTurnsTests.runOut(host, conversation, bob, null);

    await UsageHandOffTurnsTests.ask(host, conversation, bob, "first on the list");

    Assert.areEqual([work.id, spare.id].join(","), host.adapter.requests.map(t => t.provider?.id).join(","));
    Assert.areEqual(Resources.formatUsageHandedOff("Bob", "Rita"), (await UsageHandOffTurnsTests.linesAsync(host, conversation, true)).join("|"));
  }

  @TestMethod
  public async endsTheReplyWithTheNoOneLeftLineAndStartsNothingWhenEveryTeammateOnTheListIsOut(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const work = await host.createProviderAsync("fake", "Work");
    const spare = await host.createProviderAsync("fake", "Spare");
    const rita = await UsageHandOffTurnsTests.teammateAsync(host, "Rita", spare, []);
    const bob = await UsageHandOffTurnsTests.teammateAsync(host, "Bob", work, [rita]);
    await UsageHandOffTurnsTests.runOut(host, conversation, rita, null);
    await UsageHandOffTurnsTests.runOut(host, conversation, bob, null);

    await UsageHandOffTurnsTests.ask(host, conversation, bob, "anyone");

    Assert.areEqual(2, host.adapter.requests.length);
    Assert.areEqual("Rita:Failed,Bob:Failed,Bob:Completed", await UsageHandOffTurnsTests.repliesAsync(host, conversation));
    Assert.areEqual(Resources.formatUsageNoOneLeft("Bob"), (await UsageHandOffTurnsTests.linesAsync(host, conversation, false)).join("|"));
    Assert.areEqual(0, (await UsageHandOffTurnsTests.linesAsync(host, conversation, true)).length);
  }

  @TestMethod
  public async endsTheReplyWithTheLimitsNoteWhenTheHandOffWouldPassTheChainsLimit(): Promise<void> {
    await using host = await CoreHost.createAsync(false, false, undefined, () => 1);
    const conversation = await host.createConversationAsync();
    const work = await host.createProviderAsync("fake", "Work");
    const spare = await host.createProviderAsync("fake", "Spare");
    const other = await host.createProviderAsync("fake", "Other");
    const rita = await UsageHandOffTurnsTests.teammateAsync(host, "Rita", spare, []);
    const bob = await UsageHandOffTurnsTests.teammateAsync(host, "Bob", work, [rita]);
    const carol = await UsageHandOffTurnsTests.teammateAsync(host, "Carol", other, []);
    await UsageHandOffTurnsTests.runOut(host, conversation, bob, null);
    host.adapter.turnTexts = [[], ["@Bob over to you"]];

    await UsageHandOffTurnsTests.ask(host, conversation, carol, "start the chain");

    Assert.areEqual([work.id, other.id].join(","), host.adapter.requests.map(t => t.provider?.id).join(","));
    Assert.areEqual("Bob:Failed,Carol:Completed,Bob:Completed", await UsageHandOffTurnsTests.repliesAsync(host, conversation));
    Assert.areEqual(Resources.formatUsageChainStopped("Bob", 1), (await UsageHandOffTurnsTests.linesAsync(host, conversation, false)).join("|"));
    Assert.isNull(await host.conversations.findMemberAsync(new ConversationMemberParams(conversation.id, rita.id)));
  }

  @TestMethod
  public async letsTheTeammateAlreadyAnsweringTheMessageAnswerItOnce(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const work = await host.createProviderAsync("fake", "Work");
    const spare = await host.createProviderAsync("fake", "Spare");
    const rita = await UsageHandOffTurnsTests.teammateAsync(host, "Rita", spare, []);
    const bob = await UsageHandOffTurnsTests.teammateAsync(host, "Bob", work, [rita]);
    await UsageHandOffTurnsTests.runOut(host, conversation, bob, null);

    await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Bob @Rita both", null, null, [], [bob.id, rita.id]));
    await host.engine.waitForIdle();

    Assert.areEqual([work.id, spare.id].join(","), host.adapter.requests.map(t => t.provider?.id).join(","));
    Assert.areEqual(1, (await UsageHandOffTurnsTests.repliesAsync(host, conversation)).split(",").filter(t => t.startsWith("Rita:")).length);
    Assert.areEqual(Resources.formatUsageHandedOff("Bob", "Rita"), (await UsageHandOffTurnsTests.linesAsync(host, conversation, true)).join("|"));
  }

  @TestMethod
  public async runsTheTeammatesOwnTurnsAgainOnceItsUsageResets(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const work = await host.createProviderAsync("fake", "Work");
    const spare = await host.createProviderAsync("fake", "Spare");
    const rita = await UsageHandOffTurnsTests.teammateAsync(host, "Rita", spare, []);
    const bob = await UsageHandOffTurnsTests.teammateAsync(host, "Bob", work, [rita]);
    await UsageHandOffTurnsTests.runOut(host, conversation, bob, new Date(UsageHandOffTurnsTests.hour).toISOString());
    await UsageHandOffTurnsTests.ask(host, conversation, bob, "while out");

    host.timer.jump(UsageHandOffTurnsTests.hour + 1);
    await UsageHandOffTurnsTests.ask(host, conversation, bob, "after the reset");

    Assert.areEqual([work.id, spare.id, work.id].join(","), host.adapter.requests.map(t => t.provider?.id).join(","));
    Assert.areEqual("Bob:Failed,Bob:Completed,Rita:Completed,Bob:Completed", await UsageHandOffTurnsTests.repliesAsync(host, conversation));
    Assert.areEqual(1, (await UsageHandOffTurnsTests.linesAsync(host, conversation, true)).length);
  }

  @TestMethod
  public async handsNothingOffWhenTheLimitIsHitDuringATurn(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const work = await host.createProviderAsync("fake", "Work");
    const spare = await host.createProviderAsync("fake", "Spare");
    const rita = await UsageHandOffTurnsTests.teammateAsync(host, "Rita", spare, []);
    const bob = await UsageHandOffTurnsTests.teammateAsync(host, "Bob", work, [rita]);

    await UsageHandOffTurnsTests.runOut(host, conversation, bob, null);

    Assert.areEqual(work.id, host.adapter.requests.map(t => t.provider?.id).join(","));
    Assert.areEqual("Bob:Failed", await UsageHandOffTurnsTests.repliesAsync(host, conversation));
    Assert.areEqual(0, [...await UsageHandOffTurnsTests.linesAsync(host, conversation, true), ...await UsageHandOffTurnsTests.linesAsync(host, conversation, false)].length);
    Assert.isNull(await host.conversations.findMemberAsync(new ConversationMemberParams(conversation.id, rita.id)));
  }

  @TestMethod
  public async runsTheTurnOutOfUsageAsBeforeWhenTheListIsEmpty(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const work = await host.createProviderAsync("fake", "Work");
    const bob = await UsageHandOffTurnsTests.teammateAsync(host, "Bob", work, []);
    await UsageHandOffTurnsTests.runOut(host, conversation, bob, null);

    await UsageHandOffTurnsTests.ask(host, conversation, bob, "again");

    Assert.areEqual([work.id, work.id].join(","), host.adapter.requests.map(t => t.provider?.id).join(","));
    Assert.areEqual("Bob:Failed,Bob:Completed", await UsageHandOffTurnsTests.repliesAsync(host, conversation));
  }

  @TestMethod
  public async keepsTheChainThroughAHandOffSoTheTeammateTakesNoEntryItAlreadyTriedThere(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const work = await host.createProviderAsync("fake", "Work");
    const spare = await host.createProviderAsync("fake", "Spare");
    const other = await host.createProviderAsync("fake", "Other");
    const listed = await UsageHandOffTurnsTests.teammateAsync(host, "Alice", work, []);
    const alice = await host.teammates.updateAsync(TeammateUpdateParams.of(listed.id, { sustain: true, fallbacks: [new TeammateFallback(spare.id, "fake-small", "low")] }));
    const bob = await UsageHandOffTurnsTests.teammateAsync(host, "Bob", other, [alice]);
    await UsageHandOffTurnsTests.runOut(host, conversation, bob, null);
    host.adapter.limits.set(work.id, new UsageLimit(new Date(UsageHandOffTurnsTests.hour).toISOString()));
    host.adapter.turnTexts = [[], [], ["@Bob over to you"]];
    host.adapter.afterDetails = (): void => {
      if (host.adapter.requests.length !== 3)
        return;
      host.adapter.limits.delete(work.id);
      host.timer.jump(UsageHandOffTurnsTests.hour + 1);
    };

    await UsageHandOffTurnsTests.ask(host, conversation, alice, "start the chain");

    Assert.areEqual([other.id, work.id, spare.id, spare.id].join(","), host.adapter.requests.map(t => t.provider?.id).join(","));
    Assert.areEqual("Bob:Failed,Alice:Failed,Alice:Completed,Bob:Completed,Alice:Completed", await UsageHandOffTurnsTests.repliesAsync(host, conversation));
    Assert.areEqual(Resources.formatUsageHandedOff("Bob", "Alice"), (await UsageHandOffTurnsTests.linesAsync(host, conversation, true)).join("|"));
  }

  @TestMethod
  public async queuesNothingAfterALimitInTheMiddleOfATurnWithNoEntryLeftAndHandsOffAtTheNextTurn(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const work = await host.createProviderAsync("fake", "Work");
    const spare = await host.createProviderAsync("fake", "Spare");
    const other = await host.createProviderAsync("fake", "Other");
    const rita = await UsageHandOffTurnsTests.teammateAsync(host, "Rita", other, []);
    const listed = await UsageHandOffTurnsTests.teammateAsync(host, "Bob", work, [rita]);
    const bob = await host.teammates.updateAsync(TeammateUpdateParams.of(listed.id, { sustain: true, fallbacks: [new TeammateFallback(spare.id, "fake-small", "low")] }));
    host.adapter.limits.set(work.id, new UsageLimit(null));
    host.adapter.limits.set(spare.id, new UsageLimit(null));

    await UsageHandOffTurnsTests.ask(host, conversation, bob, "until every entry is out");
    const before = await UsageHandOffTurnsTests.repliesAsync(host, conversation);
    host.adapter.limits.clear();
    await UsageHandOffTurnsTests.ask(host, conversation, bob, "after");

    Assert.areEqual("Bob:Failed,Bob:Failed", before);
    Assert.areEqual([work.id, spare.id, other.id].join(","), host.adapter.requests.map(t => t.provider?.id).join(","));
    Assert.areEqual("Bob:Failed,Bob:Failed,Bob:Completed,Rita:Completed", await UsageHandOffTurnsTests.repliesAsync(host, conversation));
    Assert.areEqual(Resources.formatUsageHandedOff("Bob", "Rita"), (await UsageHandOffTurnsTests.linesAsync(host, conversation, true)).join("|"));
  }

  @TestMethod
  public async endsTheReplyStoppedWithNoNextReplyWhenStopComesWhileTheCandidatesAreRead(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const work = await host.createProviderAsync("fake", "Work");
    const spare = await host.createProviderAsync("fake", "Spare");
    const rita = await UsageHandOffTurnsTests.teammateAsync(host, "Rita", spare, []);
    const bob = await UsageHandOffTurnsTests.teammateAsync(host, "Bob", work, [rita]);
    await UsageHandOffTurnsTests.runOut(host, conversation, bob, null);
    const before = new Set((await host.messages.listAsync(new MessageListParams(conversation.id, null))).map(t => t.id));
    const list = host.teammates.listAsync.bind(host.teammates);
    const stops: Promise<Message>[] = [];
    host.teammates.listAsync = async (transaction?: SqlTransaction): Promise<readonly Teammate[]> => {
      if (!Object.isUndefined(transaction) || stops.length > 0)
        return list(transaction);
      const reply = (await host.messages.listAsync(new MessageListParams(conversation.id, null))).find(t => t.author === MessageAuthor.Provider && !before.has(t.id));
      if (!Object.isUndefined(reply))
        stops.push(host.engine.cancelAsync(new MessageIdParams(reply.id)));
      return list(transaction);
    };

    await UsageHandOffTurnsTests.ask(host, conversation, bob, "stopped");
    await Promise.all(stops);

    Assert.areEqual(1, stops.length);
    Assert.areEqual(work.id, host.adapter.requests.map(t => t.provider?.id).join(","));
    Assert.areEqual("Bob:Failed,Bob:Cancelled", await UsageHandOffTurnsTests.repliesAsync(host, conversation));
    Assert.areEqual(0, [...await UsageHandOffTurnsTests.linesAsync(host, conversation, true), ...await UsageHandOffTurnsTests.linesAsync(host, conversation, false)].length);
    Assert.isNull(await host.conversations.findMemberAsync(new ConversationMemberParams(conversation.id, rita.id)));
  }

  @TestMethod
  public async stopsTheNextTeammatesReplyWhenStopComesWhileTheHandOffIsWritten(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const work = await host.createProviderAsync("fake", "Work");
    const spare = await host.createProviderAsync("fake", "Spare");
    const rita = await UsageHandOffTurnsTests.teammateAsync(host, "Rita", spare, []);
    const bob = await UsageHandOffTurnsTests.teammateAsync(host, "Bob", work, [rita]);
    await UsageHandOffTurnsTests.runOut(host, conversation, bob, null);
    const update = host.messages.updateAsync.bind(host.messages);
    const stops: Promise<Message>[] = [];
    host.messages.updateAsync = async (message: Message, transaction?: SqlTransaction): Promise<void> => {
      await update(message, transaction);
      if (message.teammateId === bob.id && message.status === MessageStatus.Completed && stops.length === 0)
        stops.push(host.engine.cancelAsync(new MessageIdParams(message.id)));
    };

    await UsageHandOffTurnsTests.ask(host, conversation, bob, "stopped");
    await Promise.all(stops);

    Assert.areEqual(1, stops.length);
    Assert.areEqual(work.id, host.adapter.requests.map(t => t.provider?.id).join(","));
    Assert.areEqual("Bob:Failed,Bob:Completed,Rita:Cancelled", await UsageHandOffTurnsTests.repliesAsync(host, conversation));
  }

  private static async teammateAsync(host: CoreHost, name: string, provider: Provider, handOffs: readonly Teammate[]): Promise<Teammate> {
    const created = await host.teammates.createAsync(new TeammateCreateParams(name, `Work as ${name}`, provider.id, Harness.Provider, `model-${name.charAt(0).toLowerCase()}`, "low"));
    return handOffs.length === 0 ? created : host.teammates.updateAsync(TeammateUpdateParams.of(created.id, { usageHandOffs: handOffs.map(t => t.id) }));
  }

  private static async runOut(host: CoreHost, conversation: Conversation, teammate: Teammate, resetsAt: string | null): Promise<void> {
    host.adapter.limits.set(teammate.providerId, new UsageLimit(resetsAt));
    await UsageHandOffTurnsTests.ask(host, conversation, teammate, "until the limit");
    host.adapter.limits.delete(teammate.providerId);
  }

  private static async ask(host: CoreHost, conversation: Conversation, teammate: Teammate, text: string): Promise<void> {
    await host.engine.sendAsync(new MessageSendParams(conversation.id, `@${teammate.name} ${text}`, null, null, [], [teammate.id]));
    await host.engine.waitForIdle();
  }

  private static async repliesAsync(host: CoreHost, conversation: Conversation): Promise<string> {
    return (await host.messages.listAsync(new MessageListParams(conversation.id, null))).filter(t => t.author === MessageAuthor.Provider)
      .map(t => `${t.teammateName}:${t.status}`).join(",");
  }

  private static async linesAsync(host: CoreHost, conversation: Conversation, handedOff: boolean): Promise<readonly string[]> {
    const payload = JSON.stringify({ source: Resources.usageHandOffSource, [Resources.handedOffField]: handedOff });
    return (await host.messages.listAsync(new MessageListParams(conversation.id, null))).flatMap(t => t.details.filter(d => JSON.stringify(d.payload) === payload).map(d => d.text));
  }
}
