/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { ConversationEngine, QuestionAsk, Resources, TaskStart, TurnOutcome, TurnResult, TurnWake } from "@noldova/teamrun.core";
import {
  ApprovalQuestion,
  ConversationIdParams,
  DetailKind,
  Harness,
  type Message,
  MessageListParams,
  MessageSendParams,
  MessageStatus,
  ObservedSettings,
  QuestionOption,
  RequestedSettings,
  type Teammate,
  TeammateCreateParams
} from "@noldova/teamrun.protocol";

import { CoreHost } from "../../fixtures/core-host.fixture.js";

@TestClass
export class IdleCompactionTests {
  @TestMethod
  @TestData(true)
  @TestData(false)
  public async tellsEachTurnWhetherThePersonLetsItsChatCompactWhileIdle(on: boolean): Promise<void> {
    await using host = await CoreHost.createAsync(false, false, undefined, undefined, undefined, null, true, undefined, () => on);
    const conversation = await host.createConversationAsync();

    await host.engine.sendAsync(new MessageSendParams(conversation.id, "Look", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();

    Assert.areEqual(String(on), host.adapter.requests.map(t => t.compactsWhenIdle).join(","));
  }

  @TestMethod
  public async showsAnIdleCompactionAsAReplyWithItsOwnNoteAndEndsIt(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    await IdleCompactionTests.answered(host, conversation.id);

    const wake = (await host.adapter.lastListener?.onWakeAsync(new TurnWake(null, null, true))) ?? null;
    wake?.end(new TurnResult(TurnOutcome.Completed, null, new ObservedSettings("fake", null, null, null), null));
    await host.engine.waitForIdle();

    const shown = (await IdleCompactionTests.chatAsync(host, conversation.id)).at(-1);
    Assert.isNotNull(wake);
    Assert.areEqual(3, (await IdleCompactionTests.chatAsync(host, conversation.id)).length);
    Assert.areEqual(MessageStatus.Completed, shown?.status);
    Assert.areEqual(JSON.stringify([[DetailKind.Note, Resources.idleCompactionNote, { source: "wake", idleCompaction: true }]]),
      JSON.stringify(shown?.details.map(t => [t.kind, t.text, t.payload])));
  }

  @TestMethod
  public async compactsAnIdleChatForAnEngineThatKeepsNoBackgroundTasks(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const engine = new ConversationEngine(host.context, host.projects, host.conversations, host.messages, host.approvals, host.providers, host.teammates,
      host.registry, host.events);
    await engine.sendAsync(new MessageSendParams(conversation.id, "Look", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await engine.waitForIdle();

    const wake = (await host.adapter.lastListener?.onWakeAsync(new TurnWake(null, null, true))) ?? null;
    wake?.end(new TurnResult(TurnOutcome.Completed, null, new ObservedSettings("fake", null, null, null), null));
    await engine.waitForIdle();

    const shown = (await IdleCompactionTests.chatAsync(host, conversation.id)).at(-1);
    Assert.isNotNull(wake);
    Assert.areEqual(3, (await IdleCompactionTests.chatAsync(host, conversation.id)).length);
    Assert.areEqual(MessageStatus.Completed, shown?.status);
    Assert.areEqual(Resources.idleCompactionNote, shown?.details[0]?.text);
  }

  @TestMethod
  public async refusesAnIdleCompactionOnceThePersonTurnedItOffAfterTheTurn(): Promise<void> {
    let on = true;
    await using host = await CoreHost.createAsync(false, false, undefined, undefined, undefined, null, true, undefined, () => on);
    const conversation = await host.createConversationAsync();
    await IdleCompactionTests.answered(host, conversation.id);
    on = false;

    Assert.isNull((await host.adapter.lastListener?.onWakeAsync(new TurnWake(null, null, true))) ?? null);
    Assert.areEqual(2, (await IdleCompactionTests.chatAsync(host, conversation.id)).length);
  }

  @TestMethod
  public async refusesAnIdleCompactionOfAChatWhoseSessionWasResetButStillWakesItForATask(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    await IdleCompactionTests.answered(host, conversation.id);
    await host.conversations.setSessionResetAsync(conversation.id, true);
    const listener = host.adapter.lastListener;

    const refused = (await listener?.onWakeAsync(new TurnWake(null, null, true))) ?? null;
    const woken = (await listener?.onWakeAsync(new TurnWake("t1", "npm test"))) ?? null;
    woken?.end(new TurnResult(TurnOutcome.Completed, null, new ObservedSettings("fake", null, null, null), null));
    await host.engine.waitForIdle();

    Assert.isNull(refused);
    Assert.isNotNull(woken);
  }

  @TestMethod
  public async refusesAnIdleCompactionWhileABackgroundTaskOfTheChatRuns(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const sent = await IdleCompactionTests.answered(host, conversation.id);
    await host.tasks.startAsync(conversation.id, sent, "fake", new TaskStart("t1", "npm run dev", () => Promise.resolve()));

    Assert.isNull((await host.adapter.lastListener?.onWakeAsync(new TurnWake(null, null, true))) ?? null);
    Assert.areEqual(2, (await IdleCompactionTests.chatAsync(host, conversation.id)).length);
  }

  @TestMethod
  public async refusesAnIdleCompactionWhileAReplyOfTheChatRuns(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    await IdleCompactionTests.answered(host, conversation.id);
    const listener = host.adapter.lastListener;
    host.adapter.holdUntilAbort = true;
    const running = await host.engine.sendAsync(new MessageSendParams(conversation.id, "Again", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    const reply = running.replies.at(0)?.id ?? null;
    await host.until("the running reply", async () => !Object.isNull(reply) && (await host.messages.findAsync(reply))?.status === MessageStatus.Running);

    Assert.isNull((await listener?.onWakeAsync(new TurnWake(null, null, true))) ?? null);
    Assert.areEqual(4, (await IdleCompactionTests.chatAsync(host, conversation.id)).length);
  }

  @TestMethod
  public async refusesAnIdleCompactionOfAChatThatWasDeleted(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    await IdleCompactionTests.answered(host, conversation.id);
    const listener = host.adapter.lastListener;
    await host.conversations.deleteAsync(new ConversationIdParams(conversation.id));

    Assert.isNull((await listener?.onWakeAsync(new TurnWake(null, null, true))) ?? null);
  }

  @TestMethod
  public async refusesAnIdleCompactionWhileAHandOffGroupOfTheChatRuns(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const alice = await IdleCompactionTests.teammateAsync(host, "Alice");
    const bob = await IdleCompactionTests.teammateAsync(host, "Bob");
    host.adapter.turnTexts = [["Done."], ["@Bob please look"], ["Looked."]];
    await IdleCompactionTests.answered(host, conversation.id);
    const listener = host.adapter.lastListener;
    const held = Promise.withResolvers<void>();
    host.adapter.holdTurn = request => request.prompt.includes("please look") ? held.promise : Promise.resolve();
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice ask Bob", null, null, [], [alice.id]));
    await host.until("Bob's running reply", async () => (await IdleCompactionTests.chatAsync(host, conversation.id))
      .some(t => t.teammateId === bob.id && t.status === MessageStatus.Running));

    const refused = (await listener?.onWakeAsync(new TurnWake(null, null, true))) ?? null;
    held.resolve();
    await host.engine.waitForIdle();

    Assert.isNull(refused);
    Assert.isFalse((await IdleCompactionTests.chatAsync(host, conversation.id)).some(t => t.details.some(u => u.text === Resources.idleCompactionNote)));
  }

  @TestMethod
  public async refusesAnIdleCompactionWhileAQuestionOfTheChatWaitsForItsAnswer(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    await IdleCompactionTests.answered(host, conversation.id);
    const listener = host.adapter.lastListener;
    host.adapter.questionAsk = new QuestionAsk("req-q", "AskUserQuestion", [new ApprovalQuestion("platform", "Platform", "Which platform?",
      [new QuestionOption("Desktop app", "The window"), new QuestionOption("Web", "A browser")], false, false, false)]);
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "Ask me", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.until("the question", async () => (await host.approvals.listAsync(new ConversationIdParams(conversation.id))).length === 1);

    Assert.isNull((await listener?.onWakeAsync(new TurnWake(null, null, true))) ?? null);
    Assert.areEqual(MessageStatus.AwaitingApproval, (await IdleCompactionTests.chatAsync(host, conversation.id)).at(-1)?.status);
  }

  private static async teammateAsync(host: CoreHost, name: string): Promise<Teammate> {
    return host.teammates.createAsync(new TeammateCreateParams(name, `${name}'s role`, (await host.createProviderAsync("fake", name)).id, Harness.Provider, null, null));
  }

  private static async answered(host: CoreHost, conversationId: string): Promise<string> {
    const sent = await host.engine.sendAsync(new MessageSendParams(conversationId, "Look", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    return sent.replies.at(0)?.id ?? sent.sent.id;
  }

  private static chatAsync(host: CoreHost, conversationId: string): Promise<readonly Message[]> {
    return host.messages.listAsync(new MessageListParams(conversationId, null));
  }
}
