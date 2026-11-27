/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Resources, type TurnSteer } from "@noldova/teamrun.core";
import { ServiceException } from "@noldova/teamrun.services";
import {
  type Conversation, ErrorCode, Harness, MessageAuthor, MessageDelivery, MessageListParams, MessageSendParams, OrganizationChat, OrganizationParent,
  RequestedSettings, type Teammate, TeammateCreateParams, TeammatePlaceParams, WaitingMessageAddParams
} from "@noldova/teamrun.protocol";

import { ChangeSignal } from "../../fixtures/change-signal.fixture.js";
import { CoreHost } from "../../fixtures/core-host.fixture.js";

@TestClass
export class OrganizationChatMentionsTests {
  @TestMethod
  public async sendsAnAtNameInAnOrganizationChatAsTextAndOnlyItsTeammateAnswers(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const builder = await OrganizationChatMentionsTests.teammateAsync(host, "Builder");
    const reviewer = await OrganizationChatMentionsTests.teammateAsync(host, "Reviewer");
    const chat = await OrganizationChatMentionsTests.chatAsync(host, builder);

    await host.engine.sendAsync(new MessageSendParams(chat.id, "When you're done, hand your change to @Reviewer.", null, null, [], [], builder.id));
    await host.engine.waitForIdle();
    const messages = await host.messages.listAsync(new MessageListParams(chat.id, null));

    Assert.areEqual(1, host.adapter.requests.length);
    Assert.areEqual(builder.id, messages.filter(t => t.author === MessageAuthor.Provider).map(t => t.teammateId).join(","));
    Assert.areEqual("When you're done, hand your change to @Reviewer.:", messages.filter(t => t.author === MessageAuthor.User)
      .map(t => `${t.details[0]?.text}:${t.mentions.map(u => u.teammateId).join(",")}`).join("|"));
    Assert.isFalse(messages.some(t => t.teammateId === reviewer.id));
  }

  @TestMethod
  public async keepsRefusingAnUnmentionedAtNameInAnOrdinaryChat(): Promise<void> {
    await using host = await CoreHost.createAsync();
    await OrganizationChatMentionsTests.teammateAsync(host, "Reviewer");
    const chat = await host.createConversationAsync();

    const refused = await host.engine.sendAsync(new MessageSendParams(chat.id, "Hand it to @Reviewer.", new RequestedSettings("fake", null, null),
      (await host.providerOfAsync()).id)).then(() => null, (error: unknown) => error);
    await host.engine.waitForIdle();
    const described = refused instanceof ServiceException ? `${refused.info.name}:${refused.message}` : String(refused);

    Assert.areEqual(`${ErrorCode.Conflict}:${Resources.mentionsChanged}`, described);
    Assert.areEqual(0, host.adapter.requests.length);
  }

  @TestMethod
  public async queuesAnAtNameInAnOrganizationChatAsTextAndOnlyItsTeammateAnswersIt(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const builder = await OrganizationChatMentionsTests.teammateAsync(host, "Builder");
    await OrganizationChatMentionsTests.teammateAsync(host, "Reviewer");
    const chat = await OrganizationChatMentionsTests.chatAsync(host, builder);
    const gate = Promise.withResolvers<void>();
    host.adapter.holdTurn = () => host.adapter.requests.length === 1 ? gate.promise : Promise.resolve();
    await host.engine.sendAsync(new MessageSendParams(chat.id, "First", null, null, [], [], builder.id));
    await host.adapter.requested(1);

    await host.engine.addWaitingAsync(new WaitingMessageAddParams(new MessageSendParams(chat.id, "Then hand it to @Reviewer.", null, null, [], [], builder.id),
      MessageDelivery.Queue));
    gate.resolve();
    await host.adapter.requested(2);
    await host.engine.waitForIdle();
    const messages = await host.messages.listAsync(new MessageListParams(chat.id, null));

    Assert.areEqual("First,Then hand it to @Reviewer.", messages.filter(t => t.author === MessageAuthor.User).map(t => t.details[0]?.text).join(","));
    Assert.areEqual(`${builder.id},${builder.id}`, messages.filter(t => t.author === MessageAuthor.Provider).map(t => t.teammateId).join(","));
  }

  @TestMethod
  public async handsOffToTheTeammateAnAtNameInATeammatesOwnReplyNamesInAnOrganizationChat(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const builder = await OrganizationChatMentionsTests.teammateAsync(host, "Builder");
    const reviewer = await OrganizationChatMentionsTests.teammateAsync(host, "Reviewer");
    const chat = await OrganizationChatMentionsTests.chatAsync(host, builder);
    host.adapter.turnTexts = [["@Reviewer please look, done."]];

    await host.engine.sendAsync(new MessageSendParams(chat.id, "Make the change.", null, null, [], [], builder.id));
    await host.engine.waitForIdle();
    const replies = (await host.messages.listAsync(new MessageListParams(chat.id, null))).filter(t => t.author === MessageAuthor.Provider);

    Assert.areEqual(`${builder.id}:${reviewer.id}|${reviewer.id}:`, replies.map(t => `${t.teammateId ?? "none"}:${t.mentions.map(u => u.teammateId).join(",")}`).join("|"));
  }

  @TestMethod
  public async storesAWaitingMessageWithIdsInAnOrganizationChatWithoutThemAndSteersItIntoTheChatsTeammateAsWritten(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const builder = await OrganizationChatMentionsTests.teammateAsync(host, "Builder");
    const reviewer = await OrganizationChatMentionsTests.teammateAsync(host, "Reviewer");
    const chat = await OrganizationChatMentionsTests.chatAsync(host, builder);
    host.events.subscribe({ onEvent: () => ChangeSignal.notify() });
    const steers: TurnSteer[] = [];
    const gate = Promise.withResolvers<void>();
    host.adapter.holdTurn = () => {
      if (host.adapter.requests.length !== 1)
        return Promise.resolve();
      host.adapter.lastListener?.onSteerable?.(t => {
        steers.push(t);
        ChangeSignal.notify();
        return Promise.resolve(true);
      });
      return gate.promise;
    };
    const first = await host.engine.sendAsync(new MessageSendParams(chat.id, "First", null, null, [], [], builder.id));
    await host.adapter.requested(1);

    const added = await host.engine.addWaitingAsync(new WaitingMessageAddParams(new MessageSendParams(chat.id, "@Reviewer look too.", null, null, [], [reviewer.id],
      builder.id), MessageDelivery.Steer));
    await host.until("the steered message", async () => (await host.messages.listAsync(new MessageListParams(chat.id, null)))
      .some(t => t.details[0]?.text === "@Reviewer look too."));
    gate.resolve();
    await host.engine.waitForIdle();
    const messages = await host.messages.listAsync(new MessageListParams(chat.id, null));
    const steered = messages.find(t => t.details[0]?.text === "@Reviewer look too.");

    Assert.areEqual(0, added.message.mentionedTeammateIds.length);
    Assert.areEqual("@Reviewer look too.", steers.map(t => t.text).join("|"));
    Assert.areEqual(JSON.stringify({ [Resources.steeredIntoField]: first.replies[0]?.id }), JSON.stringify(steered?.details[0]?.payload ?? null));
    Assert.areEqual("", steered?.mentions.map(t => t.teammateId).join(",") ?? "missing");
    Assert.areEqual(1, host.adapter.requests.length);
    Assert.isFalse(messages.some(t => t.teammateId === reviewer.id));
  }

  private static async teammateAsync(host: CoreHost, name: string): Promise<Teammate> {
    const teammate = await host.teammates.createAsync(new TeammateCreateParams(name, null, (await host.providerOfAsync()).id, Harness.Provider, null, null));
    await host.organization.placeAsync(new TeammatePlaceParams(Resources.defaultOrganizationId, teammate.id, OrganizationParent.person, 0));
    return teammate;
  }

  private static async chatAsync(host: CoreHost, teammate: Teammate): Promise<Conversation> {
    return await host.engine.openOrganizationChatAsync(new OrganizationChat(Resources.defaultOrganizationId, teammate.id));
  }
}
